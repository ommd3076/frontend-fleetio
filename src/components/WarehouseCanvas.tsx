import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Line as ThreeLine, LineBasicMaterial, Matrix4, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store';
import { WAREHOUSE_LAYOUT as layout } from '../simulation/layout';
import type { ResourceDefinition, Robot, StationDefinition } from '../types';
import { loadFleetModels } from './scene/assets';
import type { FleetModels, ModelPart } from './scene/assets';
import { RobotModel } from './scene/RobotModel';
import { DockingStations } from './scene/DockingStations';

const colors = { active: '#6adfc3', route: '#59bafb', waiting: '#ffc968', idle: '#94a5ae', failed: '#ff646c' };
const statusColor = (robot: Robot) => robot.failed ? colors.failed : robot.state === 'WAITING' ? colors.waiting : robot.state === 'IDLE' ? colors.idle : colors.active;

class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('FleetIO scene', error, info.componentStack); }
  render() { return this.state.error ? <div style={messageStyle}>3D rendering unavailable. {this.state.error}</div> : this.props.children; }
}
const messageStyle = { position: 'absolute' as const, inset: 0, display: 'grid', placeItems: 'center', padding: 30, color: '#ccd7df', background: '#131b25', fontSize: 13 };
const labelStyle = { background: '#111c25e8', color: '#eaf2f6', border: '1px solid #536776', borderRadius: 4, font: '600 11px Inter, system-ui, sans-serif', padding: '3px 7px', whiteSpace: 'nowrap' as const, pointerEvents: 'none' as const, boxShadow: '0 3px 12px #0008' };

function Label({ children, position, color = '#536776' }: { children: ReactNode; position: [number, number, number]; color?: string }) {
  const visible = useStore(s => s.showLabels);
  if (!visible) return null;
  return <Html position={position} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}><div style={{ ...labelStyle, borderColor: color }}>{children}</div></Html>;
}

function InstancedShelfPart({ part, positions, scale }: { part: ModelPart; positions: [number, number][]; scale: number }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const matrix = new Matrix4();
    positions.forEach(([x, z], index) => { matrix.makeScale(scale, scale, scale); matrix.setPosition(x, .0145, z); ref.current!.setMatrixAt(index, matrix); });
    ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere();
    const instance = ref.current;
    return () => instance.dispose();
  }, [positions, scale]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, positions.length]} castShadow receiveShadow dispose={null} />;
}

function Shelves({ models }: { models: FleetModels }) {
  const scale = Math.min(2.25 / (models.shelfSize.x * 2), 3.3 / models.shelfSize.z, 3.65 / models.shelfSize.y);
  const span = models.shelfSize.x * scale;
  const positions = useMemo<[number, number][]>(() => layout.racks.flatMap(r => [[r.x - span / 2 - .025, r.y], [r.x + span / 2 + .025, r.y]]), [span]);
  return <group>
    {models.shelfParts.map((part, i) => <InstancedShelfPart key={i} part={part} positions={positions} scale={scale} />)}
    {layout.racks.map(r => <group key={r.id}>
      <Label position={[r.x, models.shelfSize.y * scale + .2, r.y]}>{r.id}</Label>
    </group>)}
  </group>;
}

function LaneMarkings() {
  const ref = useRef<InstancedMesh>(null);
  const marks = useMemo(() => {
    const entries: [number, number, number][] = [];
    layout.verticalAisles.forEach(x => { for (let z = 4; z < 42; z += 1.4) entries.push([x, z, 0]); });
    layout.crossAisles.forEach(z => { for (let x = .7; x < 15.5; x += 1.4) entries.push([x, z, Math.PI / 2]); });
    return entries;
  }, []);
  useEffect(() => {
    const o = new Object3D(); marks.forEach(([x, z, angle], i) => { o.position.set(x, .021, z); o.rotation.y = angle; o.updateMatrix(); ref.current?.setMatrixAt(i, o.matrix); });
    if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); }
  }, [marks]);
  return <instancedMesh ref={ref} args={[undefined, undefined, marks.length]}><boxGeometry args={[.035, .005, .52]} /><meshBasicMaterial color="#ced0b2" transparent opacity={.6} /></instancedMesh>;
}

