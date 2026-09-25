import React from 'react';
import { useStore } from '../store';
import { Play, Pause, RotateCcw } from 'lucide-react';
export const Header: React.FC = () => {
  const { simulationStatus, togglePlay, setSpeed, speedMultiplier, metrics, resetSim, activeView, setActiveView } = useStore();
  
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = (time % 60).toFixed(1);
    return `T+ ${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
  };

  return (
    <header className="h-[clamp(56px,6vh,64px)] shrink-0 bg-[#07111f] border-b border-[#192a37] flex items-center justify-between px-[clamp(16px,1.5vw,32px)] select-none">
      <div className="flex items-center space-x-3 w-[clamp(205px,13vw,270px)]">
        <div className="w-5 h-5 border border-[#56b8f8] rotate-45 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-[#56b8f8]" />
        </div>
        <div>
          <div className="text-[13px] font-semibold tracking-[0.12em] text-[#e2ebf1] leading-tight">FLEETIO <span className="text-[#506678] font-normal">/ SIH26123</span></div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[#71879a] leading-tight">Operations · Warehouse 01</div>
        </div>
      </div>
      
      <div className="flex-1 flex justify-center space-x-[clamp(16px,2vw,38px)]">
        {['Overview', 'Fleet', 'Tasks', 'Map', 'Analytics'].map((item) => (
          <button
            key={item} 
            aria-current={activeView === item ? 'page' : undefined}
            className={`text-[11px] uppercase tracking-[0.12em] py-2 cursor-pointer ${activeView === item ? 'text-[#e5edf2] border-b border-[#54b7f5] font-medium' : 'text-[#71879a] hover:text-[#b6c4ce]'}`}
            onClick={() => setActiveView(item)}
          >
            {item}
          </button>
        ))}
      </div>
      
      <div className="flex items-center space-x-[clamp(12px,1.4vw,26px)] w-auto justify-end">
        <div className="flex flex-col items-end">
          <div className="text-[9px] text-[#71879a] uppercase tracking-wider">Sim Time</div>
          <div className="font-mono text-[12px] text-[#dce7ed]">{formatTime(metrics.simTime)}</div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="text-[9px] text-[#71879a] uppercase tracking-wider">Status</div>
          <div className="flex items-center space-x-1.5">
            <div className={`w-2 h-2 rounded-full ${simulationStatus === 'RUNNING' ? 'bg-[#3ED598]' : simulationStatus === 'PAUSED' ? 'bg-[#F2B84B]' : 'bg-[#718198]'}`} />
            <span className="text-sm text-[#E8EEF6]">
              {simulationStatus === 'RUNNING' ? 'Running' : simulationStatus === 'PAUSED' ? 'Paused' : 'Stopped'}
            </span>
          </div>
        </div>
        
        <div className="flex bg-[#0b1621] border border-[#203241] p-0.5 space-x-0.5">
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              className={`px-2 py-1 text-[10px] font-mono ${speedMultiplier === s ? 'bg-[#19364a] text-[#8ed5ff]' : 'text-[#8397a8] hover:bg-[#132536]'}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            className="px-3 py-1.5 bg-[#11293a] hover:bg-[#17384e] text-[#dcecf4] text-[10px] font-medium border border-[#24465a] transition-colors flex items-center gap-2"
            onClick={togglePlay}
          >
            {simulationStatus === 'RUNNING' ? <><Pause size={12} /> PAUSE</> : <><Play size={12} /> PLAY</>}
          </button>
          <button 
            className="px-2.5 py-1.5 bg-transparent hover:bg-[#132536] text-[#8397a8] text-[10px] font-medium border border-[#203241] transition-colors flex items-center gap-1.5"
            onClick={resetSim}
          >
            <RotateCcw size={11} /> RESET
          </button>
        </div>
      </div>
    </header>
  );
};
