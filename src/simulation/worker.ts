import type { Robot, RobotMotionState, Task, SimEvent, SimMetrics, WarehouseGraph, RouteStep, GridNode, Position } from '../types';
import { generateWarehouse } from './warehouseGraph';
import { aStar } from './planner';
import { MotionPath } from './motionPath';
import { FLEET_SCENARIO } from './scenario';
import { applyRightHandLanes } from './laneRouting';

let graph: WarehouseGraph = generateWarehouse();
let robots: Record<string, Robot> = {};
let tasks: Record<string, Task> = {};
let events: SimEvent[] = [];
let reservations: Record<string, string> = {};
let simTime = 0;
let isPlaying = false;
let completedDurations: number[] = [];
let futureTrajectories: Record<string, Position[]> = {};
let futureBlockedBy: Record<string, string> = {};
let waitingSince: Record<string, number> = {};
let priorityGrantUntil: Record<string, number> = {};
let deadlocksResolved = 0;
let overlapViolations = 0;
let minimumSeparation = Infinity;
let activeOverlapPairs = new Set<string>();
let resolvedWaitEpisodes = new Set<string>();
let dispatchOwners: Record<string, string> = {};
let recoveryOwner: string | null = null;
let lastFleetProgressAt = 0;

let robotPaths: Record<string, MotionPath | null> = {};

function addEvent(text: string) {
  events.unshift({ id: Math.random().toString(), time: simTime, text });
  if (events.length > 50) events.pop();
}

function init() {
  FLEET_SCENARIO.forEach((unit, index) => {
    const staging = graph.nodes[unit.bay];
    robots[unit.id] = {
      id: unit.id,
      position: { x: staging.x, y: staging.y },
      heading: 0,
      state: 'IDLE',
      resumeState: null,
      taskId: null,
      homeNodeId: unit.bay,
      route: [],
      pathProgress: 0,
      currentWaypointIndex: 0,
      speed: 1.2,
      velocity: 0,
      angularVelocity: 0,
      waitingTime: 0,
      tasksCompleted: 0,
      battery: 100,
      distanceTraveled: 0,
      payload: false
    };
    robotPaths[unit.id] = null;
    const id = `T${String(index + 1).padStart(3, '0')}`;
    tasks[id] = {
      id,
      pickupNodeId: unit.pickup,
      dropNodeId: unit.drop,
      priority: unit.priority,
      assignedRobotId: null,
      status: 'QUEUED',
      createdAt: simTime,
      completedAt: null
    };
    addEvent(`Task ${id} created (${unit.pickup.replace('_LEFT_SERVICE', '').replace('_RIGHT_SERVICE', '')} -> ${unit.drop})`);
  });
}

function assignTasks() {
  const queued = Object.values(tasks).filter(t => t.status === 'QUEUED');
  const activeMissions = Object.values(tasks).filter(task => task.status === 'IN_PROGRESS').length;
  let availableSlots = Math.max(0, 2 - activeMissions);

  for (const t of queued) {
    if (!availableSlots) break;
    const preferredRobotId = `R${t.id.slice(-2)}`;
    const r = robots[preferredRobotId];
    if (!r || r.state !== 'IDLE') continue;
    
    t.status = 'IN_PROGRESS';
    t.assignedRobotId = r.id;
    r.taskId = t.id;
    r.state = 'ASSIGNED';
    
    addEvent(`${r.id} assigned ${t.id}`);
    availableSlots--;
  }
}

function assignRouteAndPath(r: Robot, route: RouteStep[] | null) {
  if (route && route.length > 0) {
    r.route = applyRightHandLanes(route);
    r.pathProgress = 0;
    r.resumeState = null;
    
    const positions = r.route.map(step => ({ x: step.x, y: step.y }));
    robotPaths[r.id] = new MotionPath(positions, 1.15);
    const departure = robotPaths[r.id]!.getPointAtDistance(Math.min(0.1, robotPaths[r.id]!.totalLength));
    if (r.velocity <= 0.05) r.heading = departure.heading;
    r.currentWaypointIndex = 0;
    console.info(`[PHASE A] ${r.id} A* nodes: ${route.map(step => step.nodeId).join(' -> ')}`);
    
    return true;
  }
  return false;
}

