import assert from 'node:assert/strict';
import { importTs, createSimulation, WAREHOUSE_LAYOUT as layout } from './simulation-harness.mjs';
const { DOCKS, HOME_DOCKS, CHARGING_DOCKS, getDockStatus, getRobotHomeDock } = await importTs('src/components/scene/docks.ts');
const preferences = await importTs('src/presentationPreferences.ts');

assert.equal(DOCKS.length, 12);
assert.equal(HOME_DOCKS.length, 10);
assert.equal(CHARGING_DOCKS.length, 2);
assert.equal(new Set(DOCKS.map(d => d.id)).size, 12);
const turningRadius = Math.hypot(layout.robotFootprint.width, layout.robotFootprint.length) / 2;
const pointToPedestal = (p, dock) => Math.hypot(Math.max(0, Math.abs(p.x - dock.pedestal.x) - dock.pedestal.width / 2), Math.max(0, Math.abs(p.y - dock.pedestal.y) - dock.pedestal.depth / 2));
let minGraphClearance = Infinity;
for (const dock of DOCKS) {
  const station = layout.stations.find(s => s.id === dock.nodeId);
  assert.ok(station && station.x === dock.x && station.y === dock.y, 'dock must consume actual station coordinates');
  assert.ok(dock.pedestal.x - dock.pedestal.width / 2 >= 0 && dock.pedestal.x + dock.pedestal.width / 2 <= layout.width);
  assert.ok(dock.pedestal.y - dock.pedestal.depth / 2 >= 0 && dock.pedestal.y + dock.pedestal.depth / 2 <= layout.height);
  for (const edge of Object.values(layout.graph.edges)) {
    const a = layout.graph.nodes[edge.from], b = layout.graph.nodes[edge.to];
    const count = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / .015);
    for (let i = 0; i <= count; i++) {
      const t = count ? i / count : 0;
      const clearance = pointToPedestal({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dock) - turningRadius;
      minGraphClearance = Math.min(minGraphClearance, clearance);
      assert.ok(clearance > .025, `${dock.id} obstructs ${edge.id}`);
    }
  }
}
// Positive control: the clearance oracle must detect a pedestal on an aisle.
const badDock = { ...DOCKS[0], pedestal: { ...DOCKS[0].pedestal, x: 5.5, y: 17 } };
assert.ok(pointToPedestal(layout.graph.nodes.J_1_2, badDock) - turningRadius < 0);

const sim = createSimulation(layout, 7481);
sim.dispatch({ type: 'RESET' });
let snapshot = sim.snapshot();
for (const dock of HOME_DOCKS) {
  assert.deepEqual(getDockStatus(dock, snapshot.robots), { state: 'occupied', robotId: dock.ownerRobotId });
  assert.equal(getRobotHomeDock(snapshot.robots[dock.ownerRobotId]).id, dock.id);
}
for (const dock of CHARGING_DOCKS) assert.equal(getDockStatus(dock, snapshot.robots).state, 'ready');
sim.dispatch({ type: 'FAIL_ROBOT', robotId: 'R04' });
assert.equal(getDockStatus(HOME_DOCKS[3], sim.snapshot().robots).state, 'fault');
const home = HOME_DOCKS[0], parked = snapshot.robots.R01;
assert.equal(getDockStatus(home, { R01: { ...parked, state: 'CHARGING' } }).state, 'occupied', 'home parking cannot imply charging');
assert.equal(getDockStatus(home, { R01: { ...parked, position: { x: home.x, y: home.y + .75 } } }).state, 'occupied', 'departing footprint still touches pad');
assert.equal(getDockStatus(home, { R01: { ...parked, position: { x: home.x, y: home.y + 2 } } }).state, 'ready');

let poseSamples = 0, completedTasks = 0;
const charged = new Set(), batteryIncreased = new Set();
for (const scenario of ['logistics', 'charging']) {
  sim.dispatch({ type: 'START_SCENARIO', scenarioId: scenario });
  let previous = sim.snapshot();
  for (let tick = 0; tick < 900 * 60; tick++) {
    sim.step(1 / 60);
    if (tick % 6) continue;
    snapshot = sim.snapshot(); poseSamples++;
    for (const robot of Object.values(snapshot.robots)) {
      // An orientation-independent circle is stricter than the actual rectangle.
      for (const dock of DOCKS) assert.ok(pointToPedestal(robot.position, dock) > turningRadius, `${robot.id} clips ${dock.id} in ${scenario} at ${snapshot.metrics.simTime}`);
      if (robot.state === 'CHARGING') {
        assert.ok(CHARGING_DOCKS.some(d => getDockStatus(d, { [robot.id]: robot }).state === 'charging'));
        charged.add(robot.id);
        if (previous.robots[robot.id]?.state === 'CHARGING' && robot.battery > previous.robots[robot.id].battery) batteryIncreased.add(robot.id);
      }
    }
    for (const dock of HOME_DOCKS) assert.notEqual(getDockStatus(dock, snapshot.robots).state, 'charging');
    for (const dock of CHARGING_DOCKS) {
      const status = getDockStatus(dock, snapshot.robots);
      if (status.state === 'charging') assert.equal(snapshot.robots[status.robotId].state, 'CHARGING');
    }
    previous = snapshot;
    if (snapshot.scenarioProgress.completed) break;
  }
  assert.ok(snapshot.scenarioProgress.completed, `${scenario} did not finish`);
  assert.equal(snapshot.metrics.overlapViolations, 0);
  if (scenario === 'logistics') { completedTasks = snapshot.metrics.tasksCompleted; assert.equal(completedTasks, 20); assert.ok(HOME_DOCKS.every(d => getDockStatus(d, snapshot.robots).robotId === d.ownerRobotId)); }
}
assert.ok(['R01', 'R02'].every(id => charged.has(id) && batteryIncreased.has(id)));

assert.equal(preferences.savedReducedMotion(), false, 'SSR has no local storage');
assert.equal(preferences.systemPrefersReducedMotion(), false);
let value = null, listener;
const query = { matches: true, addEventListener: (_event, fn) => { listener = fn; }, removeEventListener: (_event, fn) => { assert.equal(fn, listener); listener = null; } };
globalThis.window = { localStorage: { getItem: () => value, setItem: (_key, next) => { value = next; } }, matchMedia: () => query };
assert.equal(preferences.systemPrefersReducedMotion(), true);
preferences.saveReducedMotion(true); assert.equal(preferences.savedReducedMotion(), true);
preferences.saveReducedMotion(false); assert.equal(preferences.savedReducedMotion(), false);
let observed;
const stop = preferences.observeSystemMotion(reduced => { observed = reduced; });
query.matches = false; listener(); assert.equal(observed, false); stop(); assert.equal(listener, null);
window.localStorage.getItem = () => { throw new Error('storage disabled'); };
window.localStorage.setItem = () => { throw new Error('storage disabled'); };
assert.equal(preferences.savedReducedMotion(), false); assert.doesNotThrow(() => preferences.saveReducedMotion(true));
delete globalThis.window;
console.log(JSON.stringify({ result: 'PRESENTATION_DOCKS_OK', docks: DOCKS.length, homeDocks: HOME_DOCKS.length, poseSamples, completedTasks, charged: [...charged], minGraphClearanceMm: +(minGraphClearance * 1000).toFixed(2), motionPreferences: 'SSR, system change, persistence, cleanup, restricted storage' }));
