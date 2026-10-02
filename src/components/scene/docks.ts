import { WAREHOUSE_LAYOUT } from '../../simulation/layout';
import type { Robot, WarehouseLayout } from '../../types';

export type DockKind = 'home' | 'charger';
export type DockState = 'ready' | 'occupied' | 'charging' | 'fault';
export interface DockDefinition {
  id: string;
  nodeId: string;
  label: string;
  shortLabel: string;
  kind: DockKind;
  ownerRobotId: string | null;
  x: number;
  y: number;
  backDirection: -1 | 1;
  pedestal: { x: number; y: number; width: number; depth: number };
  pad: { width: number; length: number };
}
export interface DockStatus { state: DockState; robotId: string | null }

export function createDockDefinitions(layout: WarehouseLayout): DockDefinition[] {
  return layout.stations.filter(station => station.kind === 'staging' || station.kind === 'charging').map(station => {
    const home = station.kind === 'staging';
    const backDirection = home ? -1 : 1;
    return {
      id: `DOCK_${station.id}`, nodeId: station.id, label: home ? `Home ${station.label}` : station.label,
      shortLabel: home ? `H${station.id.slice(-2)}` : station.label,
      kind: home ? 'home' : 'charger', ownerRobotId: home ? `R${station.id.slice(-2)}` : null,
      x: station.x, y: station.y, backDirection,
      // All raised hardware is at least .71m behind the station centre. This
      // clears even the AGV's circumscribed .679m turning footprint.
      pedestal: { x: station.x, y: station.y + backDirection * .84, width: .76, depth: .26 },
      pad: { width: 1.15, length: 1.30 },
    };
  });
}

export const DOCKS = createDockDefinitions(WAREHOUSE_LAYOUT);
export const HOME_DOCKS = DOCKS.filter(dock => dock.kind === 'home');
export const CHARGING_DOCKS = DOCKS.filter(dock => dock.kind === 'charger');

export function getDockStatus(dock: DockDefinition, robots: Record<string, Robot>): DockStatus {
  let occupant: Robot | undefined;
  let best = Infinity;
  for (const robot of Object.values(robots)) {
    const dx = robot.position.x - dock.x, dy = robot.position.y - dock.y;
    const distance = dx * dx + dy * dy;
    const cosine = Math.abs(Math.cos(robot.heading)), sine = Math.abs(Math.sin(robot.heading));
    const halfX = cosine * WAREHOUSE_LAYOUT.robotFootprint.length / 2 + sine * WAREHOUSE_LAYOUT.robotFootprint.width / 2;
    const halfY = sine * WAREHOUSE_LAYOUT.robotFootprint.length / 2 + cosine * WAREHOUSE_LAYOUT.robotFootprint.width / 2;
    // Conservative footprint occupancy keeps a bay busy until the departing
    // robot clears its painted pad. It does not imply parking or charging.
    if (Math.abs(dx) <= dock.pad.width / 2 + halfX && Math.abs(dy) <= dock.pad.length / 2 + halfY && distance < best) { occupant = robot; best = distance; }
  }
  if (!occupant) return { state: 'ready', robotId: null };
  if (occupant.failed || occupant.state === 'FAILED') return { state: 'fault', robotId: occupant.id };
  if (dock.kind === 'charger' && occupant.state === 'CHARGING') return { state: 'charging', robotId: occupant.id };
  return { state: 'occupied', robotId: occupant.id };
}

export function getRobotHomeDock(robot: Pick<Robot, 'homeNodeId'>): DockDefinition | undefined {
  return HOME_DOCKS.find(dock => dock.nodeId === robot.homeNodeId);
}

export function dockStatusLabel(state: DockState): string {
  return { ready: 'Ready', occupied: 'Occupied', charging: 'Charging', fault: 'Fault' }[state];
}
