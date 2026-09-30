'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {validateSnapshot}=require('../src/persistence.js');

function checkpoint(count=2){
  const settings={speed:1,chaos:1,climateStress:.35,climateTrend:.1,mutation:.05,diseasePressure:.2,
    fragmentation:.2,learningRate:.25,phenologyDrift:.2,sensorNoise:.18,forecastHorizon:30,cameraMode:'orbit'};
  for(const flag of ['particles','pheromones','heatmap','riskMap','lineage','adaptiveLearning',
    'carryingCapacity','defendedPrey','autoEvents','fearLandscape','nicheConstruction','socialLearning',
    'ednaSensors','shadows','quality','energyAware','localRegrowth'])settings[flag]=true;
  const agents=Array.from({length:count},(_,i)=>({
    id:i+1,type:i%2?'pred':'prey',generation:i?1:0,maxSpeed:3.4,maxForce:6.3,perception:16,size:1,
    energy:91,health:100,age:.4,state:'FORAGE',targetIdx:0,memory:[{x:3,z:4,y:1,ttl:22}],
    sick:false,immuneMemory:.2,dead:false,eco:i%2?'PA':'HA',lastBirth:1,lastEnergy:90,lastHealth:100,reward:2,actionIdx:1,
    founderId:1,attackCooldown:.5,handlingTimer:1.2,pendingMeal:27,lastMealTime:1.5,deathCause:null,
    genes:{size:1,speed:1,sense:1,immunity:1,thermal:1,efficiency:1,plasticity:1,defense:.2,boldness:.4,memory:1,policy:[1,1.2,1,1]},
    pos:{x:i*.01,y:1,z:2},vel:{x:1,y:0,z:.2},acc:{x:0,y:0,z:0},
    parent:i?{id:1,generation:0}:null,target:i?{agentId:1}:{position:{x:3,y:1,z:4}}
  }));
  return {format:'evosim-snapshot',schemaVersion:7,version:'6.1',runSeed:'test',terrainSeed:'test:terrain',
    fixedDt:1/60,simulationTick:120,time:2,dayDuration:120,nextAgentId:count+1,plantCursor:0,extremeEventClock:2,
    accumulator:.003,growthAccumulator:.625,paused:true,rng:{simulation:123,sensor:456,visual:789},settings,
    census:{births:{prey:1,pred:2},introductions:{prey:Math.ceil(count/2),pred:Math.floor(count/2)},
      deaths:{prey:1,pred:2},causes:{predation:1,starvation:1,disease:1,age:0,injury:0},kills:1,failedHunts:3,grazes:12,regrown:8},
    censusEvents:count?[{tick:60,kind:'introduction',type:'prey',id:1,founderId:1}]:[],
    pathogen:{id:1,virulence:.55,transmission:.5,immuneEscape:.35},refugia:[{x:0,z:0,radius:10,quality:.8,y:1}],
    restoredCorridors:[{x1:-10,z1:0,x2:10,z2:0,width:5,quality:.9}],
    soilPulses:[{x:0,z:0,strength:.4,radius:7,life:.7}],fearPulses:[{x:1,z:1,strength:.8,radius:12,life:.9}],
    sensors:[{x:0,z:0,radius:27,last:1}],weather:{kind:'Storm',timer:8},
    stats:{history:[{day:1/120,prey:1,pred:1,food:.05,div:10,risk:3,climate:.35,pathogenId:1}],
      events:['D0 test'],speciesCount:2,diversity:.3,weather:'Storm',season:'Spring',sick:0,ews:'Stable',ac1:.2,
      variance:.1,climateAnomaly:0,phenologyMismatch:.1,edna:{observed:0,true:1,confidence:0,bias:-1,last:'D0 sweep'},
      forecast:{risk:0,action:'Run forecast',notes:'No forecast yet'}},
    plants:[{x:3,y:1,z:4,scale:1,rotation:.2,active:true,energy:24,fertility:.7,nutrient:1,age:0},
      {x:6,y:1,z:8,scale:.8,rotation:1,active:false,energy:22,fertility:.6,nutrient:1.2,age:0}],
    selectedId:count?1:null,agents};
}

