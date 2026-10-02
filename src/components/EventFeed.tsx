import { Radio, PackageCheck, AlertTriangle, Route, Bot } from 'lucide-react';
import { useStore } from '../store';
import { formatTime } from './dashboardFormatting';
export function EventFeed() {
  const events = useStore(state => state.events);
  return <section className="event-feed dashboard-card"><div className="card-heading"><h3><Radio size={15} /> Live Events</h3><span className="subtle">Simulation time</span></div><div className="event-list" role="log" aria-label="Live simulation events">
    {events.slice(-6).reverse().map(event => { const warning = /fail|deadlock|blocked|wait|outage|offline|degrad|recovery_required/i.test(event.kind); const delivered = /complete|drop|pick/i.test(event.kind); const Icon = warning ? AlertTriangle : delivered ? PackageCheck : /route/i.test(event.kind) ? Route : Bot;
      return <div className="event-row" key={event.id}><time>{formatTime(event.time)}</time><span className={`event-icon ${warning ? 'amber' : delivered ? 'green' : 'blue'}`}><Icon size={12} /></span><span title={event.text}>{event.text}</span></div>;
    })}
    {!events.length && <div className="empty-state compact">Press Play to start the simulation.</div>}
  </div></section>;
}
