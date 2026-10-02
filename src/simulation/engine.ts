import { useStore } from '../store';
import type { SimulationCommand, SimulationSnapshot } from '../types';
let worker:Worker|null=null;
let minimumGeneration=-1;
export function initEngine(){
 if(worker)return;
 minimumGeneration=-1;
 useStore.setState({generation:-1,sequence:-1});
 worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
 worker.onmessage=(event:MessageEvent<{type:string;payload:SimulationSnapshot}>)=>{
  if(event.data.type!=='STATE_UPDATE')return;
  const snapshot=event.data.payload, state=useStore.getState();
  if(snapshot.generation<minimumGeneration||snapshot.generation<state.generation)return;
  if(snapshot.generation===state.generation&&snapshot.sequence<=state.sequence)return;
  useStore.setState({...snapshot,runtimeError:null});
 };
 worker.onerror=(event)=>{worker?.terminate();worker=null;minimumGeneration=-1;useStore.setState({runtimeError:event.message||'The simulation could not start.',simulationStatus:'STOPPED'});};
}
export function postSimulationCommand(command:SimulationCommand){
 if(!worker)initEngine();
 // Each queued reset increments the core generation, including commands sent
 // before its initial snapshot arrives. Fence the entire queue immediately.
 if(command.type==='RESET'||command.type==='START_SCENARIO')minimumGeneration=Math.max(minimumGeneration,useStore.getState().generation,1)+1;
 worker?.postMessage(command);
}
export function resetSimulation(){postSimulationCommand({type:'RESET'});}
export function disposeEngine(){worker?.terminate();worker=null;minimumGeneration=-1;}
