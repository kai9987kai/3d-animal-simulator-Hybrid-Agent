'use strict';
let experimentCancelled=false, lastExperiment=null;
const actionLabels={corridor:'Restore corridor',refuge:'Seed refuge',geneFlow:'Assisted gene flow',socialOff:'Disable social imitation'};

function ednaSweep(){
  if(!settings.ednaSensors){notify('Sentinels are disabled');return}
  const observed=new Set(), truth=new Set(), coverages=[], rows=[];
  let falsePositives=0;
  for(let sensorIndex=0;sensorIndex<sensors.length;sensorIndex++){
    const se=sensors[sensorIndex],counts=new Map();
    for(const a of agents)if(!a.dead&&dist2(a.pos.x,a.pos.z,se.x,se.z)<=se.radius**2)counts.set(a.eco,(counts.get(a.eco)||0)+1);
    const plantCount=vegetation.data.filter(p=>p.active&&dist2(p.x,p.z,se.x,se.z)<=se.radius**2).length;
    if(plantCount)counts.set('plant',plantCount);
    for(const t of counts.keys())truth.add(t);
    for(let replicate=0;replicate<3;replicate++){
      let detected=0;
      for(const [type,abundance] of counts){
        const detect=clamp((1-Math.exp(-abundance*.65))*(1-settings.sensorNoise),0,1);
        if(sensorRng.next()<detect){observed.add(type);detected++}
      }
      const ghost=sensorRng.next()<settings.sensorNoise*.25;
      if(ghost){observed.add('unmatched-signal');falsePositives++}
      if(counts.size)coverages.push(detected/counts.size);
      rows.push({sensor:sensorIndex+1,replicate:replicate+1,trueRichness:counts.size,detected,falsePositive:ghost});
    }
    se.last=time;
  }
  const coverage=EvoLab.summarize(coverages);
  stats.edna={sampled:true,observed:observed.size,true:truth.size,confidence:coverage.mean,bias:observed.size-truth.size,
    falsePositives,replicates:3,coverageRange:[coverage.min,coverage.max],rows,
    last:`Day ${(time/dayDuration).toFixed(2)} · ${sensors.length} stations × 3 samples · local union of signatures`};
  logEvent(`Sentinel sweep: ${observed.size} observed / ${truth.size} true local signatures`);
  updateSentinelPanel();updateUI(1/60);notify('Replicated local sentinel survey complete');
}
function updateSentinelPanel(){
  const by=id=>document.getElementById(id),e=stats.edna;
  by('sentRichness').textContent=e.sampled?e.observed:'--';by('sentTrue').textContent=e.sampled?e.true:'--';
  by('sentConf').textContent=e.sampled?(e.true?Math.round(e.confidence*100)+'%':'n/a (empty)'):'--';
  by('sentBias').textContent=e.sampled?(e.bias>0?'+':'')+e.bias:'--';
  by('sentinelList').textContent=e.sampled?`${e.last}\nSample detection coverage: ${Math.round(e.coverageRange[0]*100)}–${Math.round(e.coverageRange[1]*100)}%. Unmatched samples: ${e.falsePositives}.\nCoverage uses hidden local truth for teaching; it is not a statistical confidence interval or a field estimate.`:'Run a survey to compare replicated observations with local model truth.';
}
function experimentEndpoint(){return {prey:agents.filter(a=>a.type==='prey').length,predators:agents.filter(a=>a.type==='pred').length,plants:vegetation.active,diversity:diversityIndex(agents),meanEnergy:mean(agents,a=>a.energy)}}
function applyExperimentAction(action){
  if(action==='corridor')restoreCorridor();else if(action==='refuge')addRefuge();else if(action==='geneFlow')assistedGeneFlow();else if(action==='socialOff')settings.socialLearning=false;
}
function lockExperimentUI(lock){
  for(const el of document.querySelectorAll('button,input,select')){
    if(el.id==='btnCancelExperiment')continue;
    if(lock){el.dataset.previousDisabled=String(el.disabled);el.disabled=true}else{el.disabled=el.dataset.previousDisabled==='true';delete el.dataset.previousDisabled}
  }
  document.getElementById('btnCancelExperiment').disabled=!lock;
}
async function runMicroForecast(){
  if(experimentRunning)return;
  const by=id=>document.getElementById(id),seconds=Number(by('forecastHorizon').value),replicates=Number(by('experimentReplicates').value),action=by('experimentAction').value;
  if(!Number.isInteger(seconds)||seconds<10||seconds>120||!Number.isInteger(replicates)||replicates<2||replicates>6||!actionLabels[action]){notify('Choose 10–120 seconds and 2–6 replicates');return}
  const original=snapshot(),wasPaused=paused,originTick=simulationTick,originalSeed=runSeed;
  const initial=experimentEndpoint(),rows=[],steps=Math.round(seconds/FIXED_DT),total=steps*2*replicates;
  experimentRunning=true;experimentCancelled=false;lockExperimentUI(true);by('forecastPanel').style.display='block';
  by('experimentProgress').max=total;by('experimentProgress').value=0;
  let done=0,completed=false;
  try{
    for(let replicate=0;replicate<replicates;replicate++){
      const seed=`${originalSeed}:tick:${originTick}:replicate:${replicate}`;
      const row={replicate:replicate+1,seed};
      for(const arm of ['baseline','intervention']){
        restoreSnapshot(original);
        simRng.setState(EvoLab.createRng(seed).getState());
        if(arm==='intervention')applyExperimentAction(action);
        // Reuse the future process stream after the explicit intervention draws.
        simRng.setState(EvoLab.createRng(seed+':future').getState());
        for(let i=0;i<steps;i++){
          if(experimentCancelled)throw new Error('cancelled');
          simulationStep();done++;
          if(i%90===0){
            by('experimentProgress').value=done;
            by('experimentStatus').textContent=`Replicate ${replicate+1}/${replicates} · ${arm} · ${Math.round(done/total*100)}%`;
            await new Promise(resolve=>setTimeout(resolve,0));
          }
        }
        row[arm]=experimentEndpoint();
      }
      row.delta=Object.fromEntries(Object.keys(initial).map(k=>[k,row.intervention[k]-row.baseline[k]]));rows.push(row);
    }
    completed=true;
  }catch(error){if(error.message!=='cancelled')console.error(error);by('experimentStatus').textContent=error.message==='cancelled'?'Cancelled. Live world restored.':'Experiment failed: '+error.message}
  finally{
    restoreSnapshot(original);experimentRunning=false;setPaused(wasPaused);accumulator=original.accumulator;clock.getDelta();lockExperimentUI(false);refreshHabitat();updateUI(1/60);renderFrame(0);
  }
  if(completed){
    lastExperiment={format:'evosim-paired-experiment',version:VERSION,runSeed:originalSeed,originTick,seconds,replicates,action,initial,configuration:original.settings,startingSnapshot:original,rows,
      summary:Object.fromEntries(Object.keys(initial).map(k=>[k,EvoLab.summarize(rows.map(r=>r.delta[k]))])),
      limits:'Same starting ecology, varied process seeds. Intervention minus baseline. Small replicate set; no calibrated ecological prediction. Paired streams can diverge after different decisions.'};
    by('experimentProgress').value=total;by('experimentStatus').textContent=`Completed ${replicates} matched pairs. Live world restored.`;updateForecastPanel();notify('Paired experiment complete');
  }
}
function updateForecastPanel(){
  const by=id=>document.getElementById(id),e=lastExperiment;
  by('forecastHorizonLabel').textContent=(e?.seconds||settings.forecastHorizon)+' simulated seconds';
  by('forecastRisk').textContent=e?`${e.summary.prey.mean>=0?'+':''}${e.summary.prey.mean.toFixed(1)} prey`:'--';
  by('forecastAction').textContent=e?actionLabels[e.action]:'Choose an intervention';
  by('forecastList').textContent=e?`Seed ${e.runSeed}, tick ${e.originTick}. ${e.replicates} pairs from the same starting world.\n`+Object.entries(e.summary).map(([key,s])=>`${key}: mean Δ ${s.mean.toFixed(2)}, SD ${s.sd.toFixed(2)}, range ${s.min.toFixed(2)} to ${s.max.toFixed(2)}`).join('\n')+'\n'+e.limits:'Runs the actual agent model twice per process seed. Endpoints and paired differences are measured; they are not risk probabilities.';
}
function exportExperiment(){
  if(!lastExperiment){notify('Run an experiment first');return}
  const e=lastExperiment,keys=Object.keys(e.initial),header=['version','seed','origin_tick','action','seconds','replicate','process_seed','configuration_json',...keys.flatMap(k=>[k+'_baseline',k+'_intervention',k+'_delta'])];
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
  const rows=e.rows.map(r=>[e.version,e.runSeed,e.originTick,e.action,e.seconds,r.replicate,r.seed,JSON.stringify(e.configuration),...keys.flatMap(k=>[r.baseline[k],r.intervention[k],r.delta[k]])]);
  downloadBlob([header,...rows].map(row=>row.map(quote).join(',')).join('\n'),'evosim6-paired-experiment.csv','text/csv');
}