function legacyCheckpoint(count=2){
  const s=checkpoint(count);s.schemaVersion=6;s.version='6.0';
  for(const key of ['growthAccumulator','census','censusEvents'])delete s[key];
  delete s.settings.energyAware;delete s.settings.localRegrowth;
  for(const a of s.agents)for(const key of ['founderId','attackCooldown','handlingTimer','pendingMeal','lastMealTime','deathCause'])delete a[key];
  return s;
}

test('complete checkpoint validation preserves 300 agents and returns a detached copy',()=>{
  const input=checkpoint(300),out=validateSnapshot(input);
  assert.equal(out.agents.length,300);
  assert.deepEqual(out,input);
  out.agents[0].genes.policy[0]=8;out.plants[0].active=false;out.stats.events.push('changed');
  assert.equal(input.agents[0].genes.policy[0],1);assert.equal(input.plants[0].active,true);assert.equal(input.stats.events.length,1);
});

test('legacy abbreviated saves fail explicitly',()=>{
  assert.throws(()=>validateSnapshot({version:'5.0',agents:[]}),/earlier population-only saves/);
});

test('invalid numeric, reference, shape, bounds, and prototype data are rejected',()=>{
  const cases=[
    s=>{s.agents[0].energy=NaN;},s=>{s.agents[0].pos.x=Infinity;},
    s=>{s.agents[1].id=1;},s=>{s.agents[1].target.agentId=900;},
    s=>{s.nextAgentId=1;},s=>{s.agents[0].parent={id:1,generation:0};},
    s=>{s.settings.speed=99;},s=>{s.settings.unknown=true;},
    s=>{s.rng.simulation=-1;},s=>{s.agents[0].genes.policy=[];},
    s=>{delete s.plants[0].scale;},s=>{s.agents[0].target={agentId:1,position:{x:0,y:0,z:0}};},
    s=>{s.simulationTick=121;},s=>{s.weather.kind='Clear';},
    s=>{s.stats.constructor={};},s=>{s.selectedId=700;},s=>{s.agents[0].memory[0].ttl=-1;},
    s=>{delete s.agents[0].pendingMeal;},s=>{s.agents[0].attackCooldown=-.1;},
    s=>{s.agents[0].lastMealTime=3;},s=>{s.agents[1].founderId=2;},
    s=>{delete s.settings.energyAware;},s=>{s.growthAccumulator=1;},
    s=>{s.census.grazes=.5;},s=>{s.census.deaths.pred=-1;},
    s=>{s.census.causes.disease=0;},s=>{delete s.census.causes.age;},
    s=>{s.censusEvents[0].tick=121;},s=>{s.censusEvents[0].id=3;},
    s=>{s.censusEvents[0].kind='unknown';},s=>{s.agents[0].deathCause='unknown';},
    s=>{s.census.introductions.prey++;},s=>{s.census.births.pred++;},
    s=>{delete s.censusEvents[0].type;},s=>{delete s.censusEvents[0].id;},
    s=>{delete s.censusEvents[0].founderId;},s=>{s.censusEvents[0].kind='kill';},
    s=>{s.censusEvents[0].kind='birth';},s=>{s.censusEvents[0].kind='death';},
    s=>{s.censusEvents=Array.from({length:81},()=>s.censusEvents[0]);}
  ];
  for(const mutate of cases){const s=checkpoint();mutate(s);assert.throws(()=>validateSnapshot(s),/Invalid snapshot:/);}
  assert.throws(()=>validateSnapshot(checkpoint(1201)),/at most 1200/);
});

