import type {WarehouseLayout,Robot,Task,Position,RouteStep,RobotMotionState,SimulationCommand,SimulationSnapshot,ScenarioId,Reservation,Incident,JecState,SimEvent,MetricSample,ScenarioProgress,ScenarioResult,ConflictCell} from '../types';
import {MotionPath} from './motionPath';

const distance=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const eid=(a:string,b:string)=>[a,b].sort().join('|');
const clone=<T>(x:T):T=>structuredClone(x);
type RouteRuntime={path:MotionPath;goal:string;mode:RobotMotionState;dwell:number;resumeGoal?:string;resumeMode?:RobotMotionState;recoveryStart?:number;recoveryBlocker?:string;blockerDistance?:number;recoveryReached?:boolean;lastRecoveryAttempt?:number;clearedPivots?:Set<number>};
type GrantMessage={robotId:string;resourceId:string;generation:number;due:number;runGeneration:number};
/** Deterministic, browser-only demonstration. Geometry is authoritative for
 * movement; reservations are entry permissions, never merely decorative. */
export function createSimulation(layout:WarehouseLayout,seed=12345){
 const graph=layout.graph;
 let generation=0,sequence=0,time=0,status:SimulationSnapshot['simulationStatus']='STOPPED',speedMultiplier=1,scenarioId:ScenarioId='logistics';
 let robots:Record<string,Robot>={},tasks:Record<string,Task>={},routes:Record<string,RouteRuntime>={};
 let events:SimEvent[]=[],incidents:Incident[]=[],metricHistory:MetricSample[]=[],grants:Record<string,Reservation>={},blocked=new Set<string>(),jecs:JecState[]=[];
 let messages:GrantMessage[]=[],networkProfile:SimulationSnapshot['networkProfile']='normal',randomState=seed;
 let eventCounter=0,totalWait=0,overlapViolations=0,minimumSeparation=Infinity,deadlocksResolved=0,lastSample=-1,lastAssign=-1;
 let progress:ScenarioProgress={stage:'Ready',detail:'Press Play to begin.',completed:false,timedOut:false};
 let flags=new Set<string>(),scenarioStart=0,guidedIndex=0,lastCycleCheck=0;let scenarioResults:ScenarioResult[]=[];let predictedConflicts:ConflictCell[]=[];let contestedWaits=new Set<string>();
 const guidedStages:ScenarioId[]=['junction','narrow','following','detour','fairness','deadlock','jec-outage','robot-failure','payload-recovery','blocked-aisle','network','charging','logistics'];
 const rand=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const emit=(kind:string,text:string,robotId?:string,resourceId?:string)=>{events.push({id:'E'+(++eventCounter),time,text,kind,...(robotId?{robotId}:{}),...(resourceId?{resourceId}:{})});if(events.length>160)events.shift();flags.add(kind);};
 const incident=(kind:string,text:string,robotId?:string,resourceId?:string)=>{const item:Incident={id:'I'+(++eventCounter),time,kind,text,resolved:false,robotId,resourceId};incidents.push(item);if(incidents.length>40)incidents.shift();emit(kind,text,robotId,resourceId);return item;};
 const resolve=(kind:string,robotId?:string)=>{incidents.filter(i=>i.kind===kind&&(!robotId||i.robotId===robotId)).forEach(i=>i.resolved=true);};
 const nearest=(p:Position)=>Object.values(graph.nodes).filter(n=>n.type!=='RACK').sort((a,b)=>distance(a,p)-distance(b,p)||a.id.localeCompare(b.id))[0]?.id;
 const resourceForEdge=(a:string,b:string)=>graph.edges[eid(a,b)]?.resourceId;
 const findRoute=(start:string,goal:string,robotId:string,avoidCrowding=true,avoidRobots:string[]=[]):RouteStep[]|null=>{
  if(!graph.nodes[start]||!graph.nodes[goal])return null;
  const open=new Set([start]),cost:Record<string,number>={[start]:0},prev:Record<string,string>={};
  while(open.size){const cur=[...open].sort((a,b)=>cost[a]-cost[b]||a.localeCompare(b))[0];open.delete(cur);if(cur===goal){const list=[cur];while(prev[list[0]])list.unshift(prev[list[0]]);return list.map((id,i)=>({...graph.nodes[id],nodeId:id,timeStep:i}));}
   for(const next of graph.nodes[cur].neighbors){const edge=graph.edges[eid(cur,next)],resource=edge?.resourceId;
    if(blocked.has(edge?.id??'')||blocked.has(resource??'')||blocked.has(cur)||blocked.has(next))continue;
    const a=graph.nodes[cur],b=graph.nodes[next];if(avoidRobots.some(id=>robots[id]&&segmentDistance(robots[id].position,a,b)<1.2))continue;let penalty=0;
    if(avoidCrowding){for(const r of Object.values(robots)){if(r.id===robotId)continue;const projection=segmentDistance(r.position,a,b);if(r.failed&&projection<.9){penalty+=500;}else if(projection<1.1&&r.state!=='IDLE')penalty+=(r.state==='WAITING'?9:2)+Math.min(4,r.waitingTime)*.5;}if(edge?.narrow)penalty+=1;}
    const candidate=cost[cur]+Math.max(.01,distance(a,b))+(scenarioActive()==='detour'?penalty*1.35:penalty);
    if(candidate<(cost[next]??Infinity)){cost[next]=candidate;prev[next]=cur;open.add(next);}
   }
  }return null;
 };
 function segmentDistance(p:Position,a:Position,b:Position){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return distance(p,{x:a.x+dx*t,y:a.y+dy*t});}
 function offsetRoute(input:RouteStep[]){
  // Degenerate service nodes share a lane coordinate. Remove them geometrically
  // without losing the final pickup/drop identifier.
  const points:RouteStep[]=[];for(const p of input){if(points.length&&distance(points[points.length-1],p)<1e-5){points[points.length-1]={...p};}else points.push({...p});}
  const normal=(a:RouteStep,b:RouteStep)=>{const edge=graph.edges[eid(a.nodeId,b.nodeId)],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);const offset=edge?.narrow||a.y<5||b.y<5||a.y>41||b.y>41||a.x<1||a.x>15||b.x<1||b.x>15?0:.48;return l?{x:dy/l*offset,y:-dx/l*offset}:{x:0,y:0};};
  return points.map((p,i)=>{if(!i||i===points.length-1)return p;const n=normal(points[i-1],p),m=normal(p,points[i+1]),same=n.x*m.x+n.y*m.y>.15;return{...p,x:p.x+(same?n.x:n.x+m.x),y:p.y+(same?n.y:n.y+m.y)};});
 }
 function setGoal(r:Robot,goal:string,mode:RobotMotionState,detour=false,startOverride?:string,avoidRobots:string[]=[]){
  const start=startOverride??nearest(r.position);if(!start)return false;let raw=findRoute(start,goal,r.id,true,avoidRobots);
  if(scenarioActive()==='narrow'&&mode==='MOVING_TO_DROPOFF'&&!blocked.has('NARROW_1')&&!blocked.has(eid('J_1_3','J_2_3'))){
   const a=r.id==='R01'?'J_1_3':'J_2_3',b=r.id==='R01'?'J_2_3':'J_1_3',first=findRoute(start,a,r.id,false),last=findRoute(b,goal,r.id,false);if(first&&last)raw=[...first,...last];
  }
  if(!raw){r.state='WAITING';r.resumeState=mode;r.waitReason='No clear route';r.waitKind='NO_ROUTE';r.blockedBy=null;r.speed=r.velocity=0;r.route=[];r.eta=null;routes[r.id]={path:new MotionPath([r.position]),goal,mode,dwell:0};emit('NO_ROUTE',r.id+' holds: no route to '+goal,r.id);return false;}
  const path=offsetRoute(raw);if(path.length&&distance(r.position,path[0])>.01)path.unshift({nodeId:start,x:r.position.x,y:r.position.y,timeStep:0});else if(path.length){path[0]={...path[0],...r.position};}
  r.route=path;r.pathProgress=0;r.currentWaypointIndex=0;r.state=mode;r.resumeState=null;r.waitReason=null;r.waitKind=null;r.blockedBy=null;
  routes[r.id]={path:new MotionPath(path,.45),goal,mode,dwell:0};r.eta=routes[r.id].path.totalLength/1.35;
  if(detour){const travel=path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p)/1.35,0);const wait=path.slice(1).reduce((sum,p,i)=>sum+Object.values(robots).filter(o=>o.id!==r.id&&o.state!=='IDLE'&&segmentDistance(o.position,path[i],p)<1.1).reduce((n,o)=>n+(o.state==='WAITING'?9:2),0),0);const fleetDelay=path.slice(1).reduce((sum,p,i)=>sum+Object.values(robots).filter(o=>o.id!==r.id&&o.state!=='IDLE'&&segmentDistance(o.position,path[i],p)<1.1).reduce((n,o)=>n+Math.min(4,o.waitingTime)*.5,0),0);const direct=findRoute(start,goal,r.id,false)??raw;const baselineTravel=direct.slice(1).reduce((sum,p,i)=>sum+distance(direct[i],p)/1.35,0);const baselineWait=direct.slice(1).reduce((sum,p,i)=>sum+Object.values(robots).filter(o=>o.id!==r.id&&o.state!=='IDLE'&&segmentDistance(o.position,direct[i],p)<1.1).reduce((n,o)=>n+(o.state==='WAITING'?9:2),0),0);emit('DETOUR',r.id+' chooses '+path.map(p=>p.nodeId).filter(n=>n.startsWith('J_')).join(' → ')+'; travel '+travel.toFixed(1)+' s, predicted queue '+wait.toFixed(1)+' s, fleet delay '+fleetDelay.toFixed(1)+' s; distance-only route travel '+baselineTravel.toFixed(1)+' s with queue '+baselineWait.toFixed(1)+' s.',r.id);}
  return true;
 }
 function spawn(){robots={};routes={};for(let i=1;i<=10;i++){const id='R'+String(i).padStart(2,'0'),homeNodeId='STG_'+String(i).padStart(2,'0'),p=graph.nodes[homeNodeId];robots[id]={id,position:{x:p.x,y:p.y},heading:Math.PI/2,state:'IDLE',resumeState:null,taskId:null,homeNodeId,route:[],pathProgress:0,currentWaypointIndex:0,speed:0,velocity:0,angularVelocity:0,waitingTime:0,tasksCompleted:0,battery:82+i,distanceTraveled:0,payload:false,waitReason:null,waitKind:null,blockedBy:null,effectivePriority:0,yieldCount:0,eta:null,nextResource:null,failed:false};}}
 function addTask(pickup:string,drop:string,flow:Task['flow'],priority=1){const id='T-'+String(Object.keys(tasks).length+1).padStart(3,'0');tasks[id]={id,pickupNodeId:pickup,dropNodeId:drop,flow,priority,assignedRobotId:null,status:'QUEUED',createdAt:time,completedAt:null,custodyRobotId:null};return tasks[id];}
 function normalTasks(){for(let i=0;i<20;i++){const row=i%6+1,col=['A','B','C'][i%3],svc=col+row+'_'+(i%2?'LEFT':'RIGHT')+'_SERVICE';switch(i%4){case 0:addTask(svc,'PACK_'+(Math.floor(i/4)%2+1),'SHELF_TO_PACKING',3);break;case 1:addTask('REC_1',svc,'RECEIVING_TO_SHELF',2);break;case 2:addTask('PACK_'+(Math.floor(i/4)%2+1),'DISP_'+(Math.floor(i/4)%2+1),'PACKING_TO_DISPATCH',2);break;default:addTask(svc,'DISP_'+(Math.floor(i/4)%2+1),'SHELF_TO_DISPATCH',1);}}}
 function place(id:string,node:string,heading=Math.PI/2){const r=robots[id],p=graph.nodes[node];r.position={x:p.x,y:p.y};r.heading=heading;}
 function mission(id:string,from:string,to:string,priority=1){place(id,from);const r=robots[id],t=addTask(from,to,'SHELF_TO_DISPATCH',priority);t.assignedRobotId=id;t.status='IN_PROGRESS';r.taskId=t.id;r.state='PICKING';routes[id]={path:new MotionPath([r.position]),goal:from,mode:'MOVING_TO_PICKUP',dwell:.6};emit('ASSIGNED',id+' assigned '+t.id,id);}
 function fixture(id:ScenarioId){
  if(id==='logistics'){normalTasks();return;}
  if(id==='junction'||id==='jec-outage'||id==='network'||id==='fairness'){
   mission('R01',id==='fairness'?'J_1_2':'J_1_1','J_1_3',id==='fairness'?4:2);mission('R02','J_0_2','J_2_2',1);
   
   if(id==='network')networkProfile='degraded';return;
  }
  if(id==='narrow'){mission('R01','J_1_2','J_2_5',3);mission('R02','J_2_4','J_1_1',1);return;}
  if(id==='deadlock'){mission('R01','J_1_3','J_2_3',3);mission('R02','J_2_3','J_1_3',1);return;}
  if(id==='following'){mission('R01','LANE_1_1','J_1_5',2);mission('R02','J_1_1','LANE_1_4',1);robots.R01.heading=robots.R02.heading=Math.PI/2;return;}
  if(id==='detour'||id==='blocked-aisle'){mission('R01','J_1_2','J_2_4',2);mission('R02',id==='detour'?'J_2_2':'J_2_1','J_0_4',1);if(id==='detour'){emit('CONGESTION','R02 occupies the direct approach; evaluate a clear alternative.','R02');}return;}
  if(id==='robot-failure'){place('R01','J_1_0');addTask('B3_LEFT_SERVICE','PACK_1','SHELF_TO_PACKING',3);return;}
  if(id==='payload-recovery'){mission('R01','B3_LEFT_SERVICE','PACK_1',3);return;}
  if(id==='charging'){place('R01','J_0_6');place('R02','J_1_6');robots.R01.battery=8;robots.R02.battery=9;place('R03','J_2_5');robots.R03.battery=.03;return;}
 }
 function reset(id:ScenarioId=scenarioId,keepGuided=false){generation++;sequence=0;time=0;scenarioStart=0;randomState=seed;status='STOPPED';scenarioId=id;events=[];incidents=[];metricHistory=[];tasks={};blocked=new Set();grants={};messages=[];networkProfile='normal';eventCounter=0;totalWait=0;overlapViolations=0;minimumSeparation=Infinity;deadlocksResolved=0;lastSample=lastAssign=-1;flags=new Set();contestedWaits=new Set();predictedConflicts=[];lastCycleCheck=0;if(!keepGuided){guidedIndex=0;scenarioResults=[];}
  jecs=layout.resources.filter(r=>r.jecId).map(r=>({id:r.jecId!,resourceId:r.id,online:true,generation:0,occupancy:[],queue:[],reservation:null,incoming:[],congestion:0}));spawn();fixture(id==='guided'?guidedStages[guidedIndex]:id);progress={stage:'Ready',detail:id==='guided'?'Guided stage 1: junction conflict':'Press Play to start '+id,completed:false,timedOut:false};emit('READY','Browser simulation ready: '+id);
 }
 function failRobot(id:string){const r=robots[id];if(!r||r.failed)return;r.failed=true;r.state='FAILED';r.velocity=r.speed=0;incident('ROBOT_FAILURE',id+' stopped '+(r.payload?'with payload custody retained.':'before pickup; task released.'),id);for(const key of Object.keys(grants))if(grants[key].robotId===id&&!insideResource(r,key))delete grants[key];if(r.taskId){const t=tasks[r.taskId];if(t.status==='COMPLETED'){r.taskId=null;}else if(r.payload){t.status='RECOVERY_REQUIRED';t.custodyRobotId=id;emit('CUSTODY',t.id+' remains on '+id+' pending explicit recovery.',id);}else{t.status='QUEUED';t.assignedRobotId=null;r.taskId=null;emit('REASSIGN',t.id+' returned to queue.',id);}}}
 function recoverRobot(id:string){const r=robots[id];if(!r?.failed)return;r.failed=false;resolve('ROBOT_FAILURE',id);emit('RECOVERED',id+' operator recovery confirmed.',id);if(r.payload&&r.taskId){const t=tasks[r.taskId];t.status='IN_PROGRESS';setGoal(r,t.dropNodeId,'MOVING_TO_DROPOFF');}else{setGoal(r,r.homeNodeId,'RETURNING_TO_STAGING');}}
 function jecOnline(id:string,online:boolean){const j=jecs.find(j=>j.id===id);if(!j||j.online===online)return;j.online=online;j.generation++;const g=grants[j.resourceId];if(g){if(insideResource(robots[g.robotId],j.resourceId)){g.generation=j.generation;g.authority=online?'JEC':'PEER';}else delete grants[j.resourceId];}emit(online?'JEC_RESTORED':'JEC_FALLBACK',j.id+(online?' restored; stale grants invalidated.':' offline; peers arbitrate by the same priority policy.'),undefined,j.resourceId);}
 function block(resourceId:string,on:boolean){if(on){blocked.add(resourceId);incident('BLOCKAGE',resourceId+' obstructed; affected robots replan.',undefined,resourceId);}else{blocked.delete(resourceId);resolve('BLOCKAGE');emit('CLEAR',resourceId+' obstruction cleared.',undefined,resourceId);}for(const r of Object.values(robots)){const rt=routes[r.id];if(!rt||r.failed||(!r.route.length&&r.waitReason!=='No clear route'))continue;const affected=r.route.some((p,i)=>p.nodeId===resourceId||(i&&resourceForEdge(r.route[i-1].nodeId,p.nodeId)===resourceId)||(i&&eid(r.route[i-1].nodeId,p.nodeId)===resourceId));if(affected||r.waitReason==='No clear route')setGoal(r,rt.goal,rt.mode,true);}}
 function dispatch(command:SimulationCommand){switch(command.type){case'PLAY':if(status==='STOPPED'){const id=scenarioId;reset(id);}status='RUNNING';progress.stage='Running';progress.detail='Waiting for measured scenario outcomes';break;case'PAUSE':if(status==='RUNNING')status='PAUSED';break;case'STOP':status='STOPPED';emit('STOP','Run stopped; final state retained.');break;case'RESET':reset();break;case'SET_SPEED':if([.5,1,2].includes(command.speed))speedMultiplier=command.speed;break;case'START_SCENARIO':reset(command.scenarioId);status='RUNNING';progress.stage='Running';break;case'FAIL_ROBOT':failRobot(command.robotId);break;case'RECOVER_ROBOT':recoverRobot(command.robotId);break;case'DISABLE_JEC':jecOnline(command.jecId,false);break;case'ENABLE_JEC':jecOnline(command.jecId,true);break;case'BLOCK_AISLE':block(command.resourceId,true);break;case'CLEAR_AISLE':block(command.resourceId,false);break;case'SET_NETWORK_PROFILE':networkProfile=command.profile;emit('NETWORK',command.profile==='degraded'?'Network latency 350–950 ms with seeded 25% request loss.':'Normal communications restored.');break;}}
 function assign(){
  for(const r of Object.values(robots).filter(r=>!r.failed&&r.state==='IDLE'&&r.battery<18)){const charger=layout.stations.filter(s=>s.kind==='charging').sort((a,b)=>distance(r.position,a)-distance(r.position,b))[0];setGoal(r,charger.id,'MOVING_TO_CHARGER');emit('LOW_BATTERY',r.id+' seeks exclusive '+charger.id,r.id,charger.id);}
  const queue=Object.values(tasks).filter(t=>t.status==='QUEUED').sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  for(const t of queue){const stationIds=[t.pickupNodeId,t.dropNodeId].filter(id=>layout.stations.some(q=>q.id===id&&q.kind!=='staging'));if(Object.values(tasks).some(other=>other.id!==t.id&&(other.status==='IN_PROGRESS'||Object.values(robots).some(r=>r.taskId===other.id&&r.state!=='IDLE'))&&stationIds.some(id=>other.pickupNodeId===id||other.dropNodeId===id)))continue;const idle=Object.values(robots).filter(r=>r.state==='IDLE'&&!r.failed&&r.battery>=18).sort((a,b)=>a.tasksCompleted-b.tasksCompleted||distance(a.position,graph.nodes[t.pickupNodeId])-distance(b.position,graph.nodes[t.pickupNodeId])||a.id.localeCompare(b.id));if(!idle.length)break;const r=idle[0];r.taskId=t.id;t.status='IN_PROGRESS';t.assignedRobotId=r.id;setGoal(r,t.pickupNodeId,'MOVING_TO_PICKUP');emit('ASSIGNED',r.id+' assigned '+t.id+' ('+t.flow.toLowerCase().replaceAll('_',' ')+')',r.id);}
 }
 function insideResource(r:Robot,key:string){if(!r)return false;if(key==='STAGING_ZONE')return r.position.y<5.8;if(key==='TERMINAL_ZONE')return r.position.y>36.5;const resource=layout.resources.find(q=>q.id===key);if(resource)return distance(r.position,resource)<resource.radius+.65;const edge=graph.edges[key];return !!edge&&segmentDistance(r.position,graph.nodes[edge.from],graph.nodes[edge.to])<.75&&distance(r.position,graph.nodes[edge.from])> .1&&distance(r.position,graph.nodes[edge.to])>.1;}
 function resourceAt(p:Position,r:Robot):string[]{const keys:string[]=p.y<5.8?['STAGING_ZONE']:p.y>36.5?['TERMINAL_ZONE']:[];keys.push(...layout.resources.filter(q=>distance(p,q)<q.radius+.65).map(q=>q.id));for(let i=1;i<r.route.length;i++){const edge=graph.edges[eid(r.route[i-1].nodeId,r.route[i].nodeId)];if(edge?.narrow&&edge.resourceId!=='NARROW_1'&&segmentDistance(p,graph.nodes[edge.from],graph.nodes[edge.to])<.68){const a=graph.nodes[edge.from],b=graph.nodes[edge.to];if(distance(p,a)<distance(a,b)+.5&&distance(p,b)<distance(a,b)+.5)keys.push(edge.id);}}return [...new Set(keys)];}
 function resourceRequests(){const requests:Record<string,Robot[]>={};
  for(const r of Object.values(robots)){const rt=routes[r.id];if(!rt||r.failed||r.state==='IDLE'||r.state==='PICKING'||r.state==='DROPPING')continue;const preview=Array.from({length:9},(_,i)=>rt.path.getPointAtDistance(r.pathProgress+i*.2).position);const keys=[...new Set(preview.flatMap(p=>resourceAt(p,r)))];r.nextResource=keys[0]??null;for(const key of keys){(requests[key]??=[]).push(r);}}
  predictedConflicts=Object.entries(requests).filter(([key,list])=>list.length>1&&layout.resources.some(z=>z.id===key)).map(([key,list])=>({id:"P-"+key,resourceId:key,members:list.map(r=>r.id),reason:"Future intents contend for exclusive entry"}));for(const conflict of predictedConflicts){for(const id of conflict.members)contestedWaits.add(conflict.resourceId+"|"+id);if(!flags.has("PREDICTED_"+conflict.resourceId)){emit("PREDICTED_CONFLICT",conflict.members.join(" / ")+" future intents intersect at "+conflict.resourceId,undefined,conflict.resourceId);flags.add("PREDICTED_"+conflict.resourceId);}}for(const [key,g] of Object.entries(grants)){const r=robots[g.robotId];if(!r||(!insideResource(r,key)&&!requests[key]?.some(q=>q.id===r.id))||(r.state==='IDLE'&&(key==='STAGING_ZONE'||!insideResource(r,key)))){delete grants[key];emit('RELEASE',g.robotId+' releases '+key,g.robotId,key);}}
  const pending:GrantMessage[]=[];for(const m of messages){if(m.due>time){pending.push(m);continue;}const j=jecs.find(j=>j.resourceId===m.resourceId);if(m.runGeneration!==generation||m.generation!==(j?.generation??0)){emit('STALE_GRANT','Rejected stale grant for '+m.resourceId,m.robotId,m.resourceId);continue;}if(!grants[m.resourceId]&&requests[m.resourceId]?.some(r=>r.id===m.robotId)){grant(m.resourceId,m.robotId,(requests[m.resourceId]?.length??0)>1);}}messages=pending;
  for(const [key,list] of Object.entries(requests)){list.sort((a,b)=>(key==='TERMINAL_ZONE'?b.position.y-a.position.y:0)||priority(b)-priority(a)||a.id.localeCompare(b.id));if(grants[key]||messages.some(m=>m.resourceId===key))continue;const occupant=key!=='STAGING_ZONE'&&key!=='TERMINAL_ZONE'?Object.values(robots).find(r=>insideResource(r,key)):undefined;const winner=occupant??list[0];if(networkProfile==='degraded'&&!occupant){if(rand()<.25){if(!flags.has('PACKET_LOSS'))emit('PACKET_LOSS','Coordination request lost; robots hold and retry.',winner.id,key);continue;}const j=jecs.find(j=>j.resourceId===key);messages.push({robotId:winner.id,resourceId:key,generation:j?.generation??0,runGeneration:generation,due:time+.35+rand()*.6});}else grant(key,winner.id,list.length>1);}
  for(const j of jecs){j.occupancy=Object.values(robots).filter(r=>insideResource(r,j.resourceId)).map(r=>r.id);j.queue=(requests[j.resourceId]??[]).filter(r=>grants[j.resourceId]?.robotId!==r.id).map(r=>r.id);j.reservation=grants[j.resourceId]?.robotId??null;j.incoming=(requests[j.resourceId]??[]).map(r=>({robotId:r.id,eta:distance(r.position,layout.resources.find(q=>q.id===j.resourceId)!)/1.35}));j.congestion=j.queue.length;}
  return requests;
 }
 function priority(r:Robot){const base=r.taskId?tasks[r.taskId]?.priority??1:1;return base+r.waitingTime*.65+(routes[r.id]?.mode==='RECOVERING'?10000:0)+r.yieldCount*2+(scenarioActive()==='logistics'&&grants.TERMINAL_ZONE?.robotId===r.id?1000:0);}
 function grant(key:string,id:string,contested=false){const j=jecs.find(j=>j.resourceId===key);grants[key]={id:'G'+(++eventCounter),resourceId:key,robotId:id,start:time,end:time+12,state:'GRANTED',generation:j?.generation??0,authority:j?.online===false?'PEER':'JEC'};emit('GRANT',id+' receives '+key+' ('+(j?.online===false?'peer fallback':'reservation')+')',id,key);if((contested||contestedWaits.has(key+"|"+id))&&robots[id].waitingTime>2)emit('FAIR_ACCESS',id+' aging priority wins access.',id,key);}
 function overlaps(a:Position,ah:number,b:Position,bh:number,margin=.055){const axes=[[Math.cos(ah),Math.sin(ah)],[-Math.sin(ah),Math.cos(ah)],[Math.cos(bh),Math.sin(bh)],[-Math.sin(bh),Math.cos(bh)]];const halfL=layout.robotFootprint.length/2+margin,halfW=layout.robotFootprint.width/2+margin;return axes.every(([x,y])=>{const projection=Math.abs((b.x-a.x)*x+(b.y-a.y)*y);const extent=(h:number)=>Math.abs(Math.cos(h)*x+Math.sin(h)*y)*halfL+Math.abs(-Math.sin(h)*x+Math.cos(h)*y)*halfW;return projection<extent(ah)+extent(bh);});}
 function safeStatic(p:Position,h:number){const halfL=layout.robotFootprint.length/2+.03,halfW=layout.robotFootprint.width/2+.03,cos=Math.cos(h),sin=Math.sin(h);const dx=Math.abs(cos)*halfL+Math.abs(sin)*halfW,dy=Math.abs(sin)*halfL+Math.abs(cos)*halfW;if(p.x-dx<-.02||p.x+dx>layout.width+.02||p.y-dy<-.02||p.y+dy>layout.height+.02)return false;for(const rack of layout.racks){const intersects=[[1,0],[0,1],[cos,sin],[-sin,cos]].every(([x,y])=>Math.abs((rack.x-p.x)*x+(rack.y-p.y)*y)<Math.abs(cos*x+sin*y)*halfL+Math.abs(-sin*x+cos*y)*halfW+Math.abs(x)*rack.width/2+Math.abs(y)*rack.depth/2);if(intersects)return false;}return true;}
 function hold(r:Robot,why:string,blocker:string|null){if(r.state!=='WAITING'){r.resumeState=routes[r.id]?.mode??'MOVING_TO_PICKUP';r.state='WAITING';emit('WAIT',r.id+' holds: '+why,r.id,r.nextResource??undefined);}r.waitReason=why;r.waitKind=why.includes('coordination')?'COMMUNICATION':why.includes('resource')||why.includes('Resource')?'RESOURCE':why.includes('separation')||why.includes('Following')?'FOLLOWING':'CLEARANCE';r.blockedBy=blocker;r.speed=r.velocity=0;}
 function arrived(r:Robot,rt:RouteRuntime){r.velocity=r.speed=0;r.eta=0;r.route=[];r.waitReason=null;r.waitKind=null;if(rt.mode==='MOVING_TO_PICKUP'){r.state='PICKING';rt.dwell=.8;emit('PICKING',r.id+' handling pickup.',r.id);}else if(rt.mode==='MOVING_TO_DROPOFF'){r.state='DROPPING';rt.dwell=.8;}else if(rt.mode==='MOVING_TO_CHARGER'){r.state='CHARGING';emit('CHARGING',r.id+' charging at '+rt.goal,r.id,rt.goal);}else if(rt.mode==='RECOVERING'){rt.recoveryReached=true;r.state='WAITING';r.waitReason='At clear refuge; awaiting blocked robot progress';r.waitKind='RECOVERY';r.blockedBy=null;emit('REFUGE_REACHED',r.id+' is clear of traffic; holds for '+rt.recoveryBlocker+' to resume.',r.id);}else{r.state='IDLE';r.taskId=null;r.eta=null;delete routes[r.id];emit('RETURNED',r.id+' returned to its bay.',r.id);}}
 function movement(dt:number){
  const movers=Object.values(robots).filter(r=>routes[r.id]&&!routes[r.id].recoveryReached&&!r.failed&&['MOVING_TO_PICKUP','MOVING_TO_DROPOFF','RETURNING_TO_STAGING','MOVING_TO_CHARGER','RECOVERING','WAITING'].includes(r.state));
  const proposals=new Map<string,{p:Position;h:number;d:number;v:number;turn:number;predictiveBlocker:string|null;pivot:number|null}>();
  for(const r of movers){const rt=routes[r.id];if(rt.path.totalLength<1e-5){if(r.waitReason==='No clear route'){if(Math.floor(time*2)!==Math.floor((time-dt)*2))setGoal(r,rt.goal,rt.mode);continue;}arrived(r,rt);continue;}
   const pivot=rt.path.pivots.find(p=>!rt.clearedPivots?.has(p)&&p>=r.pathProgress-1e-7);let lookahead=.12,segmentOffset=0;for(const segment of rt.path.segments){if(segment.type==='ARC'&&segmentOffset+segment.length>r.pathProgress&&segmentOffset<r.pathProgress+.12)lookahead=Math.min(lookahead,Math.max(.001,segment.radius!*.15));segmentOffset+=segment.length;}const target=rt.path.getPointAtDistance(Math.min(rt.path.totalLength,r.pathProgress+lookahead,pivot===undefined?Infinity:pivot-1e-7)),reverse=rt.mode==='RECOVERING'&&Math.abs(angle(target.heading-r.heading))>Math.PI/2,difference=angle(target.heading+(reverse?Math.PI:0)-r.heading),turn=Math.max(-2.6*dt,Math.min(2.6*dt,difference)),h=angle(r.heading+turn);
   const remaining=rt.path.totalLength-r.pathProgress,maxSpeed=r.id==='R01'?(scenarioActive()==='following'?.65:scenarioActive()==='fairness'?.2:1.35):1.35;
   let predictiveBlocker:string|null=null;let desired=Math.min(remaining*5,Math.abs(difference)>1&&rt.mode!=='RECOVERING'?0:Math.abs(difference)>.35?.12:maxSpeed,Math.max(0,Math.sqrt(Math.max(0,2*.85*remaining+(.85*dt)**2))-.85*dt));
   if(pivot!==undefined){const toPivot=Math.max(0,pivot-r.pathProgress);desired=Math.min(desired,toPivot*5,Math.max(0,Math.sqrt(2*.85*toPivot+(.85*dt)**2)-.85*dt));}let segmentStart=0;
   for(const segment of rt.path.segments){const segmentEnd=segmentStart+segment.length;if(segment.type==='ARC'&&segmentEnd>=r.pathProgress){const curveSpeed=Math.min(maxSpeed,segment.radius!*1.8),toCurve=Math.max(0,segmentStart-r.pathProgress-.025);desired=Math.min(desired,Math.sqrt(curveSpeed*curveSpeed+2*.85*toCurve));}segmentStart=segmentEnd;}
   const dir={x:Math.cos(target.heading),y:Math.sin(target.heading)};
   for(const other of Object.values(robots)){if(other.id===r.id)continue;const dx=other.position.x-r.position.x,dy=other.position.y-r.position.y,ahead=dx*dir.x+dy*dir.y,lateral=Math.abs(dx*dir.y-dy*dir.x);
    if(ahead>0&&lateral<.85&&Math.abs(angle(other.heading-target.heading))<.35){const gap=Math.max(0,ahead-layout.robotFootprint.length-.18),limit=Math.sqrt(2*.85*gap);if(limit<desired){desired=limit;if(scenarioActive()==='following'&&r.id==='R02'&&!flags.has('FOLLOWING'))emit('FOLLOWING','R02 slows behind R01 using measured following gap '+gap.toFixed(2)+' m.',r.id);}}
   }
   const brakingDistance=r.velocity*r.velocity/(2*.85)+.18;
   // Brake before a stationary or opposing footprint, allowing both agents
   // their remaining stopping distance. The same-direction follower above
   // controls its own gap; it must not force the leading robot to stop.
   for(let ahead=.08;ahead<=brakingDistance+.08;ahead+=.08){const sample=rt.path.getPointAtDistance(r.pathProgress+ahead);let obstacle=false;
    for(const other of Object.values(robots)){if(other.id===r.id||Math.abs(angle(other.heading-target.heading))<.35&&other.velocity>0)continue;
     const forward=(other.position.x-r.position.x)*dir.x+(other.position.y-r.position.y)*dir.y;if(forward<=0)continue;
     const stopping=other.velocity*other.velocity/(2*.85),otherRoute=routes[other.id];
     for(const fraction of [0,.5,1]){const future=otherRoute&&!other.failed?otherRoute.path.getPointAtDistance(other.pathProgress+stopping*fraction):{position:other.position,heading:other.heading};if(overlaps(sample.position,rt.mode==='RECOVERING'?r.heading:sample.heading,future.position,stopping<.000001?other.heading:future.heading,.055)){obstacle=true;predictiveBlocker=other.id;break;}}if(obstacle)break;
    }if(obstacle){desired=Math.min(desired,Math.sqrt(2*.85*Math.max(0,ahead-.16)));break;}
   }
   for(let ahead=.08;ahead<=brakingDistance+.08;ahead+=.08){const p=rt.path.getPointAtDistance(r.pathProgress+ahead).position;const denied=resourceAt(p,r).some(key=>grants[key]?.robotId!==r.id&&! (rt.mode==='RECOVERING'&&insideResource(r,key)));if(denied){desired=Math.min(desired,Math.sqrt(2*.85*Math.max(0,ahead-.16)));break;}}
   let v=Math.max(0,r.velocity+Math.max(-.85*dt,Math.min(.75*dt,desired-r.velocity))),d=Math.min(rt.path.totalLength,r.pathProgress+v*dt,pivot??Infinity);const reachedPivot=pivot!==undefined&&pivot-d<.0001&&v<=.85*dt;if(reachedPivot){d=pivot;v=0;}const p=rt.path.getPointAtDistance(d).position;const rotationBlocked=Object.values(robots).some(other=>other.id!==r.id&&overlaps(p,h,other.position,other.heading));proposals.set(r.id,{p,h:rt.mode==='RECOVERING'&&rotationBlocked?r.heading:h,d,v,turn:rt.mode==='RECOVERING'&&rotationBlocked?0:turn,predictiveBlocker,pivot:reachedPivot?pivot!:null});
  }
  // Phase two resolves against both pre-tick and proposed footprints. An agent
  // cannot step into space another agent has merely proposed to vacate.
  for(const r of movers.sort((a,b)=>priority(b)-priority(a)||a.id.localeCompare(b.id))){const q=proposals.get(r.id);if(!q)continue;let reason='',blocker:string|null=null;
   for(const key of resourceAt(q.p,r)){const g=grants[key],resource=layout.resources.find(z=>z.id===key),escaping=routes[r.id].mode==='RECOVERING'&&resource&&insideResource(r,key)&&distance(q.p,resource)>=distance(r.position,resource)-1e-6;if((!g||g.robotId!==r.id)&&!escaping){reason=networkProfile==='degraded'&&!g?'Awaiting coordination message':'Resource '+key+' reserved';blocker=g?.robotId??null;break;}if(g&&g.robotId===r.id){g.state='ACTIVE';g.end=time+12;}}
   if(!reason&&q.v<.00001&&q.predictiveBlocker){reason='Predictive separation from '+q.predictiveBlocker;blocker=q.predictiveBlocker;}if(!reason&&q.v<.00001){const ahead=routes[r.id].path.getPointAtDistance(r.pathProgress+.32).position;for(const key of resourceAt(ahead,r)){if(grants[key]?.robotId!==r.id){reason='Awaiting resource '+key;blocker=grants[key]?.robotId??null;break;}}}if(!reason&&q.v<.00001){const dir={x:Math.cos(q.h),y:Math.sin(q.h)};const ahead=Object.values(robots).find(o=>o.id!==r.id&&(o.position.x-r.position.x)*dir.x+(o.position.y-r.position.y)*dir.y>0&&Math.abs((o.position.x-r.position.x)*dir.y-(o.position.y-r.position.y)*dir.x)<.85&&distance(o.position,r.position)<1.4);if(ahead){reason='Following hold behind '+ahead.id;blocker=ahead.id;}}if(!reason&&!safeStatic(q.p,q.h))reason='Footprint clearance';
   if(!reason){for(const other of Object.values(robots)){if(other.id===r.id)continue;if(overlaps(q.p,q.h,other.position,other.heading)){reason='Safe separation from '+other.id;blocker=other.id;break;}}}
   if(reason){hold(r,reason,blocker);r.waitingTime+=dt;totalWait+=dt;r.effectivePriority=priority(r);continue;}
   if(q.pivot!==null){routes[r.id].clearedPivots??=new Set();routes[r.id].clearedPivots!.add(q.pivot);}const traveled=distance(r.position,q.p);if(traveled>.000001)r.waitingTime=0;r.distanceTraveled+=traveled;r.battery=Math.max(0,r.battery-traveled*.018-dt*.0015);r.position=q.p;r.angularVelocity=q.turn/dt;r.heading=q.h;r.pathProgress=q.d;r.speed=r.velocity=q.v;r.state=routes[r.id].mode;r.waitReason=null;r.waitKind=null;r.blockedBy=null;r.effectivePriority=priority(r);r.eta=(routes[r.id].path.totalLength-q.d)/Math.max(.3,q.v);r.currentWaypointIndex=Math.max(0,r.route.findIndex(p=>distance(p,q.p)<1));
   if(r.battery===0){failRobot(r.id);emit('DEPLETED',r.id+' battery depleted; movement stopped.',r.id);}else if(q.d>=routes[r.id].path.totalLength-1e-4&&q.v<=.85*dt)arrived(r,routes[r.id]);
  }
 }
 function dwell(dt:number){for(const r of Object.values(robots)){if(r.failed)continue;const rt=routes[r.id];if(rt?.recoveryReached){const other=rt.recoveryBlocker?robots[rt.recoveryBlocker]:null;if(other&&!other.failed&&(other.distanceTraveled>(rt.blockerDistance??0)+4||(other.state==='IDLE'&&other.distanceTraveled>(rt.blockerDistance??0)+.5))){deadlocksResolved++;emit('DEADLOCK_RESOLVED',r.id+' cleared the refuge and '+other?.id+' resumed progress.',r.id);resolve('DEADLOCK',r.id);r.yieldCount++;setGoal(r,rt.resumeGoal!,rt.resumeMode!);}else{r.waitingTime+=dt;totalWait+=dt;}continue;}if(r.state==='CHARGING'){r.battery=Math.min(100,r.battery+dt*3);if(r.battery>=85){emit('CHARGED',r.id+' charged to '+r.battery.toFixed(0)+'%.',r.id);flags.add('CHARGED_'+r.id);setGoal(r,r.homeNodeId,'RETURNING_TO_STAGING');}continue;}if(!rt||!['PICKING','DROPPING'].includes(r.state))continue;rt.dwell-=dt;if(rt.dwell>0)continue;const t=tasks[r.taskId!];if(r.state==='PICKING'){r.payload=true;t.custodyRobotId=r.id;emit('PICKUP',r.id+' picked up '+t.id+' at '+t.pickupNodeId,r.id);setGoal(r,t.dropNodeId,'MOVING_TO_DROPOFF',scenarioActive()==='detour');}else{r.payload=false;t.custodyRobotId=null;t.status='COMPLETED';t.completedAt=time;r.tasksCompleted++;emit('DELIVERED',r.id+' delivered '+t.id+' at '+t.dropNodeId,r.id);setGoal(r,r.homeNodeId,'RETURNING_TO_STAGING');}}}
 function cycleRecovery(){
  const candidates=Object.values(robots).filter(r=>r.state==='WAITING'&&r.blockedBy&&r.waitingTime>2),handled=new Set<string>();
  for(const r of candidates){
   const cycle:string[]=[r.id];let next=r.blockedBy;while(next&&robots[next]?.state==='WAITING'&&!cycle.includes(next)){cycle.push(next);next=robots[next].blockedBy;}if(next!==r.id||cycle.some(id=>handled.has(id)))continue;cycle.forEach(id=>handled.add(id));
   const existing=cycle.find(id=>routes[id]?.mode==='RECOVERING');
   for(const key of Object.keys(grants)){const g=grants[key];if(cycle.includes(g.robotId)&&g.robotId!==existing&&!insideResource(robots[g.robotId],key)){delete grants[key];emit('RELEASE',g.robotId+' releases unoccupied claim for safe recovery.',g.robotId,key);}}
   const yielding=existing?robots[existing]:cycle.map(id=>robots[id]).sort((a,b)=>priority(a)-priority(b)||b.id.localeCompare(a.id))[0],old=routes[yielding.id];
   if(existing&&(old.recoveryReached||time-(old.lastRecoveryAttempt??0)<4))continue;
   const blocker=robots[yielding.blockedBy!],avoid=cycle.filter(id=>id!==yielding.id);
   const behind=yielding.route.filter(p=>!blocker||(p.x-yielding.position.x)*(blocker.position.x-yielding.position.x)+(p.y-yielding.position.y)*(blocker.position.y-yielding.position.y)<-.1).sort((a,b)=>distance(a,yielding.position)-distance(b,yielding.position))[0]?.nodeId;
   const start=behind??nearest(yielding.position);if(!start)continue;
   const refuges=Object.values(graph.nodes).filter(n=>n.type==='REFUGE').sort((a,b)=>distance(yielding.position,a)-distance(yielding.position,b));
   const refuge=refuges.find(n=>!Object.values(robots).some(o=>o.id!==yielding.id&&distance(o.position,n)<1.5)&&findRoute(start,n.id,yielding.id,true,avoid));if(!refuge)continue;
   if(!existing)incident('DEADLOCK','Wait cycle '+cycle.join(' → ')+' → '+r.id+'; '+yielding.id+' yields to '+refuge.id,yielding.id);
   if(setGoal(yielding,refuge.id,'RECOVERING',true,start,avoid)){
    const rt=routes[yielding.id];rt.resumeGoal=existing?old.resumeGoal:old.goal;rt.resumeMode=existing?old.resumeMode:old.mode;rt.recoveryStart=existing?old.recoveryStart:yielding.distanceTraveled;rt.recoveryBlocker=existing?old.recoveryBlocker:blocker?.id;rt.blockerDistance=existing?old.blockerDistance:blocker?.distanceTraveled;rt.lastRecoveryAttempt=time;
   }
  }
 } function scenarioActive(){return scenarioId==='guided'?guidedStages[guidedIndex]:scenarioId;}
 function scenarioAutomation(){const id=scenarioActive(),elapsed=time-scenarioStart;
  if(id==='jec-outage'){if(elapsed>2&&!flags.has('JEC_FALLBACK'))jecOnline('JEC-1',false);if(elapsed>13&&!flags.has('JEC_RESTORED'))jecOnline('JEC-1',true);}
  if(id==='robot-failure'&&!flags.has('ROBOT_FAILURE')){const r=Object.values(robots).find(r=>r.taskId&&r.state==='MOVING_TO_PICKUP'&&!r.payload);if(r&&elapsed>2)failRobot(r.id);}
  if(id==='payload-recovery'&&!flags.has('ROBOT_FAILURE')){const r=Object.values(robots).find(r=>r.payload&&r.state==='MOVING_TO_DROPOFF');if(r&&elapsed>2)failRobot(r.id);}
  if(id==='payload-recovery'&&flags.has('CUSTODY')&&!flags.has('RECOVERED')){progress.stage='Operator action';progress.detail='Payload remains on failed robot. Select it and press Recover robot.';if(scenarioId==='guided'&&elapsed>8){emit('OPERATOR','Guided operator recovery command issued.');recoverRobot('R01');}}
  if(id==='blocked-aisle'){if(elapsed>2&&!flags.has('BLOCKAGE')){const r=robots.R01,edge=r.route.slice(1).map((p,i)=>eid(r.route[i].nodeId,p.nodeId)).find(key=>graph.edges[key]&&key.includes('J_'));if(edge)block(edge,true);}if(elapsed>16&&!flags.has('CLEAR'))for(const key of [...blocked])block(key,false);}
  const completed=Object.values(tasks).filter(t=>t.status==='COMPLETED').length,returned=Object.values(robots).every(r=>r.state==='IDLE'||r.failed);
  const outcomes:Record<string,boolean>={logistics:completed===20&&returned,junction:flags.has('WAIT')&&completed>=2,narrow:flags.has('WAIT')&&completed>=2,following:flags.has('FOLLOWING')&&completed>=2,detour:flags.has('DETOUR')&&completed>=2,fairness:flags.has('FAIR_ACCESS')&&completed>=2,deadlock:deadlocksResolved>0&&completed>=2,'jec-outage':flags.has('JEC_FALLBACK')&&flags.has('JEC_RESTORED')&&completed>=2,'robot-failure':flags.has('REASSIGN')&&completed>=1,'payload-recovery':flags.has('CUSTODY')&&flags.has('RECOVERED')&&completed>=1,'blocked-aisle':flags.has('DETOUR')&&flags.has('CLEAR')&&completed>=2,network:flags.has('PACKET_LOSS')&&flags.has('WAIT')&&completed>=2,charging:flags.has('CHARGED')&&['R01','R02'].every(id=>flags.has('CHARGED_'+id)&&robots[id].state==='IDLE')};
  if(outcomes[id]&&!progress.completed){progress={stage:'Passed',detail:id+' outcomes verified from simulation events.',completed:true,timedOut:false};const m=metrics();scenarioResults.push({id,passed:true,timedOut:false,simTime:time,tasksCompleted:m.tasksCompleted,deadlocksResolved,overlapViolations,avgWaitTime:m.avgWaitTime,totalDistance:m.totalDistance});emit('SCENARIO_PASSED',progress.detail);}
  if(elapsed>1800&&!progress.completed&&!progress.timedOut){const m=metrics();scenarioResults.push({id,passed:false,timedOut:true,simTime:time,tasksCompleted:m.tasksCompleted,deadlocksResolved,overlapViolations,avgWaitTime:m.avgWaitTime,totalDistance:m.totalDistance});progress.timedOut=true;progress.stage='Timeout';progress.detail='Required '+id+' outcome has not occurred. Inspect blockers and events.';}
  if(scenarioId==='guided'&&progress.completed&&guidedIndex<guidedStages.length-1){guidedIndex++;const index=guidedIndex;reset('guided',true);guidedIndex=index;status='RUNNING';progress={stage:'Running',detail:'Guided '+(index+1)+'/'+guidedStages.length+': '+scenarioActive(),completed:false,timedOut:false};}
 }
 function step(dt:number){if(status!=='RUNNING'||!Number.isFinite(dt)||dt<=0)return;const delta=Math.min(dt,.1);time+=delta;
  if(time-lastAssign>.25){assign();lastAssign=time;}dwell(delta);resourceRequests();movement(delta);
  if(time-lastCycleCheck>.5){cycleRecovery();lastCycleCheck=time;}
  for(const a of Object.values(robots)){for(const b of Object.values(robots)){if(a.id>=b.id)continue;minimumSeparation=Math.min(minimumSeparation,distance(a.position,b.position));if(overlaps(a.position,a.heading,b.position,b.heading,-.01)){overlapViolations++;if(!flags.has('OVERLAP'))incident('OVERLAP','Footprint overlap '+a.id+' / '+b.id);}}}
  scenarioAutomation();if(time-lastSample>=1){const m=metrics();metricHistory.push({time,completed:m.tasksCompleted,throughput:m.throughput,utilization:m.utilization,wait:m.avgWaitTime});if(metricHistory.length>240)metricHistory.shift();lastSample=time;}
 }
 function metrics(){const list=Object.values(robots),done=Object.values(tasks).filter(t=>t.status==='COMPLETED');return{activeRobots:list.filter(r=>!['IDLE','FAILED','CHARGING'].includes(r.state)).length,tasksCompleted:done.length,tasksInQueue:Object.values(tasks).filter(t=>t.status==='QUEUED').length,avgTaskTime:done.length?done.reduce((s,t)=>s+(t.completedAt!-t.createdAt),0)/done.length:0,robotsWaiting:list.filter(r=>r.state==='WAITING').length,deadlocksResolved,overlapViolations,minimumSeparation:Number.isFinite(minimumSeparation)?minimumSeparation:1.4,simTime:time,totalDistance:list.reduce((s,r)=>s+r.distanceTraveled,0),throughput:time?done.length/time*3600:0,utilization:list.filter(r=>!['IDLE','FAILED','CHARGING'].includes(r.state)).length/list.length*100,avgWaitTime:totalWait/list.length,activeConflicts:list.filter(r=>r.blockedBy).length};}
 function snapshot():SimulationSnapshot{sequence++;const reservations=Object.fromEntries(Object.entries(grants).map(([key,g])=>[key,g.robotId])),futureTrajectories:Record<string,Position[]>={};for(const r of Object.values(robots)){const rt=routes[r.id];futureTrajectories[r.id]=rt&&!r.failed?Array.from({length:12},(_,i)=>rt.path.getPointAtDistance(r.pathProgress+i*.5).position):[];}
  return clone({generation,sequence,graph,robots,tasks,events,metrics:metrics(),reservations,reservationWindows:Object.values(grants),futureTrajectories,blockedBy:Object.fromEntries(Object.values(robots).filter(r=>r.blockedBy).map(r=>[r.id,r.blockedBy!])),jecs,conflicts:[...predictedConflicts,...Object.values(robots).filter(r=>r.blockedBy).map(r=>({id:'C-'+r.id,resourceId:r.nextResource??'separation',members:[r.id,r.blockedBy!],reason:r.waitReason??'Conflict'}))],incidents,blockedEdges:[...blocked],metricHistory,scenarioId,scenarioProgress:progress,scenarioResults,simulationStatus:status,networkProfile,speedMultiplier});
 }
 reset();return{dispatch,step,snapshot};
}


































