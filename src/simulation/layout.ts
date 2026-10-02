import type {WarehouseLayout,GridNode,GraphEdge,ScenarioDefinition,ScenarioId} from '../types';
export const SCENARIOS:ScenarioDefinition[]=[
 ['guided','Guided demonstration','Tasks, coordination and recovery in a repeatable run.'],
 ['logistics','Normal logistics','Ten robots, four logistics flows.'],['junction','Junction conflict','Reserve, wait, cross and resume.'],
 ['narrow','Narrow passage','Opposing robots negotiate exclusive entry.'],['following','Safe following','Keep a clear following distance.'],
 ['detour','Alternate route','Choose a clear route around congestion.'],['fairness','Priority aging','Waiting robots gain access.'],
 ['deadlock','Deadlock recovery','Clear a real wait cycle using a safe refuge.'],['jec-outage','JEC outage','Peer coordination takes over.'],
 ['robot-failure','Robot failure','Reassign work before pickup.'],['payload-recovery','Payload recovery','Retain custody after pickup.'],
 ['blocked-aisle','Blocked aisle','Replan around an obstruction.'],['network','Degraded communications','Conservative entry with delayed messages.'],
 ['charging','Battery & charging','Exclusive charger access and replenishment.'],
].map(([id,label,description])=>({id:id as ScenarioId,label,description}));
const width=16,height=46,verticalAisles=[0.85,5.5,10.5,15.15],crossAisles=[5,11,17,23,29,35,41];
const racks=['A','B','C'].flatMap((col,c)=>[8,14,20,26,32,38].map((y,r)=>({id:col+(r+1),x:[3,8,13][c],y,width:2.4,depth:3.6})));
const stations:WarehouseLayout['stations']=[
 ...Array.from({length:10},(_,i)=>({id:'STG_'+String(i+1).padStart(2,'0'),label:'Bay '+(i+1),x:1.7+i*1.4,y:1.5,kind:'staging' as const})),
 {id:'PACK_1',label:'Packing A',x:2,y:43.5,kind:'packing'},{id:'PACK_2',label:'Packing B',x:5,y:43.5,kind:'packing'},
 {id:'REC_1',label:'Receiving',x:8,y:43.5,kind:'receiving'},{id:'DISP_1',label:'Dispatch A',x:11,y:43.5,kind:'dispatch'},
 {id:'DISP_2',label:'Dispatch B',x:14,y:43.5,kind:'dispatch'},
 {id:'CHG_1',label:'Charge 1',x:.85,y:45,kind:'charging'},{id:'CHG_2',label:'Charge 2',x:15.15,y:45,kind:'charging'}
];
const nodes:Record<string,GridNode>={},edges:Record<string,GraphEdge>={};
const add=(id:string,x:number,y:number,type:GridNode['type']='AISLE')=>{nodes[id]={id,x,y,type,neighbors:[]};return id;};
export const edgeId=(a:string,b:string)=>[a,b].sort().join('|');
const connect=(a:string,b:string,narrow=false)=>{if(!nodes[a]||!nodes[b])return;nodes[a].neighbors.push(b);nodes[b].neighbors.push(a);const id=edgeId(a,b);edges[id]={id,from:a,to:b,width:narrow?1.7:2.6,narrow,resourceId:id};};
const junction=(c:number,r:number)=>'J_'+c+'_'+r;
for(let c=0;c<4;c++)for(let r=0;r<7;r++)add(junction(c,r),verticalAisles[c],crossAisles[r],'JUNCTION');
for(let c=0;c<4;c++)for(let r=0;r<6;r++){const mid=add('LANE_'+c+'_'+r,verticalAisles[c],(crossAisles[r]+crossAisles[r+1])/2);connect(junction(c,r),mid,c===0||c===3);connect(mid,junction(c,r+1),c===0||c===3);}
for(let r=0;r<7;r++)for(let c=0;c<3;c++)connect(junction(c,r),junction(c+1,r),r===3&&c===1);
for(let c=0;c<3;c++)for(let r=0;r<6;r++){const rack=racks[c*6+r];add('RACK_'+rack.id,rack.x,rack.y,'RACK');for(const side of ['LEFT','RIGHT'] as const){const lane=c+(side==='RIGHT'?1:0);const id=add(rack.id+'_'+side+'_SERVICE',verticalAisles[lane],rack.y,'PICKUP');connect(id,'LANE_'+lane+'_'+r);}}
for(const station of stations){
 const type=station.kind==='staging'?'STAGING':station.kind==='charging'?'CHARGING':station.kind==='receiving'?'PICKUP':'DROP';
 add(station.id,station.x,station.y,type);
 const nearest=verticalAisles.reduce((best,x,i)=>Math.abs(x-station.x)<Math.abs(verticalAisles[best]-station.x)?i:best,0);
 if(station.kind==='staging'){const gate=add('STG_EXIT_'+station.id,station.x,3.3);connect(station.id,gate);const hub='STG_HUB_'+nearest;if(!nodes[hub]){add(hub,verticalAisles[nearest],3.3);connect(hub,junction(nearest,0));}if(gate!==hub)connect(gate,hub);}
 else {const hub=add('APPROACH_'+station.id,station.x,42);connect(station.id,hub);connect(hub,junction(nearest,6));}
}
for(const [i,c,r] of [[1,1,2],[2,2,4],[3,2,5],[4,1,1]] as const){const id=add('REFUGE_'+i,verticalAisles[c]+2,crossAisles[r],'REFUGE');connect(id,junction(c,r));}
const resources:WarehouseLayout['resources']=[
 {id:'J_1_2',kind:'junction',x:5.5,y:17,radius:1.2,jecId:'JEC-1'},
 {id:'J_2_4',kind:'junction',x:10.5,y:29,radius:1.2,jecId:'JEC-2'},
 {id:'NARROW_1',kind:'narrow',x:8,y:23,radius:2.5,jecId:'JEC-3'},
 ...stations.filter(s=>s.kind==='charging').map(s=>({id:s.id,kind:'charger' as const,x:s.x,y:s.y,radius:.8,jecId:null}))
];
edges[edgeId('J_1_3','J_2_3')].resourceId='NARROW_1';
export const WAREHOUSE_LAYOUT:WarehouseLayout={width,height,racks,stations,verticalAisles,crossAisles,resources,robotFootprint:{width:.807,length:1.093},graph:{width,height,nodes,edges}};

