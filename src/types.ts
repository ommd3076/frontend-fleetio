export type NodeId=string; export type RobotId=string; export type TaskId=string;
export interface Position { x:number; y:number }
export type RobotMotionState='MOVING_TO_PICKUP'|'MOVING_TO_DROPOFF'|'RETURNING_TO_STAGING'|'MOVING_TO_CHARGER'|'RECOVERING';
export type RobotState='IDLE'|'ASSIGNED'|RobotMotionState|'PICKING'|'DROPPING'|'WAITING'|'CHARGING'|'FAILED';
export type WaitKind='RESOURCE'|'FOLLOWING'|'CLEARANCE'|'NO_ROUTE'|'COMMUNICATION'|'RECOVERY';
export interface RouteStep {nodeId:NodeId;x:number;y:number;timeStep:number}
export interface Robot {
 id:RobotId;position:Position;heading:number;state:RobotState;resumeState:RobotMotionState|null;taskId:TaskId|null;
 homeNodeId:NodeId;route:RouteStep[];pathProgress:number;currentWaypointIndex:number;speed:number;velocity:number;angularVelocity:number;
 waitingTime:number;tasksCompleted:number;battery:number;distanceTraveled:number;payload:boolean;
 waitReason:string|null;waitKind:WaitKind|null;blockedBy:string|null;effectivePriority:number;yieldCount:number;eta:number|null;nextResource:string|null;failed:boolean;
}
export interface Task {
 id:TaskId;pickupNodeId:NodeId;dropNodeId:NodeId;priority:number;assignedRobotId:RobotId|null;
 status:'QUEUED'|'IN_PROGRESS'|'COMPLETED'|'RECOVERY_REQUIRED';createdAt:number;completedAt:number|null;
 flow:'SHELF_TO_PACKING'|'RECEIVING_TO_SHELF'|'PACKING_TO_DISPATCH'|'SHELF_TO_DISPATCH';custodyRobotId:RobotId|null;
}
export interface SimEvent {id:string;time:number;text:string;kind:string;robotId?:string;resourceId?:string}
export interface SimMetrics {
 activeRobots:number;tasksCompleted:number;tasksInQueue:number;avgTaskTime:number;robotsWaiting:number;deadlocksResolved:number;
 overlapViolations:number;minimumSeparation:number;simTime:number;totalDistance:number;throughput:number;utilization:number;avgWaitTime:number;activeConflicts:number;
}
export interface MetricSample {time:number;completed:number;throughput:number;utilization:number;wait:number}
export interface GridNode {id:NodeId;x:number;y:number;type:'AISLE'|'RACK'|'PICKUP'|'DROP'|'JUNCTION'|'CHARGING'|'STAGING'|'REFUGE';neighbors:NodeId[]}
export interface GraphEdge {id:string;from:string;to:string;width:number;narrow:boolean;resourceId:string}
export interface WarehouseGraph {nodes:Record<NodeId,GridNode>;width:number;height:number;edges:Record<string,GraphEdge>}
export interface RackDefinition {id:string;x:number;y:number;width:number;depth:number}
export interface StationDefinition {id:string;label:string;x:number;y:number;kind:'packing'|'receiving'|'dispatch'|'charging'|'staging'}
export interface ResourceDefinition {id:string;kind:'junction'|'narrow'|'charger';x:number;y:number;radius:number;jecId:string|null}
export interface WarehouseLayout {
 width:number;height:number;racks:RackDefinition[];stations:StationDefinition[];verticalAisles:number[];crossAisles:number[];
 resources:ResourceDefinition[];robotFootprint:{width:number;length:number};graph:WarehouseGraph;
}
export interface Reservation {id:string;resourceId:string;robotId:string;start:number;end:number;state:'GRANTED'|'ACTIVE';generation:number;authority:'JEC'|'PEER'}
export interface JecState {id:string;resourceId:string;online:boolean;generation:number;occupancy:string[];queue:string[];reservation:string|null;incoming:{robotId:string;eta:number}[];congestion:number}
export interface ConflictCell {id:string;resourceId:string;members:string[];reason:string}
export interface Incident {id:string;time:number;kind:string;text:string;resourceId?:string;robotId?:string;resolved:boolean}
export type ScenarioId='guided'|'logistics'|'junction'|'narrow'|'following'|'detour'|'fairness'|'deadlock'|'jec-outage'|'robot-failure'|'payload-recovery'|'blocked-aisle'|'network'|'charging';
export interface ScenarioDefinition {id:ScenarioId;label:string;description:string}
export interface ScenarioProgress {stage:string;detail:string;completed:boolean;timedOut:boolean}
export interface ScenarioResult {id:ScenarioId;passed:boolean;timedOut:boolean;simTime:number;tasksCompleted:number;deadlocksResolved:number;overlapViolations:number;avgWaitTime:number;totalDistance:number}
export type SimulationStatus='STOPPED'|'RUNNING'|'PAUSED';
export interface SimulationSnapshot {
 generation:number;sequence:number;graph:WarehouseGraph;robots:Record<RobotId,Robot>;tasks:Record<TaskId,Task>;events:SimEvent[];metrics:SimMetrics;
 reservations:Record<string,string>;reservationWindows:Reservation[];futureTrajectories:Record<RobotId,Position[]>;blockedBy:Record<RobotId,string>;
 jecs:JecState[];conflicts:ConflictCell[];incidents:Incident[];blockedEdges:string[];metricHistory:MetricSample[];scenarioId:ScenarioId;
 scenarioProgress:ScenarioProgress;scenarioResults:ScenarioResult[];simulationStatus:SimulationStatus;networkProfile:'normal'|'degraded';speedMultiplier:number;
}
export interface SimState extends Omit<SimulationSnapshot,'graph'> {graph:WarehouseGraph|null;selectedRobotId:RobotId|null;selectedJecId:string|null}
export type SimulationCommand=
 |{type:'PLAY'|'PAUSE'|'STOP'|'RESET'}|{type:'SET_SPEED';speed:number}|{type:'START_SCENARIO';scenarioId:ScenarioId}
 |{type:'BLOCK_AISLE'|'CLEAR_AISLE';resourceId:string}|{type:'FAIL_ROBOT'|'RECOVER_ROBOT';robotId:string}
 |{type:'DISABLE_JEC'|'ENABLE_JEC';jecId:string}|{type:'SET_NETWORK_PROFILE';profile:'normal'|'degraded'};
export type CameraPreset='overview'|'top'|'follow';
export type ActiveView='Live'|'Analytics'|'Tasks'|'Robots'|'Map'|'Settings';