function Station({ station }: { station: StationDefinition }) {
  const staging = station.kind === 'staging', charging = station.kind === 'charging';
  const color = staging ? '#568faf' : charging ? '#daa944' : station.kind === 'receiving' ? '#5bafff' : '#65d4ac';
  return <group position={[station.x, 0, station.y]}>
    {!staging && !charging && <group position={[0, 0, .95]}>
      <mesh position={[0, .67, 0]} castShadow><boxGeometry args={[2.15, .15, .55]} /><meshStandardMaterial color="#29383d" metalness={.6} roughness={.45} /></mesh>
      {[-.87, .87].map(x => <mesh key={x} position={[x, .3, 0]}><boxGeometry args={[.075, .6, .48]} /><meshStandardMaterial color="#c8a040" /></mesh>)}
    </group>}
    {!staging && !charging && <Label color={color} position={[0, 1.55, .95]}>{station.label}</Label>}
  </group>;
}

function StaticDetails() {
  const bollards = useRef<InstancedMesh>(null), pads = useRef<InstancedMesh>(null), rollers = useRef<InstancedMesh>(null), rings = useRef<InstancedMesh>(null), zones = useRef<InstancedMesh>(null);
  const conveyorStations = useMemo(() => layout.stations.filter(s => s.kind !== 'staging' && s.kind !== 'charging'), []);
  useEffect(() => {
    const object = new Object3D(), color = new Color();
    let index = 0;
    layout.racks.forEach((rack, i) => {
      object.position.set(rack.x, .012, rack.y); object.rotation.set(0, 0, 0); object.scale.set(rack.width + .18, .005, rack.depth + .18); object.updateMatrix(); pads.current?.setMatrixAt(i, object.matrix);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        object.position.set(rack.x + sx * (rack.width / 2 + .04), .2, rack.y + sz * rack.depth / 2); object.scale.set(1, 1, 1); object.updateMatrix(); bollards.current?.setMatrixAt(index++, object.matrix);
      }
    });
    index = 0;
    conveyorStations.forEach(station => {
      for (let i = 0; i < 13; i++) {
        object.position.set(station.x - .96 + i * .16, .764, station.y + .95); object.rotation.set(Math.PI / 2, 0, 0); object.scale.set(1, 1, 1); object.updateMatrix(); rollers.current?.setMatrixAt(index++, object.matrix);
      }
    });
    conveyorStations.forEach((station, i) => {
      const staging = station.kind === 'staging', charging = station.kind === 'charging';
      color.set(staging ? '#568faf' : charging ? '#daa944' : station.kind === 'receiving' ? '#5bafff' : '#65d4ac');
      object.position.set(station.x, .026, station.y); object.rotation.set(-Math.PI / 2, 0, 0); object.scale.set(1, 1, 1); object.updateMatrix(); rings.current?.setMatrixAt(i, object.matrix); rings.current?.setColorAt(i, color);
      object.position.y = .022; object.rotation.set(0, 0, 0); object.scale.set(staging || charging ? 1.18 : 2.35, .003, staging || charging ? 1.3 : 1.8); object.updateMatrix(); zones.current?.setMatrixAt(i, object.matrix); zones.current?.setColorAt(i, color);
    });
    for (const ref of [bollards, pads, rollers, rings, zones]) if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true; ref.current.computeBoundingSphere(); }
  }, [conveyorStations]);
  return <group>
    <instancedMesh ref={bollards} args={[undefined, undefined, layout.racks.length * 4]} castShadow><boxGeometry args={[.10, .4, .10]} /><meshStandardMaterial color="#d9a63b" roughness={.75} /></instancedMesh>
    <instancedMesh ref={pads} args={[undefined, undefined, layout.racks.length]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#384047" roughness={.9} /></instancedMesh>
    <instancedMesh ref={rollers} args={[undefined, undefined, conveyorStations.length * 13]}><cylinderGeometry args={[.035, .035, .50, 8]} /><meshStandardMaterial color="#697477" metalness={.75} roughness={.4} /></instancedMesh>
    <instancedMesh ref={rings} args={[undefined, undefined, conveyorStations.length]}><ringGeometry args={[.5, .53, 32]} /><meshBasicMaterial color="#ffffff" transparent opacity={.65} /></instancedMesh>
    <instancedMesh ref={zones} args={[undefined, undefined, conveyorStations.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ffffff" transparent opacity={.12} depthWrite={false} /></instancedMesh>
  </group>;
}

function ResourceMarker({ resource }: { resource: ResourceDefinition }) {
  const ring = useRef<Mesh>(null), disc = useRef<Mesh>(null);
  const labels = useStore(s => s.showLabels);
  useFrame(() => {
    const state = useStore.getState(), jec = state.jecs.find(j => j.id === resource.jecId);
    const conflict = state.conflicts.some(c => c.resourceId === resource.id);
    const color = conflict ? colors.failed : jec && !jec.online ? colors.waiting : jec?.occupancy.length ? colors.active : '#5f87a2';
    if (ring.current) (ring.current.material as MeshBasicMaterial).color.set(color);
    if (disc.current) { disc.current.visible = state.showReservations; (disc.current.material as MeshBasicMaterial).color.set(color); }
  });
  if (!resource.jecId) return null;
  return <group position={[resource.x, .038, resource.y]} onClick={e => { if (e.delta < 4) { e.stopPropagation(); useStore.getState().setSelectedJec(resource.jecId); } }}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .002, 0]}><circleGeometry args={[resource.radius, 24]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[resource.radius - .04, resource.radius, 48]} /><meshBasicMaterial color="#6092b0" transparent opacity={.75} /></mesh>
    <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.005, 0]}><circleGeometry args={[resource.radius, 48]} /><meshBasicMaterial color="#6092b0" transparent opacity={.15} depthWrite={false} /></mesh>
    {labels && <Html center position={[0, .18, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}><div style={{ font: '600 9px system-ui', color: '#b2d8e4', background: '#17212bcc', padding: '2px 4px', borderRadius: 3 }}>{resource.jecId}</div></Html>}
  </group>;
}