const FUTURE_HORIZON_SECONDS = 3;
const FUTURE_STEP_SECONDS = 0.5;
const FUTURE_CLEARANCE = 1.12;

function hasPriorityGrant(robotId: string) {
  return (priorityGrantUntil[robotId] ?? 0) > simTime;
}

function coordinationScore(robot: Robot) {
  const taskPriority = robot.taskId ? tasks[robot.taskId]?.priority ?? 0 : 0;
  const waitAge = waitingSince[robot.id] === undefined ? 0 : simTime - waitingSince[robot.id];
  const routeState = robot.state === 'WAITING' ? robot.resumeState : robot.state;
  return (hasPriorityGrant(robot.id) ? 1_000_000 : 0) + (routeState === 'RETURNING_TO_STAGING' ? 100_000 : 0) + waitAge * 1_000 + taskPriority * 10;
}

function compareCoordinationPriority(a: Robot, b: Robot) {
  const delta = coordinationScore(b) - coordinationScore(a);
  return Math.abs(delta) > 0.001 ? delta : a.id.localeCompare(b.id);
}

function robotDropZone(robot: Robot) {
  return robot.taskId ? tasks[robot.taskId]?.dropNodeId ?? null : null;
}

function updateDispatchReservations() {
  for (const [zone, ownerId] of Object.entries(dispatchOwners)) {
    const owner = robots[ownerId];
    if (!owner || owner.state === 'IDLE' || (owner.state === 'RETURNING_TO_STAGING' && owner.position.x < 51)) delete dispatchOwners[zone];
  }
  for (const zone of ['PACK_1', 'PACK_2']) {
    if (dispatchOwners[zone]) continue;
    const candidates = Object.values(robots).filter(robot => {
      const routeState = robot.state === 'WAITING' ? robot.resumeState : robot.state;
      if (routeState !== 'MOVING_TO_DROPOFF') return false;
      if (robotDropZone(robot) !== zone) return false;
      const path = robotPaths[robot.id];
      if (!path) return false;
      return path.getPointAtDistance(Math.min(path.totalLength, robot.pathProgress + Math.max(2.6, robot.velocity * FUTURE_HORIZON_SECONDS))).position.x > 51;
    }).sort(compareCoordinationPriority);
    if (candidates[0]) dispatchOwners[zone] = candidates[0].id;
  }
}

function predictedTrajectory(robot: Robot) {
  const path = robotPaths[robot.id];
  if (!path) return [robot.position];
  const planningSpeed = Math.max(0.72, robot.velocity);
  const points: Position[] = [];
  for (let t = 0; t <= FUTURE_HORIZON_SECONDS + 0.001; t += FUTURE_STEP_SECONDS) {
    points.push(path.getPointAtDistance(Math.min(path.totalLength, robot.pathProgress + planningSpeed * t)).position);
  }
  return points;
}

/** Rebuilded every fixed step. A robot reserves a space-time corridor, rather
 * than a single junction. Lower-priority trajectories stop before conflicts. */
function updateFutureMap() {
  futureTrajectories = {};
  futureBlockedBy = {};
  const claims: Array<Array<{ robotId: string; position: Position }>> = [];
  const candidates = Object.values(robots)
    .filter(robot => isMotionState(robot.state) || robot.state === 'WAITING')
    .sort(compareCoordinationPriority);

  for (const robot of candidates) {
    const trajectory = predictedTrajectory(robot);
    futureTrajectories[robot.id] = trajectory;
    for (let step = 1; step < trajectory.length; step++) {
      const conflict = (claims[step] ?? []).find(claim =>
        Math.hypot(claim.position.x - trajectory[step].x, claim.position.y - trajectory[step].y) < FUTURE_CLEARANCE
      );
      if (conflict) {
        futureBlockedBy[robot.id] = conflict.robotId;
        break;
      }
    }
    if (!futureBlockedBy[robot.id]) {
      trajectory.forEach((position, step) => {
        (claims[step] ??= []).push({ robotId: robot.id, position });
      });
    }
  }
}

