import { Box3, BufferAttribute, BufferGeometry, BufferGeometryLoader, Color, DoubleSide, Float32BufferAttribute, Group, LoadingManager, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import type { Material } from 'three';

export interface ModelPart { geometry: BufferGeometry; material: Material | Material[]; matrix: Matrix4 }
export interface FleetModels { warehouse: Group; agv: Group; agvLOD: Group; shelfParts: ModelPart[]; shelfSize: Vector3 }
let pending: Promise<FleetModels> | undefined;
const base = `${import.meta.env.BASE_URL}models/`;

function rebuildRobot(source: Group) {
  const body = new MeshStandardMaterial({ color: '#ee8525', roughness: .4, metalness: .32 });
  const dark = new MeshStandardMaterial({ color: '#20272c', roughness: .65, metalness: .35 });
  const mechanical = new MeshStandardMaterial({ color: '#48545c', roughness: .55, metalness: .7 });
  const result = new Group();
  const bounds = new Box3().setFromObject(source), center = bounds.getCenter(new Vector3());
  source.updateMatrixWorld(true);
  source.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const c = new Color();
    for (let triangle = 0; triangle < positions.count; triangle += 3) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) { x += positions.getX(triangle + k) / 3; y += positions.getY(triangle + k) / 3; z += positions.getZ(triangle + k) / 3; }
      const deck = y > .227;
      const wheel = Math.abs(x - center.x) > .32 && Math.abs(z - center.z) < .19 && y < .185;
      const bottom = y < .035 || (Math.abs(z - center.z) > .5 && y < .14);
      c.copy(deck || wheel || bottom ? dark.color : y > .214 ? mechanical.color : body.color);
      for (let k = 0; k < 3; k++) c.toArray(colors, (triangle + k) * 3);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.translate(-center.x, -bounds.min.y, -center.z);
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: .48, metalness: .28 });
    const mesh = new Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; result.add(mesh);
  });
  body.dispose(); dark.dispose(); mechanical.dispose();
  return result;
}

function cutawayWarehouse(source: Group) {
  source.updateMatrixWorld(true);
  const result = new Group();
  source.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geom = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geom.applyMatrix4(object.matrixWorld);
    const p = geom.getAttribute('position');
    // The supplied metal object includes its roof and walls in one mesh. Keep
    // floor-level triangles only, rather than hiding the complete downloaded model.
    const attributes: Record<string, number[]> = {};
    for (const key of Object.keys(geom.attributes)) attributes[key] = [];
    for (let i = 0; i < p.count; i += 3) {
      if (Math.max(p.getY(i), p.getY(i + 1), p.getY(i + 2)) > .24) continue;
      for (const [key, attr] of Object.entries(geom.attributes as Record<string, BufferAttribute>)) {
        for (let j = 0; j < 3; j++) for (let component = 0; component < attr.itemSize; component++) attributes[key].push(attr.array[(i + j) * attr.itemSize + component]);
      }
    }
    if (!attributes.position.length) { geom.dispose(); return; }
    const cut = new BufferGeometry();
    for (const [key, values] of Object.entries(attributes)) cut.setAttribute(key, new Float32BufferAttribute(values, geom.getAttribute(key).itemSize));
    const material = (Array.isArray(object.material) ? object.material[0] : object.material).clone() as MeshStandardMaterial;
    material.side = DoubleSide; material.roughness = .86; material.metalness = .12;
    if (material.emissive) { material.emissive.set('#000000'); material.emissiveIntensity = 0; }
    const mesh = new Mesh(cut, material); mesh.name = object.name; mesh.receiveShadow = true; result.add(mesh); geom.dispose();
  });
  const bounds = new Box3().setFromObject(result), size = bounds.getSize(new Vector3());
  if (size.x > size.z) { result.rotation.y = Math.PI / 2; result.updateMatrixWorld(true); }
  const floor = result.children.find(child => child.name.includes('WetConcrete')) ?? result;
  const floorBounds = new Box3().setFromObject(floor), floorSize = floorBounds.getSize(new Vector3());
  const scale = 46 / floorSize.z; result.scale.setScalar(scale); result.updateMatrixWorld(true);
  const final = new Box3().setFromObject(floor), center = final.getCenter(new Vector3());
  // Align the concrete surface, not the highest surviving wall-base triangle.
  // Otherwise the protective backplane can cover the actual textured floor.
  result.position.set(8 - center.x, -final.max.y, 23 - center.z);
  return result;
}

export function loadFleetModels(): Promise<FleetModels> {
  if (pending) return pending;
  const manager = new LoadingManager();
  manager.setURLModifier(url => {
    const filename = decodeURIComponent(url.split('/').pop() ?? '');
    return /\.jpe?g$/i.test(filename) ? `${base}textures/${filename}` : url;
  });
  pending = Promise.all([
    new GLTFLoader(manager).loadAsync(`${base}warehouse.glb`),
    new OBJLoader(manager).loadAsync(`${base}agv.obj`),
    new ColladaLoader(manager).loadAsync(`${base}shelf.dae`),
    new BufferGeometryLoader(manager).loadAsync(`${base}agv-lod.json`),
  ]).then(([warehouse, robot, shelf, lod]) => {
    if (!shelf) throw new Error('The shelving asset contains no COLLADA scene.');
    // ColladaLoader has already converted inch units and Z_UP to metres/Y_UP.
    shelf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(shelf.scene), size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3()), parts: ModelPart[] = [];
    shelf.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const geometry = object.geometry.clone(); geometry.applyMatrix4(object.matrixWorld); geometry.translate(-center.x, -bounds.min.y, -center.z);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(mat => { if (mat instanceof MeshStandardMaterial) mat.roughness = .8; });
      parts.push({ geometry, material: object.material, matrix: new Matrix4() });
    });
    const lowDetail = new Group(); lowDetail.add(new Mesh(lod));
    return { warehouse: cutawayWarehouse(warehouse.scene), agv: rebuildRobot(robot), agvLOD: rebuildRobot(lowDetail), shelfParts: parts, shelfSize: size };
  });
  return pending;
}
