import { Activity, Network, ShieldCheck, Timer, Route, BatteryCharging } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import { KeyValue } from './DashboardPrimitives';
export function FleetSummary() {
  const { robots, tasks, metrics, jecs, incidents, networkProfile } = useStore(useShallow(state => ({ robots: state.robots, tasks: state.tasks, metrics: state.metrics, jecs: state.jecs, incidents: state.incidents, networkProfile: state.networkProfile })));
  const fleet = Object.values(robots), orders = Object.values(tasks);
  const total = fleet.length, idle = fleet.filter(robot => robot.state === 'IDLE').length, charging = fleet.filter(robot => robot.state === 'CHARGING').length;
  const active = metrics.activeRobots;
  const failed = fleet.filter(robot => robot.failed || robot.state === 'FAILED').length;
  const completed = orders.filter(task => task.status === 'COMPLETED').length, queued = orders.filter(task => task.status === 'QUEUED').length;
  return <div className="fleet-summary rail-content">
    <div className="rail-heading"><h2>Fleet Overview</h2><p>Live status of your autonomous fleet</p></div>
    <div className="fleet-counts"><div className="metric-card"><strong className="blue-text">{total}</strong><span>Total Robots</span></div><div className="metric-card"><strong className="green-text">{active}</strong><span>Active</span></div><div className="metric-card"><strong className="amber-text">{idle}</strong><span>Idle</span></div><div className="metric-card"><strong>{charging}</strong><span>Charging</span></div></div>
    <div className="summary-card"><div className="card-heading"><h3>Tasks</h3><Activity size={14} /></div><div className="task-summary"><span><strong>{completed}</strong> Completed</span><span><strong>{queued}</strong> In Queue</span></div><div className="progress-track"><div style={{ width: `${orders.length ? completed / orders.length * 100 : 0}%` }} /></div></div>
    <div className="summary-card"><div className="metric-title"><Timer size={14} /> Average Task Time</div><div className="large-metric">{completed ? metrics.avgTaskTime.toFixed(1) : '—'} <small>{completed ? 's' : ''}</small></div></div>
    <div className="summary-card"><div className="metric-title"><Route size={14} /> Total Distance Travelled</div><div className="large-metric">{metrics.totalDistance >= 1000 ? (metrics.totalDistance / 1000).toFixed(2) : metrics.totalDistance.toFixed(1)} <small>{metrics.totalDistance >= 1000 ? 'km' : 'm'}</small></div></div>
    <div className="summary-card"><div className="metric-title"><Network size={14} /> Active Conflicts</div><div className={`large-metric ${metrics.activeConflicts ? 'red-text' : ''}`}>{metrics.activeConflicts}</div><div className="card-footnote">{metrics.robotsWaiting} waiting · {metrics.deadlocksResolved} recoveries</div></div>
    <div className="summary-card coordination-summary"><div className="card-heading"><h3>Coordination</h3><ShieldCheck size={15} /></div><KeyValue label="JECs online" value={`${jecs.filter(jec => jec.online).length} / ${jecs.length}`} /><KeyValue label="Communication" value={networkProfile === 'normal' ? 'Normal' : 'Degraded'} accent={networkProfile === 'degraded' ? 'amber-text' : 'green-text'} /><KeyValue label="Min separation" value={metrics.minimumSeparation ? `${metrics.minimumSeparation.toFixed(2)} m` : '—'} /><KeyValue label="Overlap alerts" value={metrics.overlapViolations} accent={metrics.overlapViolations ? 'red-text' : ''} /></div>
    <div className="summary-card prototype-note"><BatteryCharging size={22} /><div><strong>Visual prototype</strong><span>Simulated fleet and battery. {failed ? `${failed} robot offline. ` : ''}{incidents.filter(incident => !incident.resolved).length} open incidents.</span></div></div>
  </div>;
}
