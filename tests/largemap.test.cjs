const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const THREE=require('../vendor/three.min.js');
const source=fs.readFileSync('experimental/largemap.html','utf8');
// Execute the actual legacy functions/classes without creating a WebGL window.
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))}
test('experimental stepping retains newborns without updating them in the birth tick',()=>{
  const context={entities:[],pendingBirths:[]};vm.createContext(context);vm.runInContext(section('function stepEntities(dt)','function animate()'),context);
  let childTicks=0;
  const child={update(){childTicks++;return false}};
  context.entities=[{update(){context.pendingBirths.push(child);return true}}];
  context.stepEntities(.01);assert.equal(context.entities.length,1);assert.equal(context.entities[0],child);assert.equal(childTicks,0);
  context.stepEntities(.01);assert.equal(childTicks,1);assert.equal(context.pendingBirths.length,0);
});
test('experimental terrain mesh matches the height field at nonzero chunk coordinates',()=>{
  const context={THREE,CHUNK_SIZE:32,CHUNK_SEGMENTS:4,SEA_LEVEL:10000,heightAt:(x,z)=>x*.2+z*.7,mulberry32:()=>()=>.5};
  vm.createContext(context);vm.runInContext(section('class TerrainChunk','function updateChunks()')+';globalThis.chunk=new TerrainChunk(2,-3);',context);
  const p=context.chunk.terrainMesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-context.heightAt(64+p.getX(i),-96+p.getZ(i)))<1e-5);
  assert.equal(context.chunk.terrainMesh.rotation.x,0);
});
test('experimental angles use the shortest turn across negative wrap boundaries',()=>{
  const context={};vm.createContext(context);vm.runInContext(section('function lerpAngle','function wrapWorld'),context);
  const result=context.lerpAngle(Math.PI*3,-Math.PI+.2,.5);
  assert.ok(Math.abs(result-(Math.PI*3+.1))<1e-10);
});
