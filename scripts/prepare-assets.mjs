import { mkdir, copyFile, readdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const root = process.cwd();
const output = path.join(root, 'public/models');
await mkdir(path.join(output, 'textures'), { recursive: true });
await copyFile(path.join(root, 'assets/warehouse-fbx-model/source/warehouse_fbx_model_free.glb'), path.join(output, 'warehouse.glb'));
await copyFile(path.join(root, 'assets/latent-agv-autonomous-warehouse-robot-1.snapshot.1/57561acfdc58441081e73afa8dd0b7dd.obj'), path.join(output, 'agv.obj'));
await copyFile(path.join(root, 'assets/warehouse-shelving-unit/source/shelf00.dae'), path.join(output, 'shelf.dae'));
// OBJ face normals prevent edge welding. Recompute smooth normals only on the
// overview LOD; the inspector retains the untouched, fully detailed original.
const overview = new OBJLoader().parse(await readFile(path.join(output, 'agv.obj'), 'utf8')).children[0].geometry.clone();
overview.deleteAttribute('normal');
const welded = mergeVertices(overview, .0001);
const lod = await new SimplifyModifier().modify(welded, Math.floor(welded.attributes.position.count * .90));
lod.computeVertexNormals();
await writeFile(path.join(output, 'agv-lod.json'), JSON.stringify(lod.toJSON()));
for (const file of await readdir(path.join(root, 'assets/warehouse-shelving-unit/textures'))) {
  await copyFile(path.join(root, 'assets/warehouse-shelving-unit/textures', file), path.join(output, 'textures', file));
}
const glb = await readFile(path.join(output, 'warehouse.glb'));
const metadata = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()).asset.extras;
await writeFile(path.join(output, 'ATTRIBUTION.md'), `# FleetIO demonstration assets\n\nRuntime copies of the user-supplied downloads. Originals remain untouched in Assets.\n\n- Warehouse: ${metadata.title}. Author: ${metadata.author}. License: ${metadata.license}. Source: ${metadata.source}. Native footprint approximately 16 × 46.15 metres. GLTFLoader transforms are retained; the runtime presentation removes roof and high wall triangles for a cutaway, normalizes the footprint to 46 metres long, and adjusts concrete roughness.\n- AGV: 57561acfdc58441081e73afa8dd0b7dd.obj, Latent AGV autonomous warehouse robot package. Native footprint 0.807 × 1.092 metres. The absent material.mtl is replaced with authored orange chassis and dark mechanical materials based on supplied renders. A derivative 4,785-triangle overview LOD preserves its silhouette and footprint; the inspector and followed robot use the original full geometry.\n- Shelving: shelf00.dae, warehouse-shelving-unit package. Declared inch units and Z up are converted once by ColladaLoader. The three supplied diffuse textures are resolved by filename. Shelving is uniformly scaled to fit declared rack footprints.\n\nNo author or license information was found in the supplied AGV and shelving packages. Their attribution and redistribution license details require verification against the original download pages; no license is inferred for them.\n`);
console.log('Prepared original runtime assets in public/models.');
