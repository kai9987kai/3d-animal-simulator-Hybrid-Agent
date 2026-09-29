'use strict';

// Schema 6 is a continuation checkpoint, not an abbreviated population report.
// Render buffers and camera animation are deliberately excluded from model state.
const SNAPSHOT_FORMAT = 'evosim-snapshot';
const SNAPSHOT_SCHEMA = 6;
const SAVE_KEY = 'evosim6-save';
const MAX_SNAPSHOT_BYTES = 24 * 1024 * 1024;
const AGENT_FIELDS = ['id','type','generation','maxSpeed','maxForce','perception','size',
  'energy','health','age','state','targetIdx','memory','sick','immuneMemory','dead','eco',
  'lastBirth','lastEnergy','lastHealth','reward','actionIdx','genes'];

function detachedJSON(value) { return JSON.parse(JSON.stringify(value)); }
function vectorRecord(value) { return {x:value.x,y:value.y,z:value.z}; }

function snapshot() {
  const positions = new Map(agents.map(a => [a.pos, a.id]));
  return detachedJSON({
    format: SNAPSHOT_FORMAT, schemaVersion: SNAPSHOT_SCHEMA, version: VERSION,
    runSeed, terrainSeed, fixedDt: FIXED_DT, simulationTick, time, dayDuration,
    nextAgentId, plantCursor, extremeEventClock, accumulator, paused,
    rng: {simulation:simRng.getState(),sensor:sensorRng.getState(),visual:visualRng.getState()},
    settings, pathogen, refugia, restoredCorridors, soilPulses, fearPulses, sensors,
    weather: {kind:weatherSystem.kind,timer:weatherSystem.timer}, stats,
    plants: vegetation.data,
    selectedId: followTarget && agents.includes(followTarget) ? followTarget.id : null,
    agents: agents.map(a => {
      const data = Object.fromEntries(AGENT_FIELDS.map(key => [key,a[key]]));
      data.pos=vectorRecord(a.pos); data.vel=vectorRecord(a.vel); data.acc=vectorRecord(a.acc);
      data.parent=a.parent ? {id:a.parent.id,generation:a.parent.generation} : null;
      data.target=a.target ? (positions.has(a.target)
        ? {agentId:positions.get(a.target)} : {position:vectorRecord(a.target)}) : null;
      return data;
    })
  });
}

