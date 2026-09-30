const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const path=require('node:path');
const base=process.env.EVOSIM_URL||'http://127.0.0.1:8766';
const output=path.resolve('output/browser');fs.mkdirSync(output,{recursive:true});
let server,browser;
const checks=[],errors=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name)}
(async()=>{
  try{await fetch(base)}catch{
    server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:'ignore',windowsHide:true});
    for(let i=0;i<40;i++){try{await fetch(base);break}catch{await new Promise(r=>setTimeout(r,100))}}
  }
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base);await page.waitForFunction(()=>typeof window.render_game_to_text==='function'&&typeof renderer!=='undefined'&&!!vegetation);
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;setPaused(true);settings.shadows=false;renderer.shadowMap.enabled=false;syncUI()});
  await check('app loads offline dependencies and renders the 3D world',async()=>{
    const state=JSON.parse(await page.evaluate(()=>render_game_to_text()));assert.equal(state.version,'6.1');assert.ok(state.prey>0);assert.ok(state.plants>1000);
    assert.equal(await page.locator('#canvasContainer canvas').count(),1);
    assert.deepEqual(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>!r.name.startsWith(location.origin)).map(r=>r.name)),[]);
  });
  await check('same seed and configuration generate identical complete worlds',async()=>{
    const result=await page.evaluate(()=>{restartRun('browser-replay');const first=JSON.stringify(snapshot());restartRun('browser-replay');return first===JSON.stringify(snapshot())});assert.ok(result);
  });
  await check('founders start on habitable terrain with synchronized visible positions',async()=>{
    assert.ok(await page.evaluate(()=>agents.every(a=>getTerrainHeight(a.pos.x,a.pos.z)>=-.75&&getTerrainHeight(a.pos.x,a.pos.z)<=7.5&&a.mesh.position.x===a.pos.x&&a.mesh.position.z===a.pos.z)));
  });
  await check('eligible mature prey can reproduce before routine foraging',async()=>{
    const result=await page.evaluate(()=>{
      const saved=snapshot(),pair=agents.filter(a=>a.type==='prey').slice(0,2);
      for(const a of agents)if(!pair.includes(a))a.dispose();agents=pair;
      const [mother,father]=pair;father.pos.copy(mother.pos);father.pos.x+=.2;
      for(const a of pair){a.age=1;a.energy=110;a.sick=false;a.lastBirth=0}
      time=40;simulationTick=2400;settings.mutation=0;settings.fearLandscape=false;
      const next=simRng.next;simRng.next=()=>0;
      let out;
      try{mother.decide([father],time/dayDuration,seasonInfo());out={count:agents.length,state:mother.state,generation:agents[2]?.generation,mateCooldown:father.lastBirth}}finally{simRng.next=next;restoreSnapshot(saved)}
      return out;
    });
    assert.deepEqual(result,{count:3,state:'MATE',generation:1,mateCooldown:40});
  });
  await check('checkpoint exactly reproduces ecological continuation',async()=>{
    const result=await page.evaluate(()=>{
      weatherSystem.trigger('Storm',18);advanceSimulation(2);const saved=snapshot();advanceSimulation(3);const expected=snapshot();restoreSnapshot(saved);advanceSimulation(3);const actual=snapshot();
      return {equal:JSON.stringify(expected)===JSON.stringify(actual),expected,actual};
    });
    if(!result.equal){fs.writeFileSync(path.join(output,'replay-difference.json'),JSON.stringify(result,null,2))}assert.ok(result.equal,'inspect replay-difference.json');
  });
  await check('playback speed does not change a fixed ecological horizon',async()=>{
    const equal=await page.evaluate(()=>{const saved=snapshot();settings.speed=1;advanceSimulation(2);const a=snapshot();restoreSnapshot(saved);settings.speed=5;advanceSimulation(2);const b=snapshot();delete a.settings.speed;delete b.settings.speed;return JSON.stringify(a)===JSON.stringify(b)});assert.ok(equal);
  });
  await check('sensor observations and visual toggles cannot change future ecology',async()=>{
    const equal=await page.evaluate(()=>{const saved=snapshot();advanceSimulation(2);const a=snapshot();restoreSnapshot(saved);ednaSweep();settings.pheromones=!settings.pheromones;settings.particles=!settings.particles;advanceSimulation(2);const b=snapshot();return JSON.stringify([a.agents,a.plants,a.rng.simulation,a.weather])===JSON.stringify([b.agents,b.plants,b.rng.simulation,b.weather])});assert.ok(equal);
  });
  await check('local interventions preserve terrain, existing plants, and simulation time',async()=>{
    const result=await page.evaluate(()=>{const seed=terrainSeed,p=JSON.stringify(vegetation.data),t=simulationTick;addRefuge();restoreCorridor();return terrainSeed===seed&&p===JSON.stringify(vegetation.data)&&t===simulationTick&&refugia.length===1&&restoredCorridors.length===1});assert.ok(result);
  });
  await check('invalid checkpoint is rejected before touching the live world',async()=>{
    const result=await page.evaluate(()=>{const saved=snapshot(),bad=structuredClone(saved);bad.agents[0].energy=null;let rejected=false;try{restoreSnapshot(bad)}catch{rejected=true}return rejected&&JSON.stringify(saved)===JSON.stringify(snapshot())});assert.ok(result);
  });
  await check('one dead prey cannot feed two predators',async()=>{
    const result=await page.evaluate(()=>{const saved=snapshot(),prey=agents.find(a=>a.type==='prey'),pred=agents.find(a=>a.type==='pred');prey.dead=true;const energy=pred.energy;pred.attackPrey(prey);const okay=pred.energy===energy;restoreSnapshot(saved);return okay});assert.ok(result);
  });
  await check('failed hunts have a cooldown instead of charging every simulation tick',async()=>{
    const result=await page.evaluate(()=>{
      const saved=snapshot(),pred=agents.find(a=>a.type==='pred'),prey=agents.find(a=>a.type==='prey'),next=simRng.next;
      try{settings.energyAware=true;simRng.next=()=>.999;pred.attackCooldown=0;pred.handlingTimer=0;pred.energy=100;
        const count=census.failedHunts;pred.attackPrey(prey);const energy=pred.energy;pred.attackPrey(prey);
        return pred.energy===energy&&energy<100&&pred.attackCooldown>0&&census.failedHunts===count+1;
      }finally{simRng.next=next;restoreSnapshot(saved)}
    });assert.ok(result);
  });
  await check('successful hunts require feeding time and replay correctly during handling',async()=>{
    const result=await page.evaluate(()=>{
      const saved=snapshot(),pred=agents.find(a=>a.type==='pred'),prey=agents.find(a=>a.type==='prey'),next=simRng.next;
      try{settings.energyAware=true;settings.defendedPrey=false;settings.diseasePressure=0;pred.energy=40;pred.attackCooldown=0;pred.handlingTimer=0;simRng.next=()=>0;
        pred.attackPrey(prey);const gradual=pred.energy===40&&pred.pendingMeal===62&&pred.handlingTimer>0&&prey.deathCause==='predation';simRng.next=next;
        simulationStep();const checkpoint=snapshot();advanceSimulation(.5);const expected=snapshot();restoreSnapshot(checkpoint);advanceSimulation(.5);
        return {gradual,replay:JSON.stringify(expected)===JSON.stringify(snapshot()),feeding:agents.find(a=>a.id===pred.id)?.state==='HANDLE'};
      }finally{simRng.next=next;restoreSnapshot(saved)}
    });assert.deepEqual(result,{gradual:true,replay:true,feeding:true});
  });
  await check('rest uses energy and shoreline motion cannot enter deep water',async()=>{
    const result=await page.evaluate(()=>{
      const saved=snapshot(),a=agents[0],height=getTerrainHeight;
      try{getTerrainHeight=(x,z)=>x>0?-2:1;settings.fearLandscape=false;a.pos.set(-.001,1,0);a.vel.set(3,0,0);a.state='REST';a.target=null;a.energy=100;
        a.steerAndMove(1/60,[],seasonInfo(),1,.8);
        const restCosts=a.energy<100,land=a.pos.x<=0;
        a.pos.set(2,-2,0);getTerrainHeight=(x,z)=>x<2?-1.5:-2;a.vel.set(-1,0,0);a.state='EXPLORE';a.steerAndMove(1/60,[],seasonInfo(),-2,.8);
        return {restCosts,land,recovery:a.pos.x<2};
      }finally{getTerrainHeight=height;restoreSnapshot(saved)}
    });assert.deepEqual(result,{restCosts:true,land:true,recovery:true});
  });
  await check('failed births preserve parent energy and successful births inherit founder identity',async()=>{
    const result=await page.evaluate(()=>{
      const saved=snapshot(),mother=agents.find(a=>a.type==='prey'),father=agents.filter(a=>a.type==='prey')[1],height=getTerrainHeight;
      try{const energy=[mother.energy,father.energy],cooldown=[mother.lastBirth,father.lastBirth];getTerrainHeight=()=>-10;mother.reproduce(father);
        const unchanged=JSON.stringify(energy)===JSON.stringify([mother.energy,father.energy])&&JSON.stringify(cooldown)===JSON.stringify([mother.lastBirth,father.lastBirth]);
        getTerrainHeight=height;mother.reproduce(father);const child=agents[agents.length-1];
        return {unchanged,lineage:child.parent===mother&&child.founderId===mother.founderId&&child.generation===mother.generation+1};
      }finally{getTerrainHeight=height;restoreSnapshot(saved)}
    });assert.deepEqual(result,{unchanged:true,lineage:true});
  });
  await check('local renewal visits every patch even when the patch count is divisible by 17',async()=>{
    const result=await page.evaluate(()=>{
      const saved=snapshot(),next=simRng.next;
      try{settings.localRegrowth=true;vegetation.data=vegetation.data.slice(0,17);vegetation.data.forEach(p=>p.active=false);vegetation.active=0;plantCursor=0;growthAccumulator=0;rebuildPlantIndex();
        const positions=JSON.stringify(vegetation.data.map(p=>[p.x,p.z,p.rotation,p.scale]));simRng.next=()=>0;regrowPlants(1);
        return {active:vegetation.active,local:positions===JSON.stringify(vegetation.data.map(p=>[p.x,p.z,p.rotation,p.scale]))};
      }finally{simRng.next=next;restoreSnapshot(saved)}
    });assert.deepEqual(result,{active:17,local:true});
  });
  await check('census accounts for population and remains detached in snapshots',async()=>{
    const result=await page.evaluate(()=>{
      restartRun('census-balance');advanceSimulation(10);
      const balanced=['prey','pred'].every(type=>census.introductions[type]+census.births[type]-census.deaths[type]===agents.filter(a=>a.type===type).length);
      const causes=Object.values(census.causes).reduce((a,b)=>a+b,0)===census.deaths.prey+census.deaths.pred;
      const s=snapshot(),prior=census.births.prey;s.census.births.prey++;
      return balanced&&causes&&census.births.prey===prior&&censusEvents.length<=80;
    });assert.ok(result);
  });
  await check('history samples simulation seconds, never UI redraws',async()=>{
    const result=await page.evaluate(()=>{restartRun('history');for(let i=0;i<10;i++)updateUI(1/60);const before=stats.history.length;advanceSimulation(3);return {before,after:stats.history.length,days:stats.history.map(h=>h.day)}});assert.equal(result.before,1);assert.equal(result.after,4);assert.equal(result.days[3],3/120);
  });
  await check('pause and single-step controls work while preserving history cadence',async()=>{
    const tick=await page.evaluate(()=>simulationTick);await page.locator('#btnStep').click();assert.equal(await page.evaluate(()=>simulationTick),tick+1);assert.equal(await page.locator('#btnPause').textContent(),'Resume');
  });
  await check('save, export, and file import preserve state',async()=>{
    await page.locator('summary').filter({hasText:'Checkpoints & data'}).click();
    await page.locator('#btnSave').click();const before=await page.evaluate(()=>snapshot());
    const downloadPromise=page.waitForEvent('download');await page.locator('#btnExportJSON').click();const download=await downloadPromise;const file=path.join(output,'checkpoint.json');await download.saveAs(file);
    assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),before);
    await page.locator('#btnStep').click();await page.locator('#btnLoad').click();assert.deepEqual(await page.evaluate(()=>snapshot()),before);
    await page.locator('#btnStep').click();await page.locator('#snapshotFile').setInputFiles(file);await page.waitForFunction(t=>simulationTick===t,before.simulationTick);assert.deepEqual(await page.evaluate(()=>snapshot()),before);
  });
  await check('paired rollouts complete, retain receipts, and restore the live state',async()=>{
    await page.evaluate(()=>{document.getElementById('forecastHorizon').value='10';settings.forecastHorizon=10;document.getElementById('experimentReplicates').value='2';document.getElementById('experimentAction').value='corridor'});
    const before=await page.evaluate(()=>snapshot());await page.locator('#btnForecastRun').click();await page.waitForFunction(()=>!experimentRunning&&lastExperiment!==null,{},{timeout:180000});
    assert.deepEqual(await page.evaluate(()=>snapshot()),before);const result=await page.evaluate(()=>lastExperiment);assert.equal(result.rows.length,2);assert.equal(result.seconds,10);assert.equal(result.rows[0].delta.prey,result.rows[0].intervention.prey-result.rows[0].baseline.prey);
    fs.writeFileSync(path.join(output,'experiment.json'),JSON.stringify(result,null,2));
    const downloadPromise=page.waitForEvent('download');await page.locator('#btnExportExperiment').click();const download=await downloadPromise;await download.saveAs(path.join(output,'experiment.csv'));
    assert.match(fs.readFileSync(path.join(output,'experiment.csv'),'utf8'),/configuration_json/);
  });
  await check('paired experiment cancellation restores the live world',async()=>{
    const before=await page.evaluate(()=>snapshot());await page.locator('#btnForecastRun').click();await page.locator('#btnCancelExperiment').click();await page.waitForFunction(()=>!experimentRunning);assert.deepEqual(await page.evaluate(()=>snapshot()),before);assert.match(await page.locator('#experimentStatus').textContent(),/Cancelled/);
  });
  await check('all four intervention arms have defined immediate effects',async()=>{
    const result=await page.evaluate(()=>{const s=snapshot(),out={};for(const action of ['corridor','refuge','geneFlow','socialOff']){restoreSnapshot(s);applyExperimentAction(action);out[action]={prey:agents.filter(a=>a.type==='prey').length,corridors:restoredCorridors.length,refugia:refugia.length,social:settings.socialLearning}}restoreSnapshot(s);return {out,base:s.agents.filter(a=>a.type==='prey').length}});assert.equal(result.out.geneFlow.prey,result.base+10);assert.equal(result.out.corridor.corridors,1);assert.equal(result.out.refuge.refugia,1);assert.equal(result.out.socialOff.social,false);
  });
  await check('empty local survey reports meaningful zeros',async()=>{
    const result=await page.evaluate(()=>{const s=snapshot();for(const a of agents)a.dispose();agents=[];vegetation.data.forEach(p=>p.active=false);vegetation.active=0;settings.sensorNoise=0;ednaSweep();const result={observed:stats.edna.observed,truth:stats.edna.true,label:document.getElementById('sentRichness').textContent};restoreSnapshot(s);return result});assert.deepEqual(result,{observed:0,truth:0,label:'0'});
  });
  await page.evaluate(()=>{document.getElementById('forecastPanel').style.display='none';document.getElementById('controlsPanel').scrollTop=0;renderFrame(0)});
  await page.screenshot({path:path.join(output,'desktop.png')});
  await check('mobile controls drawer and layout remain within the viewport',async()=>{
    await page.setViewportSize({width:390,height:844});await page.locator('label[for=controlsToggle]').click();assert.ok(await page.locator('#controlsPanel').isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const box=await page.locator('#controlsPanel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
    await page.screenshot({path:path.join(output,'mobile-controls.png')});
  });
  await check('no browser runtime or console errors',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
  console.log(`${checks.length} browser checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
