import { create } from 'zustand';
import type { SimState, RobotId } from './types';
import { initEngine, resetSimulation } from './simulation/engine';

interface AppState extends SimState {
  activeView: string;
  showRoutes: boolean;
  showReservations: boolean;
  showLabels: boolean;
  updateState: (partial: Partial<SimState>) => void;
  setSelectedRobot: (id: RobotId | null) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  resetSim: () => void;
  setActiveView: (view: string) => void;
  setToggle: (key: string, value: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  robots: {},
  tasks: {},
  events: [],
  metrics: {
    activeRobots: 0,
    tasksCompleted: 0,
    tasksInQueue: 0,
    avgTaskTime: 0,
    robotsWaiting: 0,
    deadlocksResolved: 0,
    overlapViolations: 0,
    minimumSeparation: 0,
    simTime: 0
  },
  graph: null,
  selectedRobotId: 'R01',
  simulationStatus: 'STOPPED',
  speedMultiplier: 1,
  reservations: {},
  futureTrajectories: {},
  blockedBy: {},
  activeView: 'Map',
  showRoutes: true,
  showReservations: false,
  showLabels: true,

  updateState: (partial) => set((state) => ({ ...state, ...partial })),
  setSelectedRobot: (id) => set({ selectedRobotId: id }),
  togglePlay: () => {
    const { simulationStatus } = get();
    if (simulationStatus === 'STOPPED') {
      initEngine(); // ensure worker is created
      set({ simulationStatus: 'RUNNING' });
    } else if (simulationStatus === 'RUNNING') {
      set({ simulationStatus: 'PAUSED' });
    } else if (simulationStatus === 'PAUSED') {
      set({ simulationStatus: 'RUNNING' });
    }
  },
  setSpeed: (speed) => set({ speedMultiplier: speed }),
  resetSim: () => {
    set({ simulationStatus: 'STOPPED' });
    resetSimulation();
  },
  setActiveView: (view: string) => set({ activeView: view }),
  setToggle: (key: string, value: boolean) => set({ [key]: value } as any)
}));