function validateSnapshot(input) {
  const fail = message => { throw new Error('Invalid snapshot: '+message); };
  let nodeCount=0;
  // Validate before cloning: JSON.stringify would silently replace non-finite values.
  function json(value,path='snapshot',depth=0) {
    if (++nodeCount>600000 || depth>18) fail('document is too complex');
    if(value===null || typeof value==='boolean')return;
    if(typeof value==='number'){if(!Number.isFinite(value))fail(path+' must be finite');return;}
    if(typeof value==='string'){if(value.length>24000)fail(path+' is too long');return;}
    if(typeof value!=='object')fail(path+' must contain JSON values only');
    if(Array.isArray(value)){if(value.length>100000)fail(path+' is too long');value.forEach((v,i)=>json(v,path+'['+i+']',depth+1));return;}
    if(Object.prototype.toString.call(value)!=='[object Object]')fail(path+' must be a plain object');
    for(const [key,val] of Object.entries(value)){
      if(['__proto__','prototype','constructor'].includes(key))fail('unsafe property '+key);
      json(val,path+'.'+key,depth+1);
    }
  }
  json(input);
  const s=detachedJSON(input);
  const object=(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(p+' must be an object');};
  const number=(v,p,min=-1e9,max=1e9)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(p+' is outside its valid range');};
  const integer=(v,p,min=0,max=Number.MAX_SAFE_INTEGER)=>{number(v,p,min,max);if(!Number.isInteger(v))fail(p+' must be an integer');};
  const string=(v,p,max=200)=>{if(typeof v!=='string'||v.length>max)fail(p+' must be text');};
  const boolean=(v,p)=>{if(typeof v!=='boolean')fail(p+' must be boolean');};
  const array=(v,p,max)=>{if(!Array.isArray(v)||v.length>max)fail(p+' must be an array with at most '+max+' items');};
  const keys=(v,allowed,p)=>{object(v,p);for(const k of Object.keys(v))if(!allowed.includes(k))fail(p+' contains an unsupported field '+k);};
  const vector=(v,p,limit=10000)=>{keys(v,['x','y','z'],p);for(const k of ['x','y','z'])number(v[k],p+'.'+k,-limit,limit);};
  object(s,'snapshot');
  if(s.format!==SNAPSHOT_FORMAT || s.schemaVersion!==SNAPSHOT_SCHEMA || s.version!=='6.0') {
    fail('requires a complete EvoSim 6.0 checkpoint; earlier population-only saves cannot be resumed exactly');
  }
  string(s.runSeed,'runSeed',128); string(s.terrainSeed,'terrainSeed',160);
  number(s.fixedDt,'fixedDt',1/60,1/60);
  integer(s.simulationTick,'simulationTick'); number(s.time,'time',0,1e12);
  if(Math.abs(s.time-s.simulationTick*s.fixedDt)>1e-7)fail('time does not match simulationTick');
  number(s.dayDuration,'dayDuration',1,100000);
  integer(s.nextAgentId,'nextAgentId',1);integer(s.plantCursor,'plantCursor',0,3800);
  number(s.extremeEventClock,'extremeEventClock',0,1e12);
  number(s.accumulator,'accumulator',0,100);boolean(s.paused,'paused');
  keys(s.rng,['simulation','sensor','visual'],'rng');
  for(const k of ['simulation','sensor','visual'])integer(s.rng[k],'rng.'+k,0,0xffffffff);
  const settingRanges={speed:[0,5],chaos:[.1,2.5],climateStress:[0,1],climateTrend:[-.25,.65],
    mutation:[0,.25],diseasePressure:[0,1],fragmentation:[0,1],learningRate:[0,1],
    phenologyDrift:[0,1],sensorNoise:[0,.65],forecastHorizon:[10,120]};
  const settingFlags=['particles','pheromones','heatmap','riskMap','lineage','adaptiveLearning',
    'carryingCapacity','defendedPrey','autoEvents','fearLandscape','nicheConstruction','socialLearning',
    'ednaSensors','shadows','quality'];
  keys(s.settings,[...Object.keys(settingRanges),...settingFlags,'cameraMode'],'settings');
  for(const [k,[min,max]] of Object.entries(settingRanges))number(s.settings[k],'settings.'+k,min,max);
  integer(s.settings.forecastHorizon,'settings.forecastHorizon',10,120);
  for(const k of settingFlags)boolean(s.settings[k],'settings.'+k);
  if(!['orbit','follow','cinematic'].includes(s.settings.cameraMode))fail('unsupported camera mode');
  keys(s.pathogen,['id','virulence','transmission','immuneEscape'],'pathogen');
  integer(s.pathogen.id,'pathogen.id',1);
  for(const k of ['virulence','transmission','immuneEscape'])number(s.pathogen[k],'pathogen.'+k,0,10);
  const records=(values,name,max,ranges,optional=[])=>{
    array(values,name,max);values.forEach((v,i)=>{const p=name+'['+i+']';keys(v,[...Object.keys(ranges),...optional],p);
      for(const [k,[min,upper]] of Object.entries(ranges))number(v[k],p+'.'+k,min,upper);
      for(const k of optional)if(k in v)number(v[k],p+'.'+k);
    });
  };
  const coordinate=[-10000,10000];
  records(s.refugia,'refugia',2000,{x:coordinate,z:coordinate,radius:[.01,1000],quality:[0,10]},['y']);
  records(s.restoredCorridors,'restoredCorridors',2000,{x1:coordinate,z1:coordinate,x2:coordinate,z2:coordinate,width:[.01,1000],quality:[0,10]});
  for(const k of ['soilPulses','fearPulses'])records(s[k],k,2000,{x:coordinate,z:coordinate,strength:[0,1000],radius:[.01,1000],life:[0,100]});
  records(s.sensors,'sensors',2000,{x:coordinate,z:coordinate,radius:[.01,1000],last:[0,1e12]});
  keys(s.weather,['kind','timer'],'weather');
  if(!['Clear','Storm','Drought','Heatwave'].includes(s.weather.kind))fail('unknown weather');
  number(s.weather.timer,'weather.timer',-1,100000);
  object(s.stats,'stats');array(s.stats.history,'stats.history',100000);array(s.stats.events,'stats.events',10000);
  s.stats.events.forEach((v,i)=>string(v,'stats.events['+i+']',2000));
  for(const k of ['speciesCount','diversity','sick','ac1','variance','climateAnomaly','phenologyMismatch'])number(s.stats[k],'stats.'+k);
  for(const k of ['weather','season','ews'])string(s.stats[k],'stats.'+k,40);
  if(s.stats.weather!==s.weather.kind)fail('weather state is inconsistent');
  object(s.stats.edna,'stats.edna');object(s.stats.forecast,'stats.forecast');
  for(const k of ['observed','true','confidence','bias'])number(s.stats.edna[k],'stats.edna.'+k);
  string(s.stats.edna.last,'stats.edna.last',2000);
  if('sampled' in s.stats.edna)boolean(s.stats.edna.sampled,'stats.edna.sampled');
  if(s.stats.edna.sampled){
    const e=s.stats.edna;
    number(e.confidence,'detection coverage',0,1);
    array(e.coverageRange,'coverageRange',2);if(e.coverageRange.length!==2)fail('coverageRange needs two endpoints');
    e.coverageRange.forEach(v=>number(v,'coverage endpoint',0,1));
    if(e.coverageRange[0]>e.coverageRange[1])fail('coverage endpoints are reversed');
    integer(e.falsePositives,'falsePositives',0,6000);integer(e.replicates,'survey replicates',1,10);
    array(e.rows,'survey rows',6000);
    for(const r of e.rows){object(r,'survey row');integer(r.sensor,'sensor id',1,2000);integer(r.replicate,'replicate',1,10);integer(r.trueRichness,'trueRichness',0,2000);integer(r.detected,'detected',0,r.trueRichness);boolean(r.falsePositive,'falsePositive');}
  }
  number(s.stats.forecast.risk,'stats.forecast.risk');
  string(s.stats.forecast.action,'stats.forecast.action',2000);string(s.stats.forecast.notes,'stats.forecast.notes',20000);
  s.stats.history.forEach((h,i)=>{object(h,'history entry');for(const k of ['day','prey','pred','food','div','risk','climate'])number(h[k],'history['+i+'].'+k);integer(h.pathogenId,'history pathogen id',1);});
  array(s.plants,'plants',3800);
  s.plants.forEach((p,i)=>{
    keys(p,['x','z','y','active','energy','fertility','nutrient','age','scale','rotation'],'plants['+i+']');
    for(const k of ['x','y','z'])number(p[k],'plant.'+k,-10000,10000);
    for(const k of ['energy','nutrient','age'])number(p[k],'plant.'+k,0,1e9);
    number(p.fertility,'plant.fertility',0,1);number(p.scale,'plant.scale',.001,100);number(p.rotation,'plant.rotation',-100,100);
    boolean(p.active,'plant.active');
  });
  array(s.agents,'agents',1200);
  const ids=new Set();
  s.agents.forEach((a,i)=>{
    const p='agents['+i+']';keys(a,[...AGENT_FIELDS,'pos','vel','acc','parent','target'],p);
    integer(a.id,p+'.id',1);if(ids.has(a.id))fail('duplicate agent id '+a.id);ids.add(a.id);
    if(!['prey','pred'].includes(a.type))fail(p+' has unknown species');
    integer(a.generation,p+'.generation');
    for(const k of ['maxSpeed','maxForce','perception','size'])number(a[k],p+'.'+k,.001,1000);
    for(const k of ['energy','health','lastEnergy','lastHealth','reward'])number(a[k],p+'.'+k,-100000,100000);
    number(a.age,p+'.age',0,1e9);number(a.immuneMemory,p+'.immuneMemory',0,100);
    number(a.lastBirth,p+'.lastBirth',0,1e12);integer(a.actionIdx,p+'.actionIdx',0,3);
    integer(a.targetIdx,p+'.targetIdx',-1,Math.max(-1,s.plants.length-1));
    boolean(a.sick,p+'.sick');boolean(a.dead,p+'.dead');string(a.eco,p+'.eco',30);
    if(!['IDLE','EXPLORE','FLEE','FORAGE','SHELTER','SLEEP','MATE','HUNT','PATROL'].includes(a.state))fail(p+' has unknown behavior');
    vector(a.pos,p+'.pos');vector(a.vel,p+'.vel');vector(a.acc,p+'.acc');
    const geneFields=['size','speed','sense','immunity','thermal','efficiency','plasticity','defense','boldness','memory'];
    keys(a.genes,[...geneFields,'policy'],p+'.genes');
    for(const k of geneFields)number(a.genes[k],p+'.genes.'+k,k==='defense'||k==='boldness'?0:.001,10);
    array(a.genes.policy,p+'.genes.policy',4);if(a.genes.policy.length!==4)fail('policy needs four weights');
    a.genes.policy.forEach(w=>number(w,'policy weight',0,10));
    records(a.memory,p+'.memory',1000,{x:coordinate,z:coordinate,y:coordinate,ttl:[0,100000]});
    if(a.parent!==null){keys(a.parent,['id','generation'],p+'.parent');integer(a.parent.id,p+'.parent.id',1);integer(a.parent.generation,p+'.parent.generation');if(a.parent.id===a.id || a.parent.generation>=a.generation)fail('invalid parent lineage');}
    if(a.target!==null){keys(a.target,['agentId','position'],p+'.target');if(('agentId' in a.target)===('position' in a.target))fail('target must specify one reference or position');if('agentId' in a.target)integer(a.target.agentId,p+'.target.agentId',1);else vector(a.target.position,p+'.target.position');}
  });
  if([...ids].some(id=>id>=s.nextAgentId))fail('nextAgentId must exceed all live ids');
  for(const a of s.agents){
    if(a.parent&&a.parent.id>=s.nextAgentId)fail('parent id is beyond nextAgentId');
    if(a.target&&'agentId' in a.target&&!ids.has(a.target.agentId))fail('target references a missing agent');
    const parent=a.parent&&s.agents.find(other=>other.id===a.parent.id);
    if(parent&&parent.generation!==a.parent.generation)fail('parent generation does not match');
  }
  if(s.selectedId!==null){integer(s.selectedId,'selectedId',1);if(!ids.has(s.selectedId))fail('selected agent does not exist');}
  return s;
}

