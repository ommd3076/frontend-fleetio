import { useEffect, useState } from 'react';
import { BarChart3, Bot, X, AlertTriangle, Radio, MapPin } from 'lucide-react';
import { useStore } from '../store';
import { Header } from './Header';
import { FleetSummary } from './FleetSummary';
import { RobotInspector } from './RobotInspector';
import { EventFeed } from './EventFeed';
import { WarehouseCanvas } from './WarehouseCanvas';
import { AnalyticsView, FleetView, SettingsView, TasksView } from './OperationsViews';
import { DashboardCharts } from './DashboardCharts';
import { SceneControls, SceneViewControls } from './SceneControls';
import { WAREHOUSE_LAYOUT } from '../simulation/layout';
import { initEngine } from '../simulation/engine';
import { observeSystemMotion, savedReducedMotion } from '../presentationPreferences';
import { DockDirectory } from './DockInformation';

function RuntimeNotice() {
  const runtimeError = useStore(state => state.runtimeError);
  const retry = useStore(state => state.resetSim);
  if (!runtimeError) return null;
  return <div className="runtime-notice" role="alert"><AlertTriangle size={17} /><span>{runtimeError}</span><button className="button" onClick={retry}>Reset</button></div>;
}
function MapDirectory() {
  const jecs = useStore(state => state.jecs), setSelectedJec = useStore(state => state.setSelectedJec), focusNode = useStore(state => state.focusNode);
  return <section className="map-directory dashboard-card"><div className="card-heading"><h3><MapPin size={15} /> Warehouse Resources</h3><span className="subtle">16 × 46 m</span></div><div className="resource-directory">{jecs.map(jec => <button key={jec.id} onClick={() => { focusNode(jec.resourceId); setSelectedJec(jec.id); }}><Radio size={15} /><span><strong>{jec.id}</strong><small>{jec.resourceId}</small></span><i className={`status-dot ${jec.online ? 'green' : 'amber'}`} /></button>)}{WAREHOUSE_LAYOUT.stations.filter(station => station.kind !== 'staging' && station.kind !== 'charging').map(station => <button key={station.id} onClick={() => focusNode(station.id)}><MapPin size={15} /><span><strong>{station.label}</strong><small>{station.kind}</small></span></button>)}</div><DockDirectory /></section>;
}
function LiveDashboard({ mapMode = false }: { mapMode?: boolean }) {
  const [drawer, setDrawer] = useState<'fleet' | 'inspector' | null>(null);
  const [mapFleet, setMapFleet] = useState(false), [mapInspector, setMapInspector] = useState(false);
  const toggleRail = (rail: 'fleet' | 'inspector') => {
    if (mapMode && window.innerWidth >= 1100) {
      if (rail === 'fleet') setMapFleet(value => !value); else setMapInspector(value => !value);
    } else setDrawer(rail);
  };
  useEffect(() => useStore.subscribe((state, previous) => {
    if (state.selectedRobotId === previous.selectedRobotId && state.selectedJecId === previous.selectedJecId) return;
    if (window.innerWidth < 1100) setDrawer('inspector'); else if (state.activeView === 'Map') setMapInspector(true);
  }), []);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawer(null); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);
  useEffect(() => {
    if (!drawer) return;
    const panel = document.querySelector<HTMLElement>(`[data-fleet-drawer="${drawer}"]`);
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => [...(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') ?? [])].filter(element => element.offsetParent !== null);
    focusables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, [drawer]);
  return <div className={`live-dashboard ${mapMode ? `map-view ${mapFleet ? '' : 'map-hide-fleet'} ${mapInspector ? '' : 'map-hide-inspector'}` : ''}`}>
    {drawer && <button className="drawer-backdrop" aria-label="Close side panel" onClick={() => setDrawer(null)} />}
    <aside className={`left-rail ${drawer === 'fleet' ? 'drawer-open' : ''}`} data-fleet-drawer="fleet" role={drawer === 'fleet' ? 'dialog' : undefined} aria-modal={drawer === 'fleet' ? true : undefined} aria-label="Fleet overview"><button className="drawer-close icon-button" aria-label="Close fleet overview" onClick={() => setDrawer(null)}><X size={18} /></button><FleetSummary /></aside>
    <main className="dashboard-centre"><div className="scene-shell"><WarehouseCanvas /><SceneControls /><SceneViewControls /><div className="scene-hint">Drag to orbit · Scroll to zoom</div><div className="mobile-rail-controls"><button className="button" aria-pressed={mapMode && window.innerWidth >= 1100 ? mapFleet : drawer === 'fleet'} onClick={() => toggleRail('fleet')}><BarChart3 size={14} />Fleet</button><button className="button" aria-pressed={mapMode && window.innerWidth >= 1100 ? mapInspector : drawer === 'inspector'} onClick={() => toggleRail('inspector')}><Bot size={14} />Inspector</button></div></div><div className="dashboard-lower-band">{mapMode ? <MapDirectory /> : <><EventFeed /><DashboardCharts /></>}</div></main>
    <aside className={`right-rail ${drawer === 'inspector' ? 'drawer-open' : ''}`} data-fleet-drawer="inspector" role={drawer === 'inspector' ? 'dialog' : undefined} aria-modal={drawer === 'inspector' ? true : undefined} aria-label="Selected robot or JEC inspector"><button className="drawer-close icon-button" aria-label="Close inspector" onClick={() => setDrawer(null)}><X size={18} /></button><RobotInspector /></aside>
  </div>;
}
export function Layout() {
  const activeView = useStore(state => state.activeView);
  const reducedMotion = useStore(state => state.reducedMotion);
  const status = useStore(state => state.simulationStatus);
  useEffect(() => { initEngine(); }, []);
  useEffect(() => observeSystemMotion(systemReducedMotion => useStore.setState({ systemReducedMotion, reducedMotion: systemReducedMotion || savedReducedMotion() })), []);
  return <div className="fleet-app" data-reduced-motion={String(reducedMotion)} data-status={status}><Header /><RuntimeNotice /><div className="app-body">{(activeView === 'Live' || activeView === 'Map') && <LiveDashboard mapMode={activeView === 'Map'} />}{activeView === 'Analytics' && <AnalyticsView />}{activeView === 'Tasks' && <TasksView />}{activeView === 'Robots' && <FleetView />}{activeView === 'Settings' && <SettingsView />}</div></div>;
}
