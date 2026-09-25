import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function importTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText.replace("from '../types';", "from 'data:text/javascript,export%20{}';");
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

const { applyRightHandLanes, LANE_OFFSET } = await importTypeScript('src/simulation/laneRouting.ts');
const step = (nodeId, x, y, timeStep) => ({ nodeId, x, y, timeStep });
const east = applyRightHandLanes([step('a', 0, 0, 0), step('b', 2, 0, 1), step('c', 4, 0, 2), step('d', 6, 0, 3)]);
const west = applyRightHandLanes([step('d', 6, 0, 0), step('c', 4, 0, 1), step('b', 2, 0, 2), step('a', 0, 0, 3)]);
const north = applyRightHandLanes([step('a', 0, 0, 0), step('b', 0, 2, 1), step('c', 0, 4, 2), step('d', 0, 6, 3)]);
const south = applyRightHandLanes([step('d', 0, 6, 0), step('c', 0, 4, 1), step('b', 0, 2, 2), step('a', 0, 0, 3)]);
assert(Math.abs(east[1].y + LANE_OFFSET) < 1e-6, 'eastbound route is not in its right lane');
assert(Math.abs(west[1].y - LANE_OFFSET) < 1e-6, 'westbound route is not in its right lane');
assert(Math.abs(north[1].x - LANE_OFFSET) < 1e-6, 'northbound route is not in its right lane');
assert(Math.abs(south[1].x + LANE_OFFSET) < 1e-6, 'southbound route is not in its right lane');
assert(Math.abs(east[1].y - west[1].y) >= 1.2, 'opposing routes do not have physical lane separation');
console.log('DUAL_LANE_ROUTING_OK');

const worker = fs.readFileSync(path.join(root, 'src/simulation/worker.ts'), 'utf8');
assert(worker.includes('FUTURE_HORIZON_SECONDS = 3'), 'future horizon is missing');
assert(worker.includes('updateFutureMap();'), 'future map is not updated in the fixed tick');
assert(worker.includes('futureTrajectories'), 'future trajectories are not published');
assert(worker.includes('FUTURE_CLEARANCE'), 'future reservations have no clearance radius');
console.log('FUTURE_MAP_OK');

assert(worker.includes('findWaitCycle'), 'wait-for cycle detection is missing');
assert(worker.includes('priorityGrantUntil'), 'temporary right-of-way grant is missing');
assert(worker.includes('DL resolved:'), 'deadlock resolution is not recorded');
assert(worker.includes('recordSeparationMetrics'), 'runtime separation is not measured');
assert(!worker.includes('if (robotOwnsControl) return true'), 'control ownership still bypasses separation logic');
console.log('DEADLOCK_RESOLUTION_OK');
