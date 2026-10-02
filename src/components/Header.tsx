import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Search, X, Bot, MapPin, ClipboardList, Radio } from 'lucide-react';
import { useStore } from '../store';
import { WAREHOUSE_LAYOUT } from '../simulation/layout';
import type { ActiveView } from '../types';

const views: ActiveView[] = ['Live', 'Analytics', 'Tasks', 'Robots', 'Map', 'Settings'];
function WallClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  return <div className="wall-clock"><time>{now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</time><span>{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>;
}
function FleetSearch() {
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false);
  const robots = useStore(state => open ? state.robots : null);
  const tasks = useStore(state => open ? state.tasks : null);
  const jecs = useStore(state => open ? state.jecs : null);
  const input = useRef<HTMLInputElement>(null); const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.current?.focus(); setOpen(true); } if (event.key === 'Escape') setOpen(false); };
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('keydown', keys); window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', keys); window.removeEventListener('pointerdown', outside); };
  }, []);
  const hits = useMemo(() => {
    if (!open) return [];
    const needle = query.trim().toLowerCase();
    const candidates = [
      ...Object.values(robots ?? {}).map(robot => ({ id: robot.id, kind: 'robot', label: robot.id, detail: robot.state.replaceAll('_', ' ').toLowerCase() })),
      ...Object.values(tasks ?? {}).map(task => ({ id: task.id, kind: 'task', label: task.id, detail: `${task.pickupNodeId} → ${task.dropNodeId}` })),
      ...(jecs ?? []).map(jec => ({ id: jec.id, kind: 'jec', label: jec.id, detail: jec.online ? 'Junction controller online' : 'Peer fallback active' })),
      ...WAREHOUSE_LAYOUT.stations.map(station => ({ id: station.id, kind: 'station', label: station.label, detail: station.id })),
    ];
    return candidates.filter(hit => !needle || `${hit.label} ${hit.detail}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, open, robots, tasks, jecs]);
  const select = (hit: typeof hits[number]) => {
    const state = useStore.getState(); state.setActiveView('Live');
    if (hit.kind === 'robot') { state.setSelectedRobot(hit.id); state.setCamera('follow'); }
    else if (hit.kind === 'jec') { const jec = state.jecs.find(item => item.id === hit.id); if (jec) state.focusNode(jec.resourceId); state.setSelectedJec(hit.id); }
    else if (hit.kind === 'task') { const task = state.tasks[hit.id]; if (task?.assignedRobotId) { state.setSelectedRobot(task.assignedRobotId); state.setCamera('follow'); } else if (task) state.focusNode(task.pickupNodeId); }
    else state.focusNode(hit.id);
    setQuery(''); setOpen(false); input.current?.blur();
  };
  return <div className="fleet-search" ref={container}>
    <Search size={16} aria-hidden="true" /><input ref={input} aria-label="Search robots, tasks, JECs and stations" placeholder="Search fleet…" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === 'Enter' && hits[0]) select(hits[0]); }} />
    {query ? <button className="icon-button search-clear" aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={13} /></button> : <kbd>⌘ K</kbd>}
    {open && <div className="search-results" role="listbox" aria-label="Search results">{hits.length ? hits.map(hit => { const Icon = hit.kind === 'robot' ? Bot : hit.kind === 'task' ? ClipboardList : hit.kind === 'jec' ? Radio : MapPin; return <button key={`${hit.kind}-${hit.id}`} role="option" aria-selected="false" onClick={() => select(hit)}><Icon size={16} /><span><strong>{hit.label}</strong><small>{hit.detail}</small></span><span className="search-kind">{hit.kind}</span></button>; }) : <div className="search-empty">No matches. Try R01, T001, JEC or Packing.</div>}</div>}
  </div>;
}
export function Header() {
  const activeView = useStore(state => state.activeView); const setActiveView = useStore(state => state.setActiveView);
  return <header className="app-header">
    <button className="brand" onClick={() => setActiveView('Live')} aria-label="FleetIO live dashboard"><span className="brand-mark"><Box size={25} strokeWidth={1.7} /></span><span><strong>FLEETIO</strong><small>Autonomous warehouse system</small></span></button>
    <nav className="main-nav" aria-label="Main navigation">{views.map(view => <button key={view} aria-current={view === activeView ? 'page' : undefined} className={view === activeView ? 'active' : ''} onClick={() => setActiveView(view)}>{view}</button>)}</nav>
    <div className="header-tools"><FleetSearch /><WallClock /><span className="avatar" title="Local visual prototype">F</span></div>
  </header>;
}
