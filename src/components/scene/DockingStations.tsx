import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, TorusGeometry } from 'three';
import type { BufferGeometry, Material } from 'three';
import { useStore } from '../../store';
import { DOCKS, dockStatusLabel, getDockStatus } from './docks';
import type { DockDefinition, DockState } from './docks';

type Part = { dockIndex: number; position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number]; color?: string };
const statusColors: Record<DockState, string> = { ready: '#578093', occupied: '#58c9b7', charging: '#efbe5d', fault: '#f16b75' };

function chooseDock(event: ThreeEvent<MouseEvent>, parts: Part[]) {
  if (event.delta >= 4 || event.instanceId === undefined) return;
  const dock = DOCKS[parts[event.instanceId]?.dockIndex];
  if (!dock) return;
  event.stopPropagation();
  const state = useStore.getState(), status = getDockStatus(dock, state.robots);
  state.focusNode(dock.nodeId);
  state.setSelectedRobot(status.robotId ?? dock.ownerRobotId);
}

function Parts({ geometry, material, parts, instanceRef }: { geometry: BufferGeometry; material: Material; parts: Part[]; instanceRef?: RefObject<InstancedMesh | null> }) {
  const ownRef = useRef<InstancedMesh>(null), ref = instanceRef ?? ownRef;
  useEffect(() => {
    const object = new Object3D();
    parts.forEach((part, index) => {
      object.position.set(...part.position); object.scale.set(...part.scale); object.rotation.set(...(part.rotation ?? [0, 0, 0]));
      object.updateMatrix(); ref.current?.setMatrixAt(index, object.matrix);
      if (part.color) ref.current?.setColorAt(index, new Color(part.color));
    });
    if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true; ref.current.computeBoundingSphere(); }
    const instance = ref.current;
    return () => instance?.dispose();
  }, [parts, ref]);
  return <instancedMesh ref={ref} args={[geometry, material, parts.length]} dispose={null} receiveShadow onClick={event => chooseDock(event, parts)} />;
}

