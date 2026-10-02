import {assert,runScenario} from './simulation-harness.mjs';
const s=runScenario('logistics',1600);
assert(s.scenarioProgress.completed,'Finite workload did not finish: '+JSON.stringify(Object.values(s.robots).map(r=>({id:r.id,state:r.state,reason:r.waitReason}))));
assert(s.metrics.tasksCompleted===20&&s.metrics.tasksInQueue===0,'Tasks not all complete');
assert(Object.values(s.robots).every(r=>r.tasksCompleted>=1&&r.state==='IDLE'&&!r.payload),'Every robot must deliver and return');
assert(new Set(Object.values(s.tasks).map(t=>t.flow)).size===4,'Four flows missing');
assert(s.metrics.overlapViolations===0,'Footprints overlapped');
console.log('TEN_ROBOT_VERIFICATION_OK: all 20 tasks, four flows, ten robots delivered/returned; '+s.metrics.simTime.toFixed(2)+' simulated seconds');
