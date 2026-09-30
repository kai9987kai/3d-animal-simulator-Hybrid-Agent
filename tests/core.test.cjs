const test=require('node:test');
const assert=require('node:assert/strict');
const {createRng,crossGenes,PointIndex,summarize}=require('../src/lab-core.js');
test('independent seeded RNG streams and exact continuation',()=>{
  const a=createRng('world'), b=createRng('world'), sensor=createRng('sensor');
  const first=Array.from({length:100},()=>a.next());
  for(let i=0;i<1000;i++)sensor.next();
  assert.deepEqual(first,Array.from({length:100},()=>b.next()));
  const state=a.getState(), expected=Array.from({length:20},()=>a.next());
  a.setState(state);assert.deepEqual(expected,Array.from({length:20},()=>a.next()));
  assert.throws(()=>a.setState(-1));
});
test('both parents contribute every scalar and policy trait when mutation is zero',()=>{
  const a={size:.8,speed:.9,sense:1,immunity:1.1,thermal:.9,efficiency:.8,plasticity:.6,defense:0,boldness:0,memory:1,policy:[.2,.5,1,2]};
  const b={size:1.2,speed:1.3,sense:1.4,immunity:1.5,thermal:1.3,efficiency:1.2,plasticity:1.4,defense:1,boldness:1,memory:1.4,policy:[1.8,1.5,1,1]};
  const child=crossGenes(a,b,0,()=>.25);
  for(const key of Object.keys(a).filter(k=>k!=='policy'))assert.equal(child[key],(a[key]+b[key])/2,key);
  assert.deepEqual(child.policy,[1,1,1,1.5]);
  assert.deepEqual(crossGenes(a,null,0,()=>.9),a);
});
test('spatial queries are exact, deduplicated after moves, stable after rebuilding',()=>{
  const grid=new PointIndex(8);grid.insert(2,-1,0);grid.insert(1,1,0);grid.insert(3,10,10);
  assert.deepEqual(grid.query(0,0,2),[1,2]);
  grid.insert(2,20,20);assert.deepEqual(grid.query(0,0,2),[1]);
  grid.insert(2,1,0);grid.insert(2,1,0);assert.deepEqual(grid.query(0,0,2),[1,2]);
  grid.clear();assert.deepEqual(grid.query(0,0,100),[]);
});
test('paired delta summaries expose dispersion, including constant and empty outcomes',()=>{
  const s=summarize([-2,0,2]);assert.equal(s.mean,0);assert.equal(s.sd,2);assert.equal(s.n,3);
  assert.equal(summarize([4,4]).sd,0);assert.equal(summarize([]).n,0);
});

test('handling transfers a finite meal consistently across time subdivisions',()=>{
  const {consumeMeal}=require('../src/lab-core.js');
  const whole=consumeMeal(30,60,3,3);
  let state={energy:30,pending:60,remaining:3};
  for(let i=0;i<180;i++)state=consumeMeal(state.energy,state.pending,state.remaining,1/60);
  assert.ok(Math.abs(state.energy-whole.energy)<1e-9);
  assert.ok(state.pending<1e-9);assert.ok(state.remaining<1e-9);
  assert.equal(consumeMeal(130,20,1,1).energy,135);
  assert.equal(consumeMeal(30,60,3,0).energy,30);
});

test('plant renewal budgets follow elapsed time and retain fractional attempts',()=>{
  const {renewalBudget}=require('../src/lab-core.js');
  let accumulator=0,attempts=0;
  for(let i=0;i<600;i++){const next=renewalBudget(accumulator,1/60,37.5);attempts+=next.attempts;accumulator=next.remainder}
  assert.equal(attempts,375);assert.ok(accumulator<1e-9);
  assert.deepEqual(renewalBudget(.5,0,100),{attempts:0,remainder:.5});
  assert.deepEqual(renewalBudget(.5,10,0),{attempts:0,remainder:.5});
});

test('indexed pulse sampling agrees with brute force and supports capped replacements',()=>{
  const {samplePulseField,invalidatePulseField,createRng}=require('../src/lab-core.js');
  const rng=createRng('field-test');
  const pulses=Array.from({length:360},()=>({x:rng.next()*150-75,z:rng.next()*150-75,radius:3+rng.next()*20,strength:rng.next()*.2}));
  const brute=(x,z)=>Math.min(2,pulses.reduce((sum,p)=>{const d=Math.hypot(x-p.x,z-p.z);return sum+(d<p.radius?p.strength*(1-d/p.radius):0)},0));
  for(let i=0;i<30;i++){const x=rng.next()*150-75,z=rng.next()*150-75;assert.equal(samplePulseField(pulses,x,z),brute(x,z))}
  pulses.shift();pulses.push({x:1,z:1,radius:8,strength:.5});invalidatePulseField(pulses);
  assert.equal(samplePulseField(pulses,1,1),brute(1,1));
  pulses.forEach(p=>p.strength*=.9);assert.equal(samplePulseField(pulses,1,1),brute(1,1));
});
