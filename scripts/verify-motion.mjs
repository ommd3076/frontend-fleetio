import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const motionSource = fs.readFileSync(path.join(root, 'src/simulation/motionPath.ts'), 'utf8');
const transpiled = ts.transpileModule(motionSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const { MotionPath } = await import(moduleUrl);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function shortestAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function inspectQuarterTurn(points, expectedSign, label) {
  const pathUnderTest = new MotionPath(points, 1);
  const arc = pathUnderTest.segments.find(segment => segment.type === 'ARC');
  assert(arc, `${label}: missing corner arc`);
  const sweptAngle = arc.length / arc.radius;
  assert(Math.abs(sweptAngle - Math.PI / 2) < 1e-6, `${label}: expected 90 degree arc, got ${(sweptAngle * 180 / Math.PI).toFixed(2)}`);

  let accumulatedTurn = 0;
  let previousHeading = pathUnderTest.getPointAtDistance(0).heading;
  for (let index = 1; index <= 240; index += 1) {
    const heading = pathUnderTest.getPointAtDistance(pathUnderTest.totalLength * index / 240).heading;
    const change = shortestAngle(heading - previousHeading);
    assert(Math.abs(change) < Math.PI / 24, `${label}: discontinuous heading jump`);
    accumulatedTurn += change;
    previousHeading = heading;
  }
  assert(Math.sign(accumulatedTurn) === expectedSign, `${label}: turn direction is reversed`);
  assert(Math.abs(Math.abs(accumulatedTurn) - Math.PI / 2) < 0.03, `${label}: accumulated turn is not 90 degrees`);
}

inspectQuarterTurn([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], 1, 'left turn');
inspectQuarterTurn([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: -5 }], -1, 'right turn');

const workerSource = fs.readFileSync(path.join(root, 'src/simulation/worker.ts'), 'utf8');
assert(workerSource.includes('const FIXED_DT = 1 / 60'), 'worker does not declare a 60 Hz fixed step');
assert(workerSource.includes('setInterval(frame, FRAME_MS)'), 'worker frame loop is not tied to the 60 Hz cadence');
assert(workerSource.includes('shortestAngle(desiredHeading - r.heading)'), 'steering does not use shortest-angle rotation');

const canvasSource = fs.readFileSync(path.join(root, 'src/components/WarehouseCanvas.tsx'), 'utf8');
assert(canvasSource.includes('<svg viewBox="0 0 60 42"'), 'warehouse map is not the top-down SVG view');
assert(!canvasSource.includes('@react-three/fiber'), 'warehouse map still imports the 3D renderer');

console.log('MOTION_VERIFICATION_OK');
