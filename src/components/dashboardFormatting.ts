import type { RobotState, Robot, Task } from '../types';
import { WAREHOUSE_LAYOUT } from '../simulation/layout';
export function formatTime(time: number) { const seconds = Math.max(0, Math.floor(time)); return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
export function nodeLabel(id: string | null | undefined) { if (!id) return '—'; return WAREHOUSE_LAYOUT.stations.find(station => station.id === id)?.label ?? id.replace('_LEFT_SERVICE', ' · left').replace('_RIGHT_SERVICE', ' · right').replaceAll('_', ' '); }
export function stateLabel(state: RobotState) { return state.toLowerCase().replaceAll('_', ' '); }

export function robotDestination(robot: Robot, task?: Task): string {
  if (robot.failed) return nodeLabel(task?.dropNodeId);
  const endpoint = robot.route.at(-1)?.nodeId;
  if (endpoint) return nodeLabel(endpoint);
  if (robot.state === 'CHARGING' || robot.waitKind === 'RECOVERY') {
    const type = robot.state === 'CHARGING' ? 'CHARGING' : 'REFUGE';
    const current = Object.values(WAREHOUSE_LAYOUT.graph.nodes).find(node => node.type === type && Math.hypot(node.x - robot.position.x, node.y - robot.position.y) < .15);
    return current ? nodeLabel(current.id) : type === 'CHARGING' ? 'Charging station' : 'Recovery refuge';
  }
  const mode = robot.state === 'WAITING' ? robot.resumeState : robot.state;
  if (mode === 'MOVING_TO_PICKUP' || mode === 'PICKING') return nodeLabel(task?.pickupNodeId);
  if (mode === 'MOVING_TO_DROPOFF' || mode === 'DROPPING') return nodeLabel(task?.dropNodeId);
  if (mode === 'RETURNING_TO_STAGING') return nodeLabel(robot.homeNodeId);
  if (mode === 'MOVING_TO_CHARGER') return 'Charging station';
  return '—';
}
