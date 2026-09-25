import React, { useEffect } from 'react';
import { useStore } from '../store';
import { Header } from './Header';
import { FleetSummary } from './FleetSummary';
import { RobotInspector } from './RobotInspector';
import { EventFeed } from './EventFeed';
import { WarehouseCanvas } from './WarehouseCanvas';
import { AnalyticsView, FleetView, OverviewView, TasksView } from './OperationsViews';
import { initEngine } from '../simulation/engine';

export const Layout: React.FC = () => {
  const { activeView } = useStore();
  useEffect(() => { initEngine(); }, []);
  
  return (
    <div className="h-screen w-screen bg-[#050c13] flex flex-col overflow-hidden font-sans text-[#E8EEF6]">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {activeView === 'Map' && (
          <>
            {/* Left Rail */}
            <div className="w-[clamp(210px,13vw,270px)] shrink-0 border-r border-[#192a37] flex flex-col">
              <FleetSummary />
            </div>
            
            {/* Center Map Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0a1520] relative">
              <div className="flex-1 min-h-0 w-full p-[clamp(4px,0.3vw,10px)] pb-0">
                <WarehouseCanvas />
              </div>
              <div className="h-[clamp(138px,16vh,184px)] shrink-0 border-t border-[#192a37] bg-[#050c13]">
                <EventFeed />
              </div>
            </div>
            
            {/* Right Rail */}
            <div className="w-[clamp(250px,15vw,310px)] shrink-0 border-l border-[#192a37] flex flex-col">
              <RobotInspector />
            </div>
          </>
        )}
        {activeView === 'Overview' && <div className="flex-1 min-w-0"><OverviewView /></div>}
        {activeView === 'Fleet' && <div className="flex-1 min-w-0"><FleetView /></div>}
        {activeView === 'Tasks' && <div className="flex-1 min-w-0"><TasksView /></div>}
        {activeView === 'Analytics' && <div className="flex-1 min-w-0"><AnalyticsView /></div>}
      </div>
    </div>
  );
};