function restoreSnapshot(input) {
  const s=validateSnapshot(input); // No live state is modified until this succeeds.
  for(const a of agents)a.dispose();
  agents=[];followTarget=null;selectedId=null;
  runSeed=s.runSeed;terrainSeed=s.terrainSeed;settings=s.settings;
  simulationTick=s.simulationTick;time=s.time;dayDuration=s.dayDuration;
  refugia=s.refugia;restoredCorridors=s.restoredCorridors;soilPulses=s.soilPulses;fearPulses=s.fearPulses;sensors=s.sensors;pathogen=s.pathogen;
  initWorld({regenerate:false,repopulate:false});
  initVegetation(false);
  vegetation.data=s.plants;vegetation.active=s.plants.filter(p=>p.active).length;
  vegetation.mesh.count=s.plants.length;
  s.plants.forEach((p,i)=>drawPlant(i));
  vegetation.mesh.instanceMatrix.needsUpdate=true;
  rebuildPlantIndex();
  const byId=new Map();
  for(const data of s.agents){
    const a=new Agent(data.type,data.pos.x,data.pos.z,detachedJSON(data.genes));
    for(const k of AGENT_FIELDS)a[k]=data[k];
    for(const k of ['pos','vel','acc'])a[k].set(data[k].x,data[k].y,data[k].z);
    a.mesh.position.copy(a.pos);a.mesh.position.y+=.42*a.size;
    if(a.vel.lengthSq()>.04)a.mesh.lookAt(a.pos.clone().add(a.vel));
    a.mesh.material.color.set(agentColor(a.type,a.genes,a.sick));
    a.removeLabel();if(settings.lineage&&!experimentRunning)a.addLabel();
    agents.push(a);byId.set(a.id,a);
  }
  for(let i=0;i<agents.length;i++){
    const a=agents[i],data=s.agents[i];
    a.parent=data.parent?(byId.get(data.parent.id)||data.parent):null;
    a.target=data.target?('agentId' in data.target?byId.get(data.target.agentId).pos:
      new THREE.Vector3(data.target.position.x,data.target.position.y,data.target.position.z)):null;
  }
  stats=s.stats;plantCursor=s.plantCursor;extremeEventClock=s.extremeEventClock;
  weatherSystem.kind=s.weather.kind;weatherSystem.timer=s.weather.timer;
  nextAgentId=s.nextAgentId;accumulator=s.accumulator;paused=s.paused;uiTick=0;
  followTarget=s.selectedId===null?null:byId.get(s.selectedId);selectedId=s.selectedId;
  if(pheromones){pheromones.items=[];pheromones.update(0);}
  grid.clear();for(const a of agents)grid.insert(a);
  renderer.shadowMap.enabled=settings.shadows;renderer.setPixelRatio(settings.quality?Math.min(devicePixelRatio,2):1);
  if(!experimentRunning){syncUI();updateODDNotes();}
  const panel=document.getElementById('selectionPanel');if(panel)panel.style.display=followTarget?'block':'none';
  const pauseButton=document.getElementById('btnPause');if(pauseButton){pauseButton.textContent=paused?'Resume':'Pause';pauseButton.classList.toggle('active',paused);}
  const seedInput=document.getElementById('runSeed');if(seedInput)seedInput.value=runSeed;
  // Constructors and visual rebuilding consume randomness; restore streams last.
  simRng.setState(s.rng.simulation);sensorRng.setState(s.rng.sensor);visualRng.setState(s.rng.visual);
  return s;
}

