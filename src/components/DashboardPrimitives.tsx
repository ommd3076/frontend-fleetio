import type { ReactNode } from 'react';
import type { RobotState } from '../types';
export function StateBadge({ state }: { state: RobotState }) { const tone = state === 'FAILED' ? 'red' : state === 'WAITING' ? 'amber' : state === 'IDLE' ? 'muted' : state === 'CHARGING' ? 'blue' : 'green'; return <span className={`state-badge ${tone}`}>{state === 'FAILED' ? 'Failed' : state === 'WAITING' ? 'Waiting' : state === 'IDLE' ? 'Idle' : state === 'CHARGING' ? 'Charging' : 'Active'}</span>; }
export function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) { return <div className="section-heading"><div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{action}</div>; }
export function EmptyState({ children }: { children: ReactNode }) { return <div className="empty-state">{children}</div>; }
export function KeyValue({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) { return <div className="key-value"><span>{label}</span><strong className={accent ?? ''}>{value}</strong></div>; }
