/// <reference lib="webworker" />
import {createSimulation} from './core';
import {WAREHOUSE_LAYOUT} from './layout';
import type {SimulationCommand} from '../types';
const simulation=createSimulation(WAREHOUSE_LAYOUT,12345);
const FIXED_DT=1/60;
let previous=performance.now(),accumulator=0,snapshotAccumulator=0;
let playback=simulation.snapshot();
function publish(){playback=simulation.snapshot();self.postMessage({type:'STATE_UPDATE',payload:playback});}
// Exactly one ticker for the lifetime of the worker. Playback changes state,
// never allocates another ticker or listener.
setInterval(()=>{
 const now=performance.now(),elapsed=Math.min(.15,(now-previous)/1000);previous=now;
 if(playback.simulationStatus==='RUNNING'){
  accumulator+=elapsed*playback.speedMultiplier;
  while(accumulator>=FIXED_DT){simulation.step(FIXED_DT);accumulator-=FIXED_DT;}
 }else accumulator=0;
 snapshotAccumulator+=elapsed;if(snapshotAccumulator>=.05){snapshotAccumulator%=.05;publish();}
},1000/60);
self.onmessage=(event:MessageEvent<SimulationCommand>)=>{simulation.dispatch(event.data);publish();};
publish();
