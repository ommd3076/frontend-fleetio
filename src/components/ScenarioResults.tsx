import {useStore} from '../store';
import {SCENARIOS} from '../simulation/layout';

export function ScenarioResults(){
 const results=useStore(state=>state.scenarioResults);
 return <section className="dashboard-card" style={{padding:20,marginBottom:18}} aria-label="Measured scenario results">
  <h3>Scenario results</h3>
  {!results.length?<p className="subtle">Results appear when a scenario finishes or times out.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',fontSize:12,borderSpacing:'0 12px'}}><thead><tr><th>Scenario</th><th>Outcome</th><th>Time</th><th>Delivered</th><th>Recoveries</th><th>Overlaps</th></tr></thead><tbody>{results.map((result,index)=><tr key={`${result.id}-${index}`}><td>{SCENARIOS.find(s=>s.id===result.id)?.label??result.id}</td><td className={result.passed?'green-text':'red-text'}>{result.passed?'Passed':result.timedOut?'Timed out':'Failed'}</td><td>{result.simTime.toFixed(1)} s</td><td>{result.tasksCompleted}</td><td>{result.deadlocksResolved}</td><td>{result.overlapViolations}</td></tr>)}</tbody></table></div>}
 </section>;
}
