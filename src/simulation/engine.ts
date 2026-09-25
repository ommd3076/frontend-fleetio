import { useStore } from '../store';

let worker: Worker | null = null;

export function initEngine() {
  if (worker) return;
  
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  
  worker.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'INIT_GRAPH') {
      useStore.getState().updateState({ graph: payload.graph });
    } else if (type === 'STATE_UPDATE') {
      useStore.getState().updateState({
        robots: payload.robots,
        tasks: payload.tasks,
        events: payload.events,
        metrics: payload.metrics,
        reservations: payload.reservations,
        futureTrajectories: payload.futureTrajectories,
        blockedBy: payload.blockedBy
      });
    }
  };

  // Initially sync the state
  const state = useStore.getState();
  worker.postMessage({ type: state.simulationStatus === 'RUNNING' ? 'PLAY' : 'PAUSE' });
  worker.postMessage({ type: 'SPEED', payload: state.speedMultiplier });
  
  // Set up subscription
  useStore.subscribe((state, prevState) => {
    if (!worker) return;
    
    if (state.simulationStatus !== prevState.simulationStatus) {
      if (state.simulationStatus === 'RUNNING') {
        worker.postMessage({ type: 'PLAY' });
      } else if (state.simulationStatus === 'PAUSED') {
        worker.postMessage({ type: 'PAUSE' });
      }
    }
    if (state.speedMultiplier !== prevState.speedMultiplier) {
      worker.postMessage({ type: 'SPEED', payload: state.speedMultiplier });
    }
  });
}

export const resetSimulation = () => {
  if (worker) {
    worker.postMessage({ type: 'RESET' });
  }
};
