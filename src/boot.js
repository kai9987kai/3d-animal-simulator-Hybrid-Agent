'use strict';
const freshStats=JSON.parse(JSON.stringify(stats));
function setPaused(value){paused=!!value;const button=document.getElementById('btnPause');button.textContent=paused?'Resume':'Pause';button.classList.toggle('active',paused);button.setAttribute('aria-pressed',String(paused));updateRunStatus()}
function updateRunStatus(){document.getElementById('runStatus').textContent=`${paused?'Paused':'Running'} · tick ${simulationTick.toLocaleString()} · seed ${runSeed}`}
function restartRun(seed){
  if(experimentRunning)return;
  seed=String(seed).trim().slice(0,120)||'evosim-2026';
  unfollow();for(const a of agents)a.dispose();agents=[];
  runSeed=seed;terrainSeed=seed+':terrain';simRng=EvoLab.createRng(seed+':ecology');sensorRng=EvoLab.createRng(seed+':sensors');visualRng=EvoLab.createRng(seed+':visuals');
  simulationTick=0;time=0;accumulator=0;plantCursor=0;nextAgentId=1;extremeEventClock=0;growthAccumulator=0;census=EvoObservatory.createCensus();censusEvents=[];phenologyCache={prey:1,pred:1};
  refugia=[];restoredCorridors=[];soilPulses=[];fearPulses=[];initSensors();
  pathogen={id:1,virulence:.55,transmission:.5,immuneEscape:.35};stats=JSON.parse(JSON.stringify(freshStats));
  weatherSystem.kind='Clear';weatherSystem.timer=0;pheromones.items=[];
  initWorld({repopulate:true});
  for(let i=0;i<52;i++)spawnAgent('prey',rnd(-35,35),rnd(-35,35));
  for(let i=0;i<8;i++)spawnAgent('pred',rnd(-35,35),rnd(-35,35));
  sampleHistory();syncUI();setPaused(true);updateUI(1/60);renderFrame(0);notify('Seeded world restarted');
}
function setupLabUI(){
  setupObservatoryUI();
  const by=id=>document.getElementById(id);
  by('btnRestart').onclick=()=>restartRun(by('runSeed').value);
  by('btnStep').onclick=()=>{if(experimentRunning)return;setPaused(true);simulationStep();updateUI(1/60);renderFrame(0)};
  by('btnImport').onclick=()=>by('snapshotFile').click();
  by('snapshotFile').onchange=async e=>{const file=e.target.files[0];if(file)await importStateFile(file);e.target.value=''};
  by('btnCancelExperiment').onclick=()=>experimentCancelled=true;
  by('btnExportExperiment').onclick=exportExperiment;
  by('btnExportExperimentJSON').onclick=()=>{
    if(!lastExperiment){notify('Run an experiment first');return}
    downloadBlob(JSON.stringify(lastExperiment,null,2),'evosim6-experiment-bundle.json','application/json');
  };
  for(const panel of document.querySelectorAll('.analysisDock .panel')){if(panel.id==='selectionPanel')continue;const close=document.createElement('button');close.type='button';close.textContent='×';close.className='closePanel';close.setAttribute('aria-label','Close '+panel.querySelector('h2').textContent);close.onclick=()=>panel.style.display='none';panel.querySelector('h2').append(close)}
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea,button')||experimentRunning)return;
    if(e.code==='Space'){e.preventDefault();setPaused(!paused)}
    if(e.code==='KeyN')by('btnStep').click();
    if(e.code==='KeyF'){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>notify('Fullscreen unavailable'))}
  });
  document.addEventListener('visibilitychange',()=>{accumulator=0;clock.getDelta()});
}
window.advanceTime=ms=>{
  if(experimentRunning)return;
  if(!Number.isFinite(ms)||ms<0||ms>120000)throw new Error('Advance time must be 0–120000 milliseconds');
  setPaused(true);advanceSimulation(ms/1000);updateUI(1/60);renderFrame(0);
};
window.render_game_to_text=()=>JSON.stringify({version:VERSION,seed:runSeed,tick:simulationTick,time,paused,experimentRunning,
  coordinates:'World x east / z south, origin at center; y elevation. World bounds -75..75.',
  prey:agents.filter(a=>a.type==='prey').length,predators:agents.filter(a=>a.type==='pred').length,plants:vegetation?.active,
  weather:weatherSystem?.kind,refuges:refugia.length,corridors:restoredCorridors.length,historySamples:stats.history.length,
  selected:selectedId,census,sensor:stats.edna,agents:agents.slice(0,12).map(a=>({id:a.id,type:a.type,state:a.state,x:+a.pos.x.toFixed(2),z:+a.pos.z.toFixed(2),energy:+a.energy.toFixed(1)}))});
try { init(); } catch(error) {
  console.error(error);
  document.getElementById('runStatus').textContent='Unable to start: '+error.message;
  document.getElementById('msg').textContent='The 3D renderer could not start. Enable WebGL/hardware acceleration and reload. '+error.message;
}
