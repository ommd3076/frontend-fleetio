import { create } from 'zustand';
import type { SimState, SimulationCommand, ScenarioId, ActiveView, CameraPreset } from './types';
import { initEngine, postSimulationCommand } from './simulation/engine';
interface AppState extends SimState {
 activeView:ActiveView;showRoutes:boolean;showReservations:boolean;showLabels:boolean;showFutures:boolean;
 quality:'low'|'balanced';reducedMotion:boolean;cameraPreset:CameraPreset;cameraRevision:number;focusedNodeId:string|null;runtimeError:string|null;
 updateState:(partial:Partial<SimState>)=>void;setSelectedRobot:(id:string|null)=>void;setSelectedJec:(id:string|null)=>void;
 togglePlay:()=>void;stopSim:()=>void;resetSim:()=>void;setSpeed:(speed:number)=>void;startScenario:(id:ScenarioId)=>void;
 sendCommand:(command:SimulationCommand)=>void;setActiveView:(view:ActiveView)=>void;setToggle:(key:string,value:boolean)=>void;
 setQuality:(quality:'low'|'balanced')=>void;setCamera:(preset:CameraPreset)=>void;focusNode:(id:string)=>void;
}
const send=(command:SimulationCommand)=>{initEngine();postSimulationCommand(command);};
export const useStore=create<AppState>((set,get)=>({
 generation:-1,sequence:-1,robots:{},tasks:{},events:[],graph:null,selectedRobotId:'R01',selectedJecId:null,
 metrics:{activeRobots:0,tasksCompleted:0,tasksInQueue:0,avgTaskTime:0,robotsWaiting:0,deadlocksResolved:0,overlapViolations:0,
 minimumSeparation:0,simTime:0,totalDistance:0,throughput:0,utilization:0,avgWaitTime:0,activeConflicts:0},
 reservations:{},reservationWindows:[],futureTrajectories:{},blockedBy:{},jecs:[],conflicts:[],incidents:[],blockedEdges:[],metricHistory:[],scenarioResults:[],
 scenarioId:'guided',scenarioProgress:{stage:'Ready',detail:'Choose a scenario and press Play.',completed:false,timedOut:false},
 simulationStatus:'STOPPED',networkProfile:'normal',speedMultiplier:1,
 activeView:'Live',showRoutes:true,showReservations:false,showLabels:true,showFutures:false,quality:'low',
 reducedMotion:false,cameraPreset:'overview',cameraRevision:0,focusedNodeId:null,runtimeError:null,
 updateState:(partial)=>set(partial),
 setSelectedRobot:(id)=>set({selectedRobotId:id,selectedJecId:null}),
 setSelectedJec:(id)=>set({selectedJecId:id,selectedRobotId:null}),
 togglePlay:()=>send({type:get().simulationStatus==='RUNNING'?'PAUSE':'PLAY'}),
 stopSim:()=>send({type:'STOP'}),resetSim:()=>send({type:'RESET'}),
 setSpeed:(speed)=>send({type:'SET_SPEED',speed}),
 startScenario:(scenarioId)=>send({type:'START_SCENARIO',scenarioId}),
 sendCommand:send,setActiveView:(activeView)=>set({activeView}),
 setToggle:(key,value)=>{if(['showRoutes','showReservations','showLabels','showFutures','reducedMotion'].includes(key))set({[key]:value});},
 setQuality:(quality)=>set({quality}),
 setCamera:(cameraPreset)=>set(s=>({cameraPreset,cameraRevision:s.cameraRevision+1,focusedNodeId:null})),
 focusNode:(focusedNodeId)=>set(s=>({focusedNodeId,activeView:'Map',cameraPreset:'overview',cameraRevision:s.cameraRevision+1})),
}));
