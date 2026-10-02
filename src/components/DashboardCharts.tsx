import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import type { MetricSample } from '../types';

export function ThroughputChart({ expanded = false }: { expanded?: boolean }) {
  const { throughput, history } = useStore(useShallow(state => ({ throughput: state.metrics.throughput, history: state.metricHistory })));
  const samples = history.slice(-16), max = Math.max(1, ...samples.map(sample => sample.throughput));
  return <section className={`dashboard-card chart-card ${expanded ? 'expanded-chart' : ''}`}><h3>Task Throughput</h3><div className="chart-number">{Math.round(throughput)}<small>/ hr</small></div><div className="bar-chart" role="img" aria-label={`Measured task throughput: ${throughput.toFixed(1)} per simulation hour`}>
    {samples.length ? samples.map(sample => <div key={sample.time} style={{ height: `${Math.max(2, sample.throughput / max * 100)}%` }} title={`${sample.time.toFixed(0)}s: ${sample.throughput.toFixed(1)} tasks/hr`} />) : <span className="chart-empty">Awaiting completed tasks</span>}
  </div></section>;
}
export function UtilizationChart({ expanded = false }: { expanded?: boolean }) {
  const robots = useStore(state => state.robots), fleet = Object.values(robots), total = fleet.length;
  const active = fleet.filter(robot => !['IDLE', 'CHARGING', 'FAILED'].includes(robot.state)).length;
  const idle = fleet.filter(robot => robot.state === 'IDLE').length, charging = fleet.filter(robot => robot.state === 'CHARGING').length;
  const failed = fleet.filter(robot => robot.state === 'FAILED').length;
  const value = total ? Math.round(active / total * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  return <section className={`dashboard-card chart-card ${expanded ? 'expanded-chart' : ''}`}><h3>Robot Utilization</h3><div className="utilization-body"><div className="donut" role="img" aria-label={`${value}% of robots are active, including waiting tasks`}><svg className="utilization-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="#273442" strokeWidth="12" /><circle className="utilization-value" cx="50" cy="50" r="42" fill="none" stroke="#4fd4a8" strokeWidth="12" strokeDasharray={`${circumference * value / 100} ${circumference}`} transform="rotate(-90 50 50)" /></svg><span>{value}%</span></div><div className="chart-legend"><div><i className="green" />Active <b>{active}</b></div><div><i className="amber" />Idle <b>{idle}</b></div><div><i className="blue" />Charging <b>{charging}</b></div>{failed > 0 && <div><i className="red" />Failed <b>{failed}</b></div>}</div></div></section>;
}
function WaitLine({ samples }: { samples: MetricSample[] }) {
  const max = Math.max(1, ...samples.map(sample => sample.wait));
  const points = samples.map((sample, index) => `${samples.length > 1 ? index / (samples.length - 1) * 240 : 0},${70 - sample.wait / max * 57}`).join(' ');
  return <svg className="wait-chart" viewBox="0 0 240 78" preserveAspectRatio="none" role="img" aria-label="Average waiting time history"><defs><linearGradient id="wait-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#43cba9" stopOpacity=".25" /><stop offset="100%" stopColor="#43cba9" stopOpacity="0" /></linearGradient></defs><line x1="0" y1="71" x2="240" y2="71" stroke="#293544" />{points && <><polygon points={`0,78 ${points} 240,78`} fill="url(#wait-fill)" /><polyline points={points} fill="none" stroke="#5ad8b1" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}</svg>;
}
export function WaitChart({ expanded = false }: { expanded?: boolean }) {
  const { avgWaitTime, history } = useStore(useShallow(state => ({ avgWaitTime: state.metrics.avgWaitTime, history: state.metricHistory })));
  return <section className={`dashboard-card chart-card ${expanded ? 'expanded-chart' : ''}`}><h3>Average Wait Time</h3><div className="chart-number">{avgWaitTime.toFixed(1)}<small>s</small></div><WaitLine samples={history.slice(-32)} /></section>;
}
export function DashboardCharts() { return <><ThroughputChart /><UtilizationChart /><WaitChart /></>; }