function runtime(){
  class Vector3{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}
    copy(v){return this.set(v.x,v.y,v.z);}clone(){return new Vector3(this.x,this.y,this.z);}add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
    lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}}
  const rng=()=>({state:0,getState(){return this.state;},setState(s){this.state=s;}});
  const saved=new Map();
  const context={experimentRunning:false,VERSION:'6.1',FIXED_DT:1/60,agents:[],followTarget:null,selectedId:null,runSeed:'',terrainSeed:'',
    settings:{},simulationTick:0,time:0,dayDuration:120,refugia:[],restoredCorridors:[],soilPulses:[],fearPulses:[],sensors:[],pathogen:{},
    stats:{},plantCursor:0,extremeEventClock:0,nextAgentId:1,accumulator:0,growthAccumulator:0,census:{},censusEvents:[],paused:false,uiTick:0,
    simRng:rng(),sensorRng:rng(),visualRng:rng(),weatherSystem:{},pheromones:{items:[{}],update(){}},
    renderer:{shadowMap:{},setPixelRatio(){}},devicePixelRatio:1,grid:{clear(){},insert(){}},
    THREE:{Vector3},document:{getElementById(){return null;}},syncUI(){},updateODDNotes(){},agentColor(){return 0;},
    disposed:0,plantIndexRebuilt:0,drawn:[],notices:[],saved,
    notify(message){context.notices.push(message);},localStorage:{getItem(key){return saved.get(key)||null;},setItem(key,value){saved.set(key,value);}},
    initWorld(){context.stats={events:['renderer changed log']};context.census={changed:true};context.censusEvents=[];context.growthAccumulator=.9;context.simRng.state=900;},
    initVegetation(){context.vegetation={data:[],active:0,mesh:{count:0,instanceMatrix:{}}};},
    drawPlant(i){context.drawn.push(i);},rebuildPlantIndex(){context.plantIndexRebuilt++;},
  };
  context.Agent=class {
    constructor(){context.simRng.state++;context.nextAgentId++;this.pos=new Vector3();this.vel=new Vector3();this.acc=new Vector3();
      this.mesh={position:new Vector3(),lookAt(){},material:{color:{set(){}}}};}
    removeLabel(){}addLabel(){}dispose(){context.disposed++;}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/persistence.js'),'utf8'),context);
  return context;
}

test('restore recreates targets, feeding timers, renewal, census, lineage and RNG state exactly',()=>{
  const context=runtime(),input=checkpoint();
  context.restoreSnapshot(input);
  assert.equal(context.agents[1].target,context.agents[0].pos);
  assert.equal(context.agents[1].parent,context.agents[0]);
  assert.equal(context.agents[1].founderId,1);assert.equal(context.agents[1].handlingTimer,1.2);
  assert.equal(context.agents[1].pendingMeal,27);assert.equal(context.growthAccumulator,.625);
  assert.equal(context.census.grazes,12);assert.ok(Object.isFrozen(context.censusEvents[0]));
  assert.equal(context.vegetation.active,1);assert.equal(context.vegetation.mesh.count,2);
  assert.equal(context.plantIndexRebuilt,1);assert.deepEqual(context.drawn,[0,1]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.snapshot())),input);
  context.agents[0].memory[0].ttl=1;
  assert.equal(input.agents[0].memory[0].ttl,22);
});

test('restore retains metadata for a dead parent',()=>{
  const context=runtime(),input=checkpoint();
  input.agents[1].parent={id:3,generation:0};input.nextAgentId=4;
  context.restoreSnapshot(input);
  assert.deepEqual(JSON.parse(JSON.stringify(context.snapshot())),input);
});

test('census balance includes pending dead records until removal records their deaths',()=>{
  const input=checkpoint();input.agents[0].dead=true;input.agents[0].deathCause='predation';
  assert.deepEqual(validateSnapshot(input),input);
  const removed=checkpoint();removed.agents.pop();removed.census.deaths.pred++;removed.census.causes.starvation++;
  assert.deepEqual(validateSnapshot(removed),removed);
});

test('ledger birth and death records require complete identities and cause metadata',()=>{
  const input=checkpoint();
  input.censusEvents=[
    {tick:60,kind:'birth',type:'pred',id:2,parentId:1,founderId:1},
    {tick:60,kind:'death',type:'prey',id:1,founderId:1,cause:'predation'}
  ];
  assert.deepEqual(validateSnapshot(input),input);
  for(const [index,key] of [[0,'parentId'],[1,'cause'],[0,'type'],[1,'id'],[1,'founderId']]){
    const bad=JSON.parse(JSON.stringify(input));delete bad.censusEvents[index][key];
    assert.throws(()=>validateSnapshot(bad),/Invalid snapshot:/);
  }
});

