const {chromium}=require('playwright');
const fs=require('node:fs');
const crypto=require('node:crypto');
const nodePath=require('node:path');
const label=process.argv[2]||'current';
const path=process.argv[3]||'hybrid-learning-v6.html';
const mode=process.argv[4]||'default';
const seeds=['evosim-2026','meadow-17','wetland-42'];
fs.mkdirSync('output',{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const rows=[];
  try{
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:8766/'+path);
    for(const seed of seeds){
      const result=await page.evaluate(({seed,mode})=>{
        experimentRunning=false;restartRun(seed);setPaused(true);
        if(mode==='energy-off')settings.energyAware=false;
        if(mode==='regrowth-off')settings.localRegrowth=false;
        const initial={agents:agents.map(a=>({id:a.id,type:a.type,genes:a.genes,pos:{x:a.pos.x,y:a.pos.y,z:a.pos.z},energy:a.energy})),plants:vegetation.data};
        const initialJSON=JSON.stringify(initial),samples=[];
        let attempts=0,kills=0,starvation=0,submergedStarvation=0;
        const oldAttack=Agent.prototype.attackPrey,oldUpdate=Agent.prototype.update;
        Agent.prototype.attackPrey=function(prey){if(!prey.dead){const before=prey.dead;oldAttack.call(this,prey);attempts++;if(!before&&prey.dead)kills++}};
        Agent.prototype.update=function(...args){oldUpdate.apply(this,args);if(this.dead&&this.energy<=0){starvation++;if(getTerrainHeight(this.pos.x,this.pos.z)<-1.1)submergedStarvation++}};
        const start=performance.now();experimentRunning=true;
        try{for(let i=0;i<6;i++){advanceSimulation(20);samples.push({time,prey:agents.filter(a=>a.type==='prey').length,predators:agents.filter(a=>a.type==='pred').length,plants:vegetation.active,generation:Math.max(0,...agents.map(a=>a.generation))})}}
        finally{Agent.prototype.attackPrey=oldAttack;Agent.prototype.update=oldUpdate;experimentRunning=false}
        return {seed,mode,initialJSON,samples,attemptCalls:attempts,kills,starvation,submergedStarvation,elapsedMs:performance.now()-start,version:VERSION,
          census:typeof census==='undefined'?null:JSON.parse(JSON.stringify(census))};
      },{seed,mode});
      result.initialHash=crypto.createHash('sha256').update(result.initialJSON).digest('hex');delete result.initialJSON;rows.push(result);
      console.log(label,JSON.stringify(result));
      // Persist completed worlds even if a later world is interrupted.
      fs.writeFileSync('output/'+label+'-benchmark.json',JSON.stringify({label,mode,seeds,horizonSeconds:120,completed:rows.length===seeds.length,rows},null,2));
    }
    const source=nodePath.join(nodePath.dirname(path),'src');
    const sourceHashes=Object.fromEntries(fs.readdirSync(source).filter(f=>f.endsWith('.js')).sort().map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(nodePath.join(source,file))).digest('hex')]));
    fs.writeFileSync('output/'+label+'-benchmark.json',JSON.stringify({label,mode,seeds,horizonSeconds:120,completed:true,sourceHashes,rows},null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