function findWaitCycle() {
  for (const start of Object.keys(futureBlockedBy)) {
    const seen = new Set<string>();
    let current: string | undefined = start;
    while (current && futureBlockedBy[current]) {
      if (seen.has(current)) return [...seen];
      seen.add(current);
      current = futureBlockedBy[current];
    }
  }
  return [];
}

function hasConvoyAhead(robot: Robot) {
  const path = robotPaths[robot.id];
  if (!path) return true;
  const heading = path.getPointAtDistance(robot.pathProgress).heading;
  return Object.values(robots).some(other => {
    if (other.id === robot.id) return false;
    const dx = other.position.x - robot.position.x;
    const dy = other.position.y - robot.position.y;
    const separation = Math.hypot(dx, dy);
    if (separation > 1.45) return false;
    const forward = dx * Math.cos(heading) + dy * Math.sin(heading);
    const lateral = Math.abs(-dx * Math.sin(heading) + dy * Math.cos(heading));
    const alignment = Math.cos(shortestAngle(other.heading - heading));
    return alignment > 0.5 && forward > 0 && lateral < 0.88;
  });
}

function resolveDeadlocks() {
  for (const robot of Object.values(robots)) {
    if (robot.state === 'WAITING') waitingSince[robot.id] ??= simTime;
    else if (!isMotionState(robot.state)) {
      delete waitingSince[robot.id];
      resolvedWaitEpisodes.delete(robot.id);
    }
    if (!hasPriorityGrant(robot.id)) delete priorityGrantUntil[robot.id];
  }
  if (recoveryOwner) {
    const owner = robots[recoveryOwner];
    if (!owner || (!isMotionState(owner.state) && owner.state !== 'WAITING')) recoveryOwner = null;
  }
  if (recoveryOwner) return;
  if (Object.keys(priorityGrantUntil).length) return;
  const cycle = findWaitCycle();
  const starved = Object.keys(waitingSince).filter(id => robots[id]?.state === 'WAITING' && simTime - waitingSince[id] >= 3.5);
  const candidates = cycle.length ? cycle : starved;
  if (!candidates.length) return;
  const candidateRobots = candidates
    .map(id => robots[id])
    .filter(Boolean);
  const movableHeads = candidateRobots.filter(robot => !hasConvoyAhead(robot));
  const winner = (movableHeads.length ? movableHeads : candidateRobots)
    .sort((a, b) => {
      const aReturning = (a.state === 'WAITING' ? a.resumeState : a.state) === 'RETURNING_TO_STAGING';
      const bReturning = (b.state === 'WAITING' ? b.resumeState : b.state) === 'RETURNING_TO_STAGING';
      return Number(bReturning) - Number(aReturning) || Number(resolvedWaitEpisodes.has(a.id)) - Number(resolvedWaitEpisodes.has(b.id)) || (waitingSince[a.id] ?? simTime) - (waitingSince[b.id] ?? simTime) || a.id.localeCompare(b.id);
    })[0];
  if (!winner) return;
  priorityGrantUntil[winner.id] = simTime + 6;
  if (cycle.length || simTime - lastFleetProgressAt > 2) recoveryOwner = winner.id;
  if (!resolvedWaitEpisodes.has(winner.id)) {
    resolvedWaitEpisodes.add(winner.id);
    deadlocksResolved++;
    addEvent(`DL resolved: ${winner.id} granted right of way`);
  }
}

function getGridNode(x: number, y: number) {
  let nearest = null;
  let minDist = Infinity;
  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'RACK') continue;
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < minDist) {
      minDist = d;
      nearest = node;
    }
  }
  return nearest;
}

function isMotionState(state: Robot['state']): state is RobotMotionState {
  return state === 'MOVING_TO_PICKUP' || state === 'MOVING_TO_DROPOFF' || state === 'RETURNING_TO_STAGING';
}