function DynamicLine({ robotId, future = false }: { robotId: string; future?: boolean }) {
  const ref = useRef<ThreeLine>(null);
  const line = useMemo(() => {
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(768), 3)); geometry.setDrawRange(0, 0);
    return new ThreeLine(geometry, new LineBasicMaterial({ color: future ? '#d4b568' : colors.route, transparent: true, opacity: .55, depthWrite: false }));
  }, [future]);
  useEffect(() => () => { line.geometry.dispose(); (line.material as LineBasicMaterial).dispose(); }, [line]);
  useFrame(() => {
    const state = useStore.getState(), robot = state.robots[robotId];
    const current = ref.current;
    if (!current || !robot) return;
    const selected = state.selectedRobotId === robotId;
    current.visible = future ? state.showFutures : state.showRoutes;
    const points = future ? state.futureTrajectories[robotId] ?? [] : [robot.position, ...robot.route.slice(robot.currentWaypointIndex + 1)];
    const attr = current.geometry.getAttribute('position');
    const count = Math.min(points.length, 256);
    for (let i = 0; i < count; i++) attr.setXYZ(i, points[i].x, future ? .15 : .055, points[i].y);
    current.geometry.setDrawRange(0, count); attr.needsUpdate = true;
    (current.material as LineBasicMaterial).opacity = selected ? .95 : .3;
    (current.material as LineBasicMaterial).color.set(robot.payload ? colors.active : future ? colors.waiting : colors.route);
  });
  return <primitive object={line} ref={ref} frustumCulled={false} />;
}

