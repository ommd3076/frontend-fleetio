import type { RobotState } from '../types';
import { WAREHOUSE_LAYOUT } from '../simulation/layout';
export function formatTime(time: number) { const seconds = Math.max(0, Math.floor(time)); return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
export function nodeLabel(id: string | null | undefined) { if (!id) return '—'; return WAREHOUSE_LAYOUT.stations.find(station => station.id === id)?.label ?? id.replace('_LEFT_SERVICE', ' · left').replace('_RIGHT_SERVICE', ' · right').replaceAll('_', ' '); }
export function stateLabel(state: RobotState) { return state.toLowerCase().replaceAll('_', ' '); }
