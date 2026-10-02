import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Box3, BufferGeometryLoader, Matrix4, Mesh, Vector3 } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pairs = [
  ['assets/warehouse-fbx-model/source/warehouse_fbx_model_free.glb', 'public/models/warehouse.glb'],
  ['assets/warehouse-shelving-unit/source/shelf00.dae', 'public/models/shelf.dae'],
  ['assets/latent-agv-autonomous-warehouse-robot-1.snapshot.1/57561acfdc58441081e73afa8dd0b7dd.obj', 'public/models/agv.obj'],
];
const sourceHashes = JSON.parse(fs.readFileSync('public/models/source-hashes.json', 'utf8'));
for (const [name, hash] of Object.entries(sourceHashes)) assert.equal(sha('public/models/' + name), hash, name + ' changed from validated download');
for (const [original, runtime] of pairs) if (fs.existsSync(original)) assert.equal(sha(original), sha(runtime), `${runtime} must preserve original geometry`);

const obj = new OBJLoader().parse(fs.readFileSync('public/models/agv.obj', 'utf8'));
const robotBounds = new Box3().setFromObject(obj), robotSize = robotBounds.getSize(new Vector3());
assert.ok(Math.abs(robotSize.x - .806635) < .00001);
assert.ok(Math.abs(robotSize.z - 1.092469) < .00001);
assert.ok(Math.abs(robotBounds.min.y) < .00001);
obj.traverse(mesh => { if (mesh.isMesh) assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite)); });

// The overview uses a derivative of the downloaded geometry. Confirm its
// reduced cost without letting simplification change the simulation footprint.
const lod = new BufferGeometryLoader().parse(JSON.parse(fs.readFileSync('public/models/agv-lod.json', 'utf8')));
const lodBounds = new Box3().setFromObject(new Mesh(lod)), lodSize = lodBounds.getSize(new Vector3());
const lodTriangles = (lod.index?.count ?? lod.attributes.position.count) / 3;
assert.ok(lodTriangles > 1000 && lodTriangles < 5000, 'overview LOD should retain detail within a 5k triangle budget');
for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(lodSize[axis] - robotSize[axis]) < .001, `LOD preserves ${axis} extent within 1 mm`);
for (const attribute of Object.values(lod.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite), 'LOD attributes must be finite');
assert.ok(Math.abs(lodBounds.min.y) < .001, 'LOD floor contact matches original');

const glb = fs.readFileSync('public/models/warehouse.glb');
assert.equal(glb.readUInt32LE(0), 0x46546c67);
const manifest = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const floorMesh = manifest.meshes.findIndex(mesh => mesh.name.includes('WetConcrete'));
assert.ok(floorMesh >= 0, 'downloaded floor exists');
let floorBounds;
function visit(index, parent) {
  const node = manifest.nodes[index];
  const matrix = parent.clone().multiply(node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4());
  if (node.mesh === floorMesh) {
    const accessor = manifest.accessors[manifest.meshes[floorMesh].primitives[0].attributes.POSITION];
    floorBounds = new Box3(new Vector3(...accessor.min), new Vector3(...accessor.max)).applyMatrix4(matrix);
  }
  for (const child of node.children ?? []) visit(child, matrix);
}
for (const root of manifest.scenes[manifest.scene ?? 0].nodes) visit(root, new Matrix4());
const floorSize = floorBounds.getSize(new Vector3());
assert.ok(Math.abs(floorSize.x - 16) < .01 && Math.abs(floorSize.z - 46.15) < .01);
assert.ok(floorSize.y < .001, 'GLTF scene transforms place floor horizontally');

const dae = fs.readFileSync('public/models/shelf.dae', 'utf8');
assert.ok(dae.includes('<unit meter="0.0254"'), 'loader converts declared inches once');
for (const match of dae.matchAll(/<init_from>([^<]+\.jpg)<\/init_from>/g)) {
  const filename = match[1].split('/').pop();
  assert.ok(fs.existsSync(`public/models/textures/${filename}`), `resolved diffuse texture ${filename}`);
  if (fs.existsSync(`assets/warehouse-shelving-unit/textures/${filename}`)) assert.equal(sha(`assets/warehouse-shelving-unit/textures/${filename}`), sha(`public/models/textures/${filename}`));
}
console.log(JSON.stringify({ passed: true, robotMetres: robotSize.toArray(), floorMetres: floorSize.toArray(), diffuseTextures: 3, overviewTriangles: lodTriangles, overviewMetres: lodSize.toArray() }, null, 2));