function saveState() {
  try {const s=snapshot();validateSnapshot(s);localStorage.setItem(SAVE_KEY,JSON.stringify(s));notify('Complete checkpoint saved');}
  catch(error){notify('Save failed: '+error.message);}
}
function loadState() {
  try {
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw){notify('No EvoSim 6 checkpoint found. Older saves do not contain complete continuation state.');return;}
    if(raw.length>MAX_SNAPSHOT_BYTES)throw new Error('checkpoint exceeds 24 MB');
    restoreSnapshot(JSON.parse(raw));notify('Checkpoint restored');
  } catch(error){notify('Load failed: '+error.message);}
}
async function importStateFile(file) {
  if(!file)return;
  try {if(file.size>MAX_SNAPSHOT_BYTES)throw new Error('checkpoint exceeds 24 MB');
    restoreSnapshot(JSON.parse(await file.text()));notify('Checkpoint imported');
  } catch(error){notify('Import failed: '+error.message);}
}
function exportJSON() {
  try {const s=snapshot();validateSnapshot(s);downloadBlob(JSON.stringify(s,null,2),'evosim6-checkpoint.json','application/json');notify('Complete checkpoint exported');}
  catch(error){notify('Export failed: '+error.message);}
}

if(typeof module!=='undefined'&&module.exports)module.exports={validateSnapshot,SNAPSHOT_FORMAT,SNAPSHOT_SCHEMA};
