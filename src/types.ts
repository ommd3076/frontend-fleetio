export type NodeId = string;
export type RobotId = string;
export type TaskId = string;

export interface Position {
  x: number;
  y: number;
}

export type RobotMotionState = 'MOVING_TO_PICKUP' | 'MOVING_TO_DROPOFF' | 'RETURNING_TO_STAGING';
export type RobotState = 'IDLE' | 'ASSIGNED' | RobotMotionState | 'PICKING' | 'DROPPING' | 'WAITING' | 'CHARGING';

export interface RouteStep {
  nodeId: NodeId;
  x: number;
  y: number;
  timeStep: number;
}

export interface Robot {
  id: RobotId;
  position: Position;
  heading: number;
  state: RobotState;
  resumeState: RobotMotionState | null;
  taskId: TaskId | null;
  homeNodeId: NodeId;
  route: RouteStep[];
  pathProgress: number;
  currentWaypointIndex: number;
  speed: number;
  velocity: number;
  angularVelocity: number;
  waitingTime: number;
  tasksCompleted: number;
  battery: number;
  distanceTraveled: number;
  payload: boolean;
}

export interface Task {
  id: TaskId;
  pickupNodeId: NodeId;
  dropNodeId: NodeId;
  priority: number;
  assignedRobotId: RobotId | null;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: number;
  completedAt: number | null;
}

export interface SimEvent {
  id: string;
  time: number;
  text: string;
}

export interface SimMetrics {
  activeRobots: number;
  tasksCompleted: number;
  tasksInQueue: number;
  avgTaskTime: number;
  robotsWaiting: number;
  deadlocksResolved: number;
  overlapViolations: number;
  minimumSeparation: number;
  simTime: number;
}

export interface GridNode {
  id: NodeId;
  x: number;
  y: number;
  type: 'AISLE' | 'RACK' | 'PICKUP' | 'DROP' | 'JUNCTION' | 'CHARGING' | 'STAGING';
  neighbors: NodeId[];
}

export interface WarehouseGraph {
  nodes: Record<NodeId, GridNode>;
  width: number;
  height: number;
}

export interface SimState {
  robots: Record<RobotId, Robot>;
  tasks: Record<TaskId, Task>;
  events: SimEvent[];
  metrics: SimMetrics;
  graph: WarehouseGraph | null;
  selectedRobotId: RobotId | null;
  simulationStatus: 'STOPPED' | 'RUNNING' | 'PAUSED';
  speedMultiplier: number;
  reservations: Record<string, string>;
  futureTrajectories: Record<RobotId, Position[]>;
  blockedBy: Record<RobotId, RobotId>;
}