function LiveRobot({ id, models }: { id: string; models: FleetModels }) {
  const root = useRef<Group>(null), body = useRef<Group>(null), ring = useRef<Mesh>(null), flag = useRef<HTMLDivElement>(null);
  const payload = useStore(s => s.robots[id]?.payload ?? false);
  const labels = useStore(s => s.showLabels);
  const detail = useStore(s => s.cameraPreset === 'follow' && s.selectedRobotId === id);
  const generation = useRef(-100);
  useFrame((_, dt) => {
    const state = useStore.getState(), robot = state.robots[id];
    if (!root.current || !body.current || !robot) return;
    const fresh = generation.current !== state.generation;
    const blend = fresh ? 1 : 1 - Math.exp(-Math.min(dt, .1) * 24);
    root.current.position.x += (robot.position.x - root.current.position.x) * blend;
    root.current.position.z += (robot.position.y - root.current.position.z) * blend;
    const heading = -robot.heading - Math.PI / 2;
    body.current.rotation.y += Math.atan2(Math.sin(heading - body.current.rotation.y), Math.cos(heading - body.current.rotation.y)) * blend;
    generation.current = state.generation;
    const color = statusColor(robot);
    if (ring.current) { ring.current.visible = state.selectedRobotId === id || robot.failed || robot.state === 'WAITING'; (ring.current.material as MeshBasicMaterial).color.set(color); }
    if (flag.current) { flag.current.style.borderColor = color; flag.current.style.color = color; }
  });
  return <group ref={root} onClick={e => { if (e.delta < 4) { e.stopPropagation(); useStore.getState().setSelectedRobot(id); } }}>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}><ringGeometry args={[.66, .70, 40]} /><meshBasicMaterial color={colors.active} transparent opacity={.9} depthWrite={false} /></mesh>
    <group ref={body}><RobotModel models={models} payload={payload} detail={detail} /></group>
    <mesh position={[0, .5, 0]}><boxGeometry args={[.85, 1, 1.1]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    {labels && <Html center position={[0, payload ? 1.08 : .73, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}><div ref={flag} style={labelStyle}>{id}</div></Html>}
  </group>;
}

function FutureGhosts({ robotId }: { robotId: string }) {
  const ref = useRef<InstancedMesh>(null);
  const transform = useRef(new Object3D());
  useFrame(() => {
    const state = useStore.getState(), mesh = ref.current;
    if (!mesh) return;
    mesh.visible = state.showFutures;
    const points = state.futureTrajectories[robotId] ?? [], robot = state.robots[robotId];
    mesh.count = Math.min(12, points.length);
    const matrix = transform.current;
    for (let i = 0; i < mesh.count; i++) {
      const point = points[i], next = points[i + 1] ?? point;
      matrix.position.set(point.x, .085, point.y);
      const heading = next.x !== point.x || next.y !== point.y ? Math.atan2(next.y - point.y, next.x - point.x) : robot?.heading ?? 0;
      matrix.rotation.y = -heading - Math.PI / 2; matrix.updateMatrix(); mesh.setMatrixAt(i, matrix.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, 12]} frustumCulled={false}><boxGeometry args={[layout.robotFootprint.width, .035, layout.robotFootprint.length]} /><meshBasicMaterial color="#8ccdec" transparent opacity={.14} depthWrite={false} /></instancedMesh>;
}

function Blockages() {
  const ids = useStore(s => s.blockedEdges.join(','));
  const blocked = new Set(ids.split(',').filter(Boolean));
  const edges = Object.values(layout.graph.edges).filter(edge => blocked.has(edge.id) || blocked.has(edge.resourceId));
  return <group>{edges.map(edge => {
    const a = layout.graph.nodes[edge.from], b = layout.graph.nodes[edge.to];
    if (!a || !b) return null;
    return <group key={edge.id} position={[(a.x + b.x) / 2, .3, (a.y + b.y) / 2]} rotation={[0, -Math.atan2(b.y - a.y, b.x - a.x), 0]}>
      <mesh castShadow><boxGeometry args={[.2, .55, 1.6]} /><meshStandardMaterial color="#d36940" roughness={.75} /></mesh>
      <mesh position={[0, .3, 0]}><boxGeometry args={[.24, .08, 1.72]} /><meshStandardMaterial color="#f0c955" /></mesh>
    </group>;
  })}</group>;
}

function RefugeMarkers() {
  const mesh = useRef<InstancedMesh>(null);
  const refuges = useMemo(() => Object.values(layout.graph.nodes).filter(node => node.type === 'REFUGE'), []);
  useEffect(() => {
    const transform = new Object3D();
    refuges.forEach((node, index) => {
      transform.position.set(node.x, .03, node.y);
      transform.rotation.x = -Math.PI / 2;
      transform.updateMatrix();
      mesh.current?.setMatrixAt(index, transform.matrix);
    });
    if (mesh.current) { mesh.current.instanceMatrix.needsUpdate = true; mesh.current.computeBoundingSphere(); }
  }, [refuges]);
  return <group>
    <instancedMesh ref={mesh} args={[undefined, undefined, refuges.length]}>
      <ringGeometry args={[.65, .69, 32]} /><meshBasicMaterial color="#7babb2" transparent opacity={.45} depthWrite={false} />
    </instancedMesh>
    {refuges.map(node => <Label key={node.id} color="#526f75" position={[node.x, .18, node.y]}>Refuge {node.id.replace('REFUGE_', '')}</Label>)}
  </group>;
}

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const revision = useStore(s => s.cameraRevision), preset = useStore(s => s.cameraPreset);
  const followedId = useStore(s => s.cameraPreset === 'follow' ? s.selectedRobotId : null);
  const destination = useRef(new Vector3()), target = useRef(new Vector3(8, 0, 23));
  const animating = useRef(false);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const state = useStore.getState(), aspect = size.width / Math.max(1, size.height);
    let focus = new Vector3(8, .3, 23);
    const focused = state.focusedNodeId && (layout.graph.nodes[state.focusedNodeId] ?? layout.resources.find(resource => resource.id === state.focusedNodeId));
    if (focused) focus = new Vector3(focused.x, 0, focused.y);
    const p = preset === 'follow' ? state.robots[state.selectedRobotId ?? 'R01'] : null;
    if (p) focus.set(p.position.x, 0, p.position.y);
    target.current.copy(focus);
    const direction = preset === 'top' ? new Vector3(.0001, 1, 0) : new Vector3(2.3, 2.8, 1).normalize();
    const right = new Vector3().crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    const up = new Vector3().crossVectors(right, direction).normalize();
    const tan = Math.tan(camera.fov * Math.PI / 360);
    let distance = 10;
    if (!focused && !p) for (const x of [-8.8, 8.8]) for (const z of [-24, 24]) for (const y of [0, 4.2]) {
      const corner = new Vector3(x, y, z);
      distance = Math.max(distance, Math.abs(corner.dot(right)) / (tan * aspect) + corner.dot(direction), Math.abs(corner.dot(up)) / tan + corner.dot(direction));
    }
    destination.current.copy(focus).addScaledVector(direction, focused || p ? 13 : distance * 1.07);
    animating.current = true;
    if (state.reducedMotion || revision === 0) { camera.position.copy(destination.current); controls.current?.target.copy(target.current); camera.lookAt(target.current); animating.current = false; }
  }, [revision, preset, followedId, size.width, size.height, camera]);
  useFrame((_, dt) => {
    if (!controls.current) return;
    const state = useStore.getState();
    if (preset === 'follow') {
      const robot = state.robots[state.selectedRobotId ?? 'R01'];
      if (robot) {
        const follow = new Vector3(robot.position.x, .2, robot.position.y);
        const delta = follow.clone().sub(target.current); target.current.copy(follow); destination.current.add(delta);
        if (!animating.current) { camera.position.add(delta); controls.current.target.lerp(follow, 1 - Math.exp(-dt * 8)); }
      }
    }
    if (animating.current) {
      const blend = state.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
      camera.position.lerp(destination.current, blend); controls.current.target.lerp(target.current, blend);
      if (camera.position.distanceTo(destination.current) < .025) animating.current = false;
    }
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault target={[8, 0, 23]} minDistance={4} maxDistance={130} maxPolarAngle={Math.PI * .48} minPolarAngle={.01} enableDamping dampingFactor={.12} onStart={() => { animating.current = false; }} />;
}

function Telemetry() {
  const { gl } = useThree();
  const canvasRef = useRef(gl.domElement);
  const frameTimes = useRef<number[]>([]), last = useRef(0);
  useFrame((_, dt) => {
    frameTimes.current.push(dt * 1000); if (frameTimes.current.length > 120) frameTimes.current.shift();
    if (performance.now() - last.current < 1000) return;
    last.current = performance.now();
    const times = [...frameTimes.current].sort((a, b) => a - b), mean = times.reduce((a, b) => a + b, 0) / times.length;
    const data = canvasRef.current.dataset;
    data.fleetFps = (1000 / mean).toFixed(1);
    data.fleetFrameP95 = (times[Math.floor(times.length * .95)] ?? 0).toFixed(1);
    data.fleetDrawCalls = String(gl.info.render.calls);
    data.fleetTriangles = String(gl.info.render.triangles);
    data.fleetGeometries = String(gl.info.memory.geometries);
    data.fleetTextures = String(gl.info.memory.textures);
    data.fleetDpr = gl.getPixelRatio().toFixed(3);
  });
  return null;
}

function PixelBudget() {
  const { size, setDpr } = useThree();
  const quality = useStore(s => s.quality);
  useEffect(() => {
    // Geometry has already been reduced and instanced. Bound raster work for
    // the large map on 4K displays while keeping full pixels on small screens.
    const pixels = Math.max(1, size.width * size.height);
    setDpr(quality === 'low' ? Math.min(1, Math.sqrt(1_100_000 / pixels)) : [1, 1.25]);
  }, [quality, size.width, size.height, setDpr]);
  return null;
}

function Scene({ models }: { models: FleetModels }) {
  const ids = useStore(s => Object.keys(s.robots).join(','));
  return <>
    <color attach="background" args={['#101923']} />
    <hemisphereLight args={['#e5edf5', '#77746c', 2.25]} />
    <directionalLight position={[18, 27, 9]} intensity={3.1} color="#fff2df" castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={100} shadow-bias={-.00015} />
    <primitive object={models.warehouse} dispose={null} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, -.09, 23]} receiveShadow><planeGeometry args={[19, 49]} /><meshStandardMaterial color="#29313a" roughness={1} /></mesh>
    <LaneMarkings /><Shelves models={models} /><StaticDetails /><RefugeMarkers /><DockingStations />
    {layout.stations.map(s => <Station key={s.id} station={s} />)}
    {layout.resources.map(r => <ResourceMarker key={r.id} resource={r} />)}
    {ids.split(',').filter(Boolean).map(id => <group key={id}><DynamicLine robotId={id} /><DynamicLine robotId={id} future /><FutureGhosts robotId={id} /><LiveRobot id={id} models={models} /></group>)}
    <Blockages /><CameraRig /><PixelBudget /><Telemetry />
  </>;
}

export function WarehouseCanvas() {
  const [models, setModels] = useState<FleetModels | null>(null), [error, setError] = useState<string | null>(null);
  const quality = useStore(s => s.quality);
  useEffect(() => { let alive = true; loadFleetModels().then(m => { if (alive) setModels(m); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, []);
  return <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 250, overflow: 'hidden', background: '#111b25' }} aria-label="Interactive 3D warehouse, ten AGVs and live coordination" data-model-status={models ? 'loaded' : error ? 'error' : 'loading'} data-shelf-size={models?.shelfSize.toArray().map(n => n.toFixed(4)).join(',')}>
    {!models ? <div style={messageStyle}>{error ? `Warehouse assets could not load: ${error}` : 'Preparing warehouse, shelving and orange AGVs…'}</div> : <SceneBoundary>
      <Canvas dpr={quality === 'low' ? 1 : [1, 1.25]} shadows={quality === 'balanced'} camera={{ position: [30, 50, 58], fov: 40, near: .08, far: 250 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onPointerMissed={e => { if (e.type === 'click') useStore.getState().setSelectedRobot(null); }}>
        <Scene models={models} />
      </Canvas>
    </SceneBoundary>}
  </div>;
}