test('complete 6.0 state migrates with explicit model-change provenance and initialized census',()=>{
  const input=legacyCheckpoint(4),before=JSON.stringify(input);
  input.agents[2].generation=2;input.agents[2].parent={id:2,generation:1};
  input.agents[3].parent={id:5,generation:0};input.nextAgentId=6;
  const source=JSON.stringify(input),out=validateSnapshot(input);
  assert.equal(out.version,'6.1');assert.equal(out.schemaVersion,7);
  assert.equal(out.growthAccumulator,0);assert.equal(out.settings.energyAware,true);assert.equal(out.settings.localRegrowth,true);
  assert.deepEqual(out.agents.map(a=>a.founderId),[1,1,1,5]);
  for(const a of out.agents){for(const key of ['attackCooldown','handlingTimer','pendingMeal','lastMealTime'])assert.equal(a[key],0);assert.equal(a.deathCause,null);}
  assert.deepEqual(out.census.introductions,{prey:2,pred:2});assert.deepEqual(out.census.births,{prey:0,pred:0});
  assert.deepEqual(out.censusEvents,[]);assert.equal(out.census.kills,0);
  assert.match(out.stats.events[0],/not an exact 6.0 continuation/);
  assert.equal(JSON.stringify(input),source);assert.notEqual(source,before);
  const context=runtime();context.restoreSnapshot(input);
  assert.deepEqual(JSON.parse(JSON.stringify(context.snapshot())),out);
});

test('legacy migration validates the original document and rejects malformed lineage before modification',()=>{
  const context=runtime();context.restoreSnapshot(checkpoint());const before=JSON.stringify(context.snapshot());
  const cases=[
    s=>{delete s.agents[0].genes;},s=>{s.agents[0].energy=NaN;},
    s=>{s.agents[0].generation=2;s.agents[0].parent={id:2,generation:1};s.agents[1].parent={id:1,generation:0};},
    s=>{s.settings.energyAware=true;},s=>{s.agents[0].handlingTimer=1;},
    s=>{s.agents[1].parent={id:99,generation:0};},
  ];
  for(const mutate of cases){const bad=legacyCheckpoint();mutate(bad);assert.throws(()=>context.restoreSnapshot(bad),/Invalid snapshot:/);}
  assert.equal(JSON.stringify(context.snapshot()),before);assert.equal(context.disposed,0);
});

test('loading the old storage key and importing an old file identify the changed model rules',async()=>{
  const context=runtime(),legacy=legacyCheckpoint();context.saved.set('evosim6-save',JSON.stringify(legacy));
  context.loadState();assert.equal(context.agents.length,2);assert.match(context.notices.at(-1),/not an exact 6.0 continuation/);
  context.saveState();assert.equal(JSON.parse(context.saved.get('evosim6.1-save')).schemaVersion,7);
  context.loadState();assert.equal(context.notices.at(-1),'Checkpoint restored');
  await context.importStateFile({size:1000,async text(){return JSON.stringify(legacy);}});
  assert.match(context.notices.at(-1),/6.0 state imported under 6.1 rules/);
});

test('invalid restore leaves the running world untouched',()=>{
  const context=runtime();context.restoreSnapshot(checkpoint());
  const before=JSON.stringify(context.snapshot()),bad=checkpoint();bad.agents[1].target.agentId=999;
  assert.throws(()=>context.restoreSnapshot(bad),/missing agent/);
  assert.equal(JSON.stringify(context.snapshot()),before);assert.equal(context.disposed,0);
});

test('malformed census and feeding state leave the running world untouched',()=>{
  const context=runtime();context.restoreSnapshot(checkpoint());const before=JSON.stringify(context.snapshot());
  for(const mutate of [s=>{s.census.kills=-1;},s=>{delete s.censusEvents;},s=>{s.agents[0].handlingTimer=Infinity;},s=>{s.census.deaths.prey++;}]){
    const bad=checkpoint();mutate(bad);assert.throws(()=>context.restoreSnapshot(bad),/Invalid snapshot:/);
    assert.equal(JSON.stringify(context.snapshot()),before);assert.equal(context.disposed,0);
  }
});
