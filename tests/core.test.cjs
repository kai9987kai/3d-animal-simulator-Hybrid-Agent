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
