import {createSimulation,WAREHOUSE_LAYOUT as layout,assert} from './simulation-harness.mjs';
const sim=createSimulation(layout,7481);
function vertices(robot){const l=layout.robotFootprint.length/2,w=layout.robotFootprint.width/2,c=Math.cos(robot.heading),s=Math.sin(robot.heading);return [-1,1].flatMap(a=>[-1,1].map(b=>({x:robot.position.x+a*l*c-b*w*s,y:robot.position.y+a*l*s+b*w*c})));}
function overlap(a,b){for(const poly of [a,b])for(let i=0;i<4;i++){const next=poly[(i+1)%4],p=poly[i],axis={x:-(next.y-p.y),y:next.x-p.x};if(Math.hypot(axis.x,axis.y)<1e-8)continue;const range=v=>v.map(q=>q.x*axis.x+q.y*axis.y);const x=range(a),y=range(b);if(Math.max(...x)<=Math.min(...y)+1e-7||Math.max(...y)<=Math.min(...x)+1e-7)return false;}return true;}
// Polygon perimeter order differs from flatMap order; reorder before SAT.
const polygon=r=>{const v=vertices(r);return [v[0],v[1],v[3],v[2]];};
sim.dispatch({type:'START_SCENARIO',scenarioId:'logistics'});
let s=sim.snapshot(),observed=new Set(),flows=new Set(),samples=0,gen=s.generation;
for(let tick=0;tick<900*60;tick++){
 sim.step(1/60);if(tick%3)continue;s=sim.snapshot();samples++;
 const fleet=Object.values(s.robots),polys=fleet.map(polygon);
 for(let i=0;i<fleet.length;i++){
  const r=fleet[i];if(r.distanceTraveled>2)observed.add(r.id);
  for(const p of polys[i])assert(p.x>=-.025&&p.x<=layout.width+.025&&p.y>=-.025&&p.y<=layout.height+.025,`${r.id} leaves floor at ${s.metrics.simTime}`);
  for(const rack of layout.racks){const p=[{x:rack.x-rack.width/2,y:rack.y-rack.depth/2},{x:rack.x+rack.width/2,y:rack.y-rack.depth/2},{x:rack.x+rack.width/2,y:rack.y+rack.depth/2},{x:rack.x-rack.width/2,y:rack.y+rack.depth/2}];assert(!overlap(polys[i],p),`${r.id} intersects rack ${rack.id} at ${s.metrics.simTime}`);}
  for(let j=i+1;j<fleet.length;j++)assert(!overlap(polys[i],polys[j]),`${r.id}/${fleet[j].id} overlap at ${s.metrics.simTime}`);
  if(r.payload){const t=s.tasks[r.taskId];assert(t?.custodyRobotId===r.id,`${r.id} payload has wrong custody`);}
 }
 for(const t of Object.values(s.tasks))if(t.status==='COMPLETED'){flows.add(t.flow);assert(t.completedAt>0&&!t.custodyRobotId,`${t.id} invalid completion`);}
 if(s.scenarioProgress.completed)break;
}
assert(s.scenarioProgress.completed,`logistics incomplete after ${s.metrics.simTime.toFixed(1)}s: ${JSON.stringify(Object.values(s.robots).filter(r=>r.state==='WAITING').map(r=>({id:r.id,why:r.waitReason})))}`);
assert(observed.size===10,'not all robots moved');assert(flows.size===4,'four logistics flows not complete');assert(Object.values(s.robots).every(r=>r.state==='IDLE'),'robots did not return');
for(let repeat=0;repeat<5;repeat++){
 sim.dispatch({type:'PAUSE'});const before=sim.snapshot().metrics.simTime;sim.step(.1);assert(sim.snapshot().metrics.simTime===before,'pause advances time');
 sim.dispatch({type:'RESET'});s=sim.snapshot();assert(s.generation>gen,'reset did not advance generation');gen=s.generation;assert(!s.metricHistory.length&&s.metrics.tasksCompleted===0,'reset retains history');sim.dispatch({type:'PLAY'});sim.step(.1);sim.dispatch({type:'STOP'});const stopped=sim.snapshot();sim.step(.1);assert(sim.snapshot().metrics.simTime===stopped.metrics.simTime,'stop advances time');sim.dispatch({type:'PLAY'});assert(sim.snapshot().metrics.simTime===0,'play after stop did not restart');
}
console.log(JSON.stringify({result:'PARENT_INTEGRATION_OK',geometrySamples:samples,allRobots:observed.size,completedFlows:flows.size}));
