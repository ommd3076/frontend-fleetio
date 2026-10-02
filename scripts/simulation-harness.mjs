import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache=new Map();
export async function importTs(file){
 const absolute=path.resolve(file);if(cache.has(absolute))return import(cache.get(absolute));
 let output=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const matches=[...output.matchAll(/from\s+['"]([^'"]+)['"]/g)];
 for(const [,spec] of matches){if(!spec.startsWith('.'))continue;const dep=path.resolve(path.dirname(absolute),spec+'.ts');await importTs(dep);output=output.replaceAll("'"+spec+"'","'"+cache.get(dep)+"'").replaceAll('"'+spec+'"','"'+cache.get(dep)+'"');}
 const url='data:text/javascript;base64,'+Buffer.from(output).toString('base64');cache.set(absolute,url);return import(url);
}
export const {createSimulation}=await importTs('src/simulation/core.ts');
export const {WAREHOUSE_LAYOUT,SCENARIOS}=await importTs('src/simulation/layout.ts');
export function assert(condition,message){if(!condition)throw new Error(message);}
export function runScenario(id,seconds=300,step=1/60,hook){const sim=createSimulation(WAREHOUSE_LAYOUT,12345);sim.dispatch({type:'START_SCENARIO',scenarioId:id});let s=sim.snapshot();for(let i=0;i<seconds/step;i++){sim.step(step);if(i%60===0){s=sim.snapshot();hook?.(sim,s);if(s.scenarioProgress.completed)break;}}return sim.snapshot();}