function nearestControlNode(x: number, y: number, radius: number): GridNode | null {
  let nearest: GridNode | null = null;
  let nearestDistance = radius;
  for (const node of Object.values(graph.nodes)) {
    if (node.type !== 'JUNCTION' && node.type !== 'AISLE' && node.type !== 'DROP') continue;
    const distance = Math.hypot(node.x - x, node.y - y);
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function upcomingControlNode(robot: Robot, horizon = 1.8): GridNode | null {
  const path = robotPaths[robot.id];
  if (robot.state === 'DROPPING') return nearestControlNode(robot.position.x, robot.position.y, 1.25);
  if (!path || !isMotionState(robot.state) && robot.state !== 'WAITING') return null;
  const remaining = path.totalLength - robot.pathProgress;
  for (const offset of [0, 0.45, 0.9, 1.35, horizon]) {
    const point = path.getPointAtDistance(robot.pathProgress + Math.min(offset, remaining)).position;
    const control = nearestControlNode(point.x, point.y, 0.9);
    if (control) return control;
  }
  return null;
}

function releaseRobotReservations(robotId: string) {
  for (const [nodeId, ownerId] of Object.entries(reservations)) {
    if (ownerId === robotId) delete reservations[nodeId];
  }
}

function updateReservations() {
  const desiredByRobot = new Map<string, GridNode | null>();
  for (const robot of Object.values(robots)) desiredByRobot.set(robot.id, upcomingControlNode(robot));

  for (const [nodeId, ownerId] of Object.entries(reservations)) {
    const owner = robots[ownerId];
    const node = graph.nodes[nodeId];
    if (!owner || !node || owner.state === 'IDLE' || owner.state === 'CHARGING') {
      delete reservations[nodeId];
      continue;
    }
    // A robot may hold only its immediate control point. Releasing the point
    // behind it prevents hold-and-wait cycles across adjacent junctions.
    if (desiredByRobot.get(ownerId)?.id !== nodeId) delete reservations[nodeId];
  }

  for (const robot of Object.values(robots).sort((a, b) => a.id.localeCompare(b.id))) {
    const control = desiredByRobot.get(robot.id);
    if (control && !reservations[control.id]) reservations[control.id] = robot.id;
  }
}

function canAdvance(robot: Robot) {
  const path = robotPaths[robot.id];
  if (!path) return false;
  const ownsRecovery = recoveryOwner === robot.id;
  if (recoveryOwner && !ownsRecovery) return false;
  if (futureBlockedBy[robot.id] && !hasPriorityGrant(robot.id) && !ownsRecovery) return false;
  const routeState = robot.state === 'WAITING' ? robot.resumeState : robot.state;
  const dropZone = robotDropZone(robot);
  if (routeState === 'MOVING_TO_DROPOFF' && dropZone) {
    const gatePreview = path.getPointAtDistance(Math.min(path.totalLength, robot.pathProgress + 1.1)).position;
    if (gatePreview.x > 51 && dispatchOwners[dropZone] !== robot.id) return false;
  }
  if (routeState === 'RETURNING_TO_STAGING' && robot.position.x > 51 && !Object.values(dispatchOwners).includes(robot.id)) return false;

  const heading = path.getPointAtDistance(robot.pathProgress).heading;
  for (const other of Object.values(robots)) {
    if (other.id === robot.id) continue;
    const relativeX = other.position.x - robot.position.x;
    const relativeY = other.position.y - robot.position.y;
    const separation = Math.hypot(relativeX, relativeY);
    if (separation > 1.6) continue;

    const forward = relativeX * Math.cos(heading) + relativeY * Math.sin(heading);
    const lateral = Math.abs(-relativeX * Math.sin(heading) + relativeY * Math.cos(heading));
    const alignment = Math.cos(shortestAngle(other.heading - heading));

    if (separation < 0.94) {
      const escapePoint = path.getPointAtDistance(Math.min(path.totalLength, robot.pathProgress + 0.08)).position;
      const escapeSeparation = Math.hypot(escapePoint.x - other.position.x, escapePoint.y - other.position.y);
      if (escapeSeparation <= separation) return false;
    }

    if (alignment > 0.5) {
      if (!ownsRecovery && forward > 0 && forward < 1.28 && lateral < 0.88) return false;
    }
  }
  return true;
}

function attemptMove(robot: Robot, dt: number) {
  if (canAdvance(robot)) {
    moveRobot(robot, dt);
    return true;
  }
  if (isMotionState(robot.state)) {
    robot.resumeState = robot.state;
    robot.state = 'WAITING';
    robot.velocity = 0;
    robot.angularVelocity = 0;
    robot.waitingTime = 0;
    addEvent(`${robot.id} waiting for clear aisle`);
  }
  return false;
}

function tick(dt: number) {
  simTime += dt;
  assignTasks();
  updateReservations();
  resolveDeadlocks();
  updateDispatchReservations();
  updateFutureMap();
  
  for (const r of Object.values(robots)) {
    const previousState = r.state;
    if (r.state === 'ASSIGNED') {
      const t = tasks[r.taskId!];
      const startNode = getGridNode(r.position.x, r.position.y);
      if (startNode) {
        const route = aStar(graph, startNode.id, t.pickupNodeId, {}, r.id, Math.floor(simTime));
        if (assignRouteAndPath(r, route)) {
          r.state = 'MOVING_TO_PICKUP';
          addEvent(`${r.id} routing to ${t.pickupNodeId}`);
        }
      }
    }
    else if (r.state === 'MOVING_TO_PICKUP') {
      const moved = attemptMove(r, dt);
      if (moved && robotPaths[r.id] && r.pathProgress >= robotPaths[r.id]!.totalLength - 0.01) {
        r.state = 'PICKING';
        r.velocity = 0;
        r.waitingTime = 0;
        addEvent(`${r.id} arrived Pickup`);
      }
    }
    else if (r.state === 'PICKING') {
      r.waitingTime += dt;
      if (r.waitingTime > 1.2) { // 1.2 second pickup per requirements
        r.payload = true;
        r.waitingTime = 0;
        r.state = 'MOVING_TO_DROPOFF';
        addEvent(`${r.id} picked package`);
        
        const t = tasks[r.taskId!];
        const startNode = getGridNode(r.position.x, r.position.y);
        if (startNode) {
          const route = aStar(graph, startNode.id, t.dropNodeId, {}, r.id, Math.floor(simTime));
          assignRouteAndPath(r, route);
          addEvent(`${r.id} routing to ${t.dropNodeId}`);
        }
      }
    }
    else if (r.state === 'MOVING_TO_DROPOFF') {
      const moved = attemptMove(r, dt);
      if (moved && robotPaths[r.id] && r.pathProgress >= robotPaths[r.id]!.totalLength - 0.01) {
        r.state = 'DROPPING';
        r.velocity = 0;
        r.waitingTime = 0;
        addEvent(`${r.id} arrived Dropoff`);
      }
    }
    else if (r.state === 'DROPPING') {
      r.waitingTime += dt;
      if (r.waitingTime > 1.2) { // 1.2 second drop
        r.payload = false;
        r.waitingTime = 0;
        const t = tasks[r.taskId!];
        t.status = 'COMPLETED';
        t.completedAt = simTime;
        completedDurations.push(simTime - t.createdAt);
        r.tasksCompleted++;
        r.taskId = null;
        addEvent(`${r.id} delivered ${t.id}`);

        const startNode = getGridNode(r.position.x, r.position.y);
        const routeHome = startNode ? aStar(graph, startNode.id, r.homeNodeId, {}, r.id, Math.floor(simTime)) : null;
        if (assignRouteAndPath(r, routeHome)) {
          r.state = 'RETURNING_TO_STAGING';
          addEvent(`${r.id} returning to ${r.homeNodeId}`);
        } else {
          r.state = 'IDLE';
          releaseRobotReservations(r.id);
        }
      }
    }
    else if (r.state === 'RETURNING_TO_STAGING') {
      const moved = attemptMove(r, dt);
      if (moved && robotPaths[r.id] && r.pathProgress >= robotPaths[r.id]!.totalLength - 0.01) {
        r.state = 'IDLE';
        r.velocity = 0;
        r.angularVelocity = 0;
        r.route = [];
        r.pathProgress = 0;
        robotPaths[r.id] = null;
        releaseRobotReservations(r.id);
        addEvent(`${r.id} parked at ${r.homeNodeId}`);
      }
    }
    else if (r.state === 'WAITING') {
      r.waitingTime += dt;
      if (r.resumeState && canAdvance(r)) {
        r.state = r.resumeState;
        r.resumeState = null;
        addEvent(`${r.id} aisle clear, resuming`);
      }
    }
    if (r.state !== previousState) {
      const path = robotPaths[r.id];
      const segment = path?.getPointAtDistance(r.pathProgress);
      console.info(`[PHASE A] ${r.id} state=${r.state} segment=${segment ? `${segment.position.x.toFixed(2)},${segment.position.y.toFixed(2)}` : 'none'} heading=${r.heading.toFixed(2)} speed=${r.velocity.toFixed(2)}m/s`);
    } else if (isMotionState(r.state)) {
      const segment = robotPaths[r.id]?.getPointAtDistance(r.pathProgress);
      if (segment) console.debug(`[PHASE A] ${r.id} segment=${segment.position.x.toFixed(2)},${segment.position.y.toFixed(2)} heading=${r.heading.toFixed(2)} speed=${r.velocity.toFixed(2)}m/s state=${r.state}`);
    }
  }
  recordSeparationMetrics();
}

function recordSeparationMetrics() {
  const fleet = Object.values(robots);
  const overlappingNow = new Set<string>();
  for (let i = 0; i < fleet.length; i++) {
    for (let j = i + 1; j < fleet.length; j++) {
      const pair = `${fleet[i].id}:${fleet[j].id}`;
      const separation = Math.hypot(fleet[i].position.x - fleet[j].position.x, fleet[i].position.y - fleet[j].position.y);
      minimumSeparation = Math.min(minimumSeparation, separation);
      if (separation < 0.9) {
        overlappingNow.add(pair);
        if (!activeOverlapPairs.has(pair)) {
          overlapViolations++;
          addEvent(`Separation alert: ${fleet[i].id} / ${fleet[j].id}`);
        }
      }
    }
  }
  activeOverlapPairs = overlappingNow;
}

function publishState() {
  const activeRobots = Object.values(robots).filter(r => r.state !== 'IDLE' && r.state !== 'CHARGING').length;
  const metrics: SimMetrics = {
    activeRobots,
    tasksCompleted: Object.values(robots).reduce((sum, r) => sum + r.tasksCompleted, 0),
    tasksInQueue: Object.values(tasks).filter(t => t.status === 'QUEUED').length,
    avgTaskTime: completedDurations.length ? completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length : 0,
    robotsWaiting: Object.values(robots).filter(r => r.state === 'WAITING').length,
    deadlocksResolved,
    overlapViolations,
    minimumSeparation: Number.isFinite(minimumSeparation) ? minimumSeparation : 0,
    simTime
  };
  self.postMessage({ type: 'STATE_UPDATE', payload: { robots, tasks, events, metrics, simTime, reservations, futureTrajectories, blockedBy: futureBlockedBy } });
}

function moveRobot(r: Robot, dt: number) {
  const path = robotPaths[r.id];
  if (!path) return;
  const previousPosition = { ...r.position };
  const acceleration = 0.9;
  const deceleration = 1.25;
  const angularAcceleration = Math.PI * 3.2;
  const maxAngularSpeed = Math.PI * 0.9;
  const lateralAcceleration = 1.05;
  const remaining = Math.max(0, path.totalLength - r.pathProgress);

  // Estimate local curvature from the path tangent. Curves receive a physical
  // lateral-acceleration speed limit while straight aisles stay at cruise speed.
  const sampleDistance = Math.min(0.35, Math.max(0.05, remaining));
  const headingNow = path.getPointAtDistance(r.pathProgress).heading;
  const headingAhead = path.getPointAtDistance(Math.min(path.totalLength, r.pathProgress + sampleDistance)).heading;
  const curvature = Math.abs(shortestAngle(headingAhead - headingNow)) / sampleDistance;
  const cornerSpeed = curvature > 0.001 ? Math.sqrt(lateralAcceleration / curvature) : r.speed;
  const arrivalSpeed = Math.sqrt(Math.max(0, 2 * deceleration * remaining));
  const speedLimit = Math.min(r.speed, cornerSpeed, arrivalSpeed);
  r.velocity = approach(r.velocity, speedLimit, (r.velocity < speedLimit ? acceleration : deceleration) * dt);

  const movement = Math.min(r.velocity * dt, remaining);
  r.pathProgress = Math.min(path.totalLength, r.pathProgress + movement);
  if (path.totalLength - r.pathProgress < 0.002) {
    r.pathProgress = path.totalLength;
    r.velocity = 0;
  }

  // Look ahead on the same path and steer through the shortest signed angle.
  // Angular acceleration removes the snap at the start and end of each turn.
  const lookAhead = Math.min(path.totalLength, r.pathProgress + Math.max(0.12, r.velocity * 0.22));
  const desiredHeading = path.getPointAtDistance(lookAhead).heading;
  const headingError = shortestAngle(desiredHeading - r.heading);
  const targetAngularVelocity = Math.max(-maxAngularSpeed, Math.min(maxAngularSpeed, headingError * 7.5));
  r.angularVelocity = approach(r.angularVelocity, targetAngularVelocity, angularAcceleration * dt);
  const angularStep = r.angularVelocity * dt;
  if (Math.abs(angularStep) >= Math.abs(headingError)) {
    r.heading = normalizeAngle(desiredHeading);
    r.angularVelocity = 0;
  } else {
    r.heading = normalizeAngle(r.heading + angularStep);
  }

  let traversed = 0;
  r.currentWaypointIndex = path.segments.findIndex(segment => { traversed += segment.length; return traversed >= r.pathProgress; });
  if (r.currentWaypointIndex < 0) r.currentWaypointIndex = path.segments.length;
  r.position = path.getPointAtDistance(r.pathProgress).position;
  const moved = Math.hypot(r.position.x - previousPosition.x, r.position.y - previousPosition.y);
  if (moved > 0.0001) lastFleetProgressAt = simTime;
  r.distanceTraveled += moved;
  r.battery = Math.max(0, 100 - r.distanceTraveled * 0.065 - r.tasksCompleted * 0.18);
}

function approach(current: number, target: number, amount: number) {
  if (current < target) return Math.min(target, current + amount);
  return Math.max(target, current - amount);
}

function shortestAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

init();
self.postMessage({ type: 'INIT_GRAPH', payload: { graph } });
publishState();

const FIXED_DT = 1 / 60;
const FRAME_MS = 1000 / 60;
let tickInterval: number | null = null;
let speed = 1;
let accumulatedSimulationTime = 0;

function frame() {
  if (!isPlaying) return;
  accumulatedSimulationTime += FIXED_DT * speed;
  while (accumulatedSimulationTime >= FIXED_DT) {
    tick(FIXED_DT);
    accumulatedSimulationTime -= FIXED_DT;
  }
  publishState();
}

function startTicker() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(frame, FRAME_MS) as unknown as number;
}

self.onmessage = (e) => {
  if (e.data.type === 'PLAY') {
    isPlaying = true;
    startTicker();
  }
  if (e.data.type === 'PAUSE') {
    isPlaying = false;
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = null;
  }
  if (e.data.type === 'SPEED') {
    speed = e.data.payload;
  }
  if (e.data.type === 'RESET') {
    isPlaying = false;
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = null;
    robots = {};
    tasks = {};
    events = [];
    reservations = {};
    simTime = 0;
    completedDurations = [];
    futureTrajectories = {};
    futureBlockedBy = {};
    waitingSince = {};
    priorityGrantUntil = {};
    deadlocksResolved = 0;
    overlapViolations = 0;
    minimumSeparation = Infinity;
    activeOverlapPairs = new Set<string>();
    resolvedWaitEpisodes = new Set<string>();
    dispatchOwners = {};
    recoveryOwner = null;
    lastFleetProgressAt = 0;
    robotPaths = {};
    accumulatedSimulationTime = 0;
    init();
    publishState();
  }
};

startTicker();