function DockLabel({ dock }: { dock: DockDefinition }) {
  const visible = useStore(state => state.showLabels);
  const selected = useStore(state => state.focusedNodeId === dock.nodeId || (state.selectedRobotId !== null && state.robots[state.selectedRobotId]?.homeNodeId === dock.nodeId));
  const top = useStore(state => state.cameraPreset === 'top');
  const status = useStore(state => getDockStatus(dock, state.robots).state);
  if (!visible || (dock.kind === 'home' && !selected && !top)) return null;
  const text = dock.kind === 'home' && (top || !selected) ? dock.shortLabel : `${dock.label} · ${dockStatusLabel(status)}`;
  return <Html center position={[dock.pedestal.x, 1.08, dock.pedestal.y]} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
    <div style={{ background: '#111c25e8', border: `1px solid ${statusColors[status]}`, borderRadius: 4, padding: '3px 5px', font: '600 9px system-ui', color: '#dce9ee', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{text}</div>
  </Html>;
}

export function DockingStations() {
  const indicators = useRef<InstancedMesh>(null);
  const hardware = useMemo(() => {
    const box = new BoxGeometry(1, 1, 1), cable = new TorusGeometry(.105, .014, 5, 16, Math.PI * 1.65);
    const dark = new MeshStandardMaterial({ color: '#192b34', roughness: .77, metalness: .3 });
    const steel = new MeshStandardMaterial({ color: '#788a91', roughness: .5, metalness: .62 });
    const contacts = new MeshStandardMaterial({ color: '#b69a68', roughness: .45, metalness: .72 });
    const trim = new MeshBasicMaterial({ color: '#ffffff' });
    const lights = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const rubber = new MeshStandardMaterial({ color: '#111a20', roughness: .95 });
    return { box, cable, dark, steel, contacts, trim, lights, rubber };
  }, []);
  const parts = useMemo(() => {
    const dark: Part[] = [], steel: Part[] = [], contacts: Part[] = [], trim: Part[] = [], lights: Part[] = [], cable: Part[] = [];
    DOCKS.forEach((dock, dockIndex) => {
      const { x, y, backDirection: back, pedestal } = dock;
      const add = (collection: Part[], px: number, height: number, py: number, width: number, rise: number, depth: number) => collection.push({ dockIndex, position: [px, height, py], scale: [width, rise, depth] });
      // The pad is floor paint, not a raised obstacle. Hardware stays behind
      // the robot and beyond the ends of every staging/charging graph edge.
      add(dark, x, .009, y, dock.pad.width, .003, dock.pad.length);
      add(steel, pedestal.x, .027, pedestal.y, pedestal.width, .05, pedestal.depth);
      add(steel, pedestal.x, .43, pedestal.y, .48, .76, .18);
      add(steel, pedestal.x, .845, pedestal.y, .57, .07, .24);
      const front = pedestal.y - back * .097;
      add(dark, x, .56, front, .35, .25, .008);
      add(lights, x, .735, pedestal.y - back * .104, .32, .055, .010);
      for (const side of [-1, 1]) {
        add(contacts, x + side * .11, .18, pedestal.y - back * .11, .10, .065, .022);
        add(lights, x + side * dock.pad.width / 2, .016, y, .026, .003, dock.pad.length);
        // Short alignment marks at the open end identify the entry direction.
        add(trim, x + side * .20, .016, y - back * .45, .08, .004, .17);
      }
      for (const end of [-1, 1]) add(lights, x, .016, y + end * dock.pad.length / 2, dock.pad.width, .003, .026);
      if (dock.kind === 'charger') {
        // A small painted electrical mark distinguishes the real chargers from
        // the home parking docks even with all scene labels hidden.
        for (const [side, offset, angle] of [[-.055, -.31, -.35], [.015, -.15, .35], [.065, .01, -.35]]) {
          trim.push({ dockIndex, position: [x + side, .017, y + offset], scale: [.075, .003, .22], rotation: [0, angle, 0] });
        }
      }
      cable.push({ dockIndex, position: [x, .35, pedestal.y - back * .097], scale: [1, 1, 1], rotation: [0, back === 1 ? Math.PI : 0, 0] });
    });
    trim.forEach(part => { part.color = DOCKS[part.dockIndex].kind === 'charger' ? '#dab263' : '#a6b9b8'; });
    return { dark, steel, contacts, trim, lights, cable };
  }, []);
  useEffect(() => () => { for (const item of Object.values(hardware)) item.dispose(); }, [hardware]);
  const color = useMemo(() => new Color(), []);
  useFrame(({ clock }) => {
    const mesh = indicators.current;
    if (!mesh) return;
    const state = useStore.getState(), statuses = DOCKS.map(dock => getDockStatus(dock, state.robots));
    const pulse = state.simulationStatus === 'RUNNING' && !state.reducedMotion ? .87 + .13 * Math.sin(clock.elapsedTime * 4) : 1;
    parts.lights.forEach((part, index) => {
      const dock = DOCKS[part.dockIndex], status = statuses[part.dockIndex];
      const selected = state.focusedNodeId === dock.nodeId || (state.selectedRobotId !== null && state.selectedRobotId === (status.robotId ?? dock.ownerRobotId));
      color.set(statusColors[status.state]).multiplyScalar(status.state === 'charging' ? pulse : selected ? 1 : .74);
      mesh.setColorAt(index, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <group>
    <Parts geometry={hardware.box} material={hardware.dark} parts={parts.dark} />
    <Parts geometry={hardware.box} material={hardware.steel} parts={parts.steel} />
    <Parts geometry={hardware.box} material={hardware.contacts} parts={parts.contacts} />
    <Parts geometry={hardware.box} material={hardware.trim} parts={parts.trim} />
    <Parts geometry={hardware.box} material={hardware.lights} parts={parts.lights} instanceRef={indicators} />
    <Parts geometry={hardware.cable} material={hardware.rubber} parts={parts.cable} />
    {DOCKS.map(dock => <DockLabel key={dock.id} dock={dock} />)}
  </group>;
}
