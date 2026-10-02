import { useState } from 'react';
import { Play, Pause, Square, RotateCcw, SlidersHorizontal, Route, Tags, Layers3, Eye, Camera, Scan, Crosshair, ChevronDown, Wrench, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import { SCENARIOS } from '../simulation/layout';
import type { ScenarioId } from '../types';
import { formatTime } from './dashboardFormatting';

function ManualControls() {
  const { robots, jecs, selectedRobotId, selectedJecId, blockedEdges, networkProfile, sendCommand } = useStore(useShallow(state => ({ robots: state.robots, jecs: state.jecs, selectedRobotId: state.selectedRobotId, selectedJecId: state.selectedJecId, blockedEdges: state.blockedEdges, networkProfile: state.networkProfile, sendCommand: state.sendCommand })));
  const [robotChoice, setRobotChoice] = useState(''); const [jecChoice, setJecChoice] = useState('');
  const robotId = robotChoice || selectedRobotId || Object.keys(robots)[0] || '', robot = robots[robotId];
  const jecId = jecChoice || selectedJecId || jecs[0]?.id || '', jec = jecs.find(item => item.id === jecId);
  const blocked = blockedEdges.some(edge => edge === 'NARROW_1' || edge === ['J_1_3', 'J_2_3'].sort().join('|'));
  return <div className="manual-controls">
    <p>Change simulation inputs and observe recovery.</p>
    <div className="manual-control-row"><select aria-label="Robot for failure controls" value={robotId} onChange={event => setRobotChoice(event.target.value)}>{Object.keys(robots).map(id => <option key={id}>{id}</option>)}</select><button disabled={!robot} className={robot?.failed ? 'button green-button' : 'button danger-soft'} onClick={() => sendCommand({ type: robot?.failed ? 'RECOVER_ROBOT' : 'FAIL_ROBOT', robotId })}>{robot?.failed ? 'Recover robot' : 'Fail robot'}</button></div>
    <div className="manual-control-row"><select aria-label="JEC for outage controls" value={jecId} onChange={event => setJecChoice(event.target.value)}>{jecs.map(item => <option key={item.id}>{item.id}</option>)}</select><button disabled={!jec} className="button" onClick={() => sendCommand({ type: jec?.online ? 'DISABLE_JEC' : 'ENABLE_JEC', jecId })}>{jec?.online ? 'Disable JEC' : 'Restore JEC'}</button></div>
    <div className="manual-control-row"><span>Narrow passage</span><button className="button" onClick={() => sendCommand({ type: blocked ? 'CLEAR_AISLE' : 'BLOCK_AISLE', resourceId: 'NARROW_1' })}>{blocked ? 'Clear aisle' : 'Block aisle'}</button></div>
    <div className="manual-control-row"><span>Communications</span><button className="button" onClick={() => sendCommand({ type: 'SET_NETWORK_PROFILE', profile: networkProfile === 'normal' ? 'degraded' : 'normal' })}>{networkProfile === 'normal' ? 'Degrade network' : 'Restore network'}</button></div>
  </div>;
}
export function SceneControls() {
  const { status, speed, scenarioId, progress, simTime, togglePlay, stopSim, resetSim, setSpeed, startScenario } = useStore(useShallow(state => ({ status: state.simulationStatus, speed: state.speedMultiplier, scenarioId: state.scenarioId, progress: state.scenarioProgress, simTime: state.metrics.simTime, togglePlay: state.togglePlay, stopSim: state.stopSim, resetSim: state.resetSim, setSpeed: state.setSpeed, startScenario: state.startScenario })));
  const [scenarioChoice, setScenarioChoice] = useState<ScenarioId>(scenarioId); const [manual, setManual] = useState(false); const [scenarioOpen, setScenarioOpen] = useState(false);
  const current = SCENARIOS.find(scenario => scenario.id === scenarioId);
  return <>
    <div className="scene-toolbar">
      <div className="simulation-pill"><i className={status === 'RUNNING' ? 'running' : status === 'PAUSED' ? 'paused' : ''} /><strong>{status === 'RUNNING' ? 'Simulation Running' : status === 'PAUSED' ? 'Simulation Paused' : simTime > 0 ? 'Simulation Stopped' : 'Simulation Ready'}</strong><time>{formatTime(simTime)}</time></div>
      <div className="playback-controls"><span className="control-label">Speed</span><div className="segmented">{[0.5, 1, 2].map(value => <button key={value} className={speed === value ? 'active' : ''} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}x</button>)}</div><button className="button" onClick={togglePlay}>{status === 'RUNNING' ? <Pause size={14} /> : <Play size={14} />}{status === 'RUNNING' ? 'Pause' : 'Play'}</button><button className="button danger-button" onClick={stopSim}><Square size={12} />Stop</button><button className="button icon-button reset-button" title="Reset this scenario" aria-label="Reset simulation" onClick={resetSim}><RotateCcw size={15} /></button></div>
    </div>
    <div className="scenario-panel"><button className="scenario-heading" aria-expanded={scenarioOpen} onClick={() => setScenarioOpen(value => !value)}><SlidersHorizontal size={14} /><span>{current?.label ?? 'Demonstration'}</span><ChevronDown size={13} /></button>{scenarioOpen && <div className="scenario-picker"><label htmlFor="scenario">Demonstration</label><div><select id="scenario" value={scenarioChoice} onChange={event => setScenarioChoice(event.target.value as ScenarioId)}>{SCENARIOS.map(scenario => <option value={scenario.id} key={scenario.id}>{scenario.label}</option>)}</select><button className="button primary-button" onClick={() => { startScenario(scenarioChoice); setScenarioOpen(false); }}>Run</button></div><p>{SCENARIOS.find(scenario => scenario.id === scenarioChoice)?.description}</p></div>}<div className={`scenario-progress ${progress.timedOut ? 'red-text' : progress.completed ? 'green-text' : ''}`}><strong>{progress.stage}</strong><span title={progress.detail}>{progress.detail}</span></div></div>
    <div className="manual-panel"><button className="button manual-toggle" aria-expanded={manual} onClick={() => setManual(value => !value)}>{manual ? <X size={14} /> : <Wrench size={14} />} Recovery controls</button>{manual && <ManualControls />}</div>
  </>;
}
export function SceneViewControls() {
  const { routes, reservations, labels, futures, camera, selectedRobotId, setToggle, setCamera } = useStore(useShallow(state => ({ routes: state.showRoutes, reservations: state.showReservations, labels: state.showLabels, futures: state.showFutures, camera: state.cameraPreset, selectedRobotId: state.selectedRobotId, setToggle: state.setToggle, setCamera: state.setCamera })));
  return <div className="scene-view-controls"><div className="camera-buttons"><button className={camera === 'overview' ? 'active' : ''} title="Reset overview camera" aria-label="Overview camera" onClick={() => setCamera('overview')}><Camera size={15} /></button><button className={camera === 'top' ? 'active' : ''} title="Top-down camera" aria-label="Top-down camera" onClick={() => setCamera('top')}><Scan size={15} /></button><button disabled={!selectedRobotId} className={camera === 'follow' ? 'active' : ''} title="Follow selected robot" aria-label="Follow selected robot" onClick={() => setCamera('follow')}><Crosshair size={15} /></button></div><div className="overlay-buttons">{([{ key: 'showRoutes', label: 'Routes', icon: Route, on: routes }, { key: 'showReservations', label: 'Reservations', icon: Layers3, on: reservations }, { key: 'showLabels', label: 'Labels', icon: Tags, on: labels }, { key: 'showFutures', label: 'Intents', icon: Eye, on: futures }]).map(item => <button key={item.key} className={item.on ? 'active' : ''} aria-pressed={item.on} onClick={() => setToggle(item.key, !item.on)}><item.icon size={13} /><span>{item.label}</span></button>)}</div></div>;
}
