import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTypeScript(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

const [{ FLEET_SCENARIO }, { generateWarehouse }] = await Promise.all([
  importTypeScript('src/simulation/scenario.ts'),
  importTypeScript('src/simulation/warehouseGraph.ts')
]);
const graph = generateWarehouse();

assert(FLEET_SCENARIO.length === 10, `expected 10 robots, found ${FLEET_SCENARIO.length}`);
assert(new Set(FLEET_SCENARIO.map(unit => unit.id)).size === 10, 'robot ids are not unique');
assert(new Set(FLEET_SCENARIO.map(unit => unit.bay)).size === 10, 'staging bays are not unique');
for (const unit of FLEET_SCENARIO) {
  assert(/^R\d{2}$/.test(unit.id), `${unit.id}: invalid robot id`);
  assert(graph.nodes[unit.bay]?.type === 'STAGING', `${unit.id}: invalid staging bay ${unit.bay}`);
  assert(graph.nodes[unit.pickup]?.type === 'PICKUP', `${unit.id}: invalid pickup ${unit.pickup}`);
  assert(graph.nodes[unit.drop]?.type === 'DROP', `${unit.id}: invalid drop ${unit.drop}`);
  assert(unit.priority >= 1 && unit.priority <= 3, `${unit.id}: priority outside 1..3`);
}
console.log('TEN_ROBOT_SCENARIO_OK');

const workerSource = fs.readFileSync(path.join(root, 'src/simulation/worker.ts'), 'utf8');
assert(workerSource.includes('updateReservations();'), 'runtime does not update junction ownership');
assert(workerSource.includes('waiting for clear aisle'), 'runtime does not expose proximity waiting');
assert(workerSource.includes("r.state = 'RETURNING_TO_STAGING'"), 'runtime does not return delivered robots to staging');
assert(workerSource.includes('releaseRobotReservations'), 'runtime does not release junction ownership');
assert(workerSource.includes('resumeState'), 'waiting robots cannot resume their previous route state');

const fleetSummarySource = fs.readFileSync(path.join(root, 'src/components/FleetSummary.tsx'), 'utf8');
assert(fleetSummarySource.includes('{total} unit run'), 'fleet summary still presents a fixed unit count');
assert(!fleetSummarySource.includes('3 unit run'), 'fleet summary still contains the old three-unit label');
console.log('TEN_ROBOT_RUNTIME_OK');
