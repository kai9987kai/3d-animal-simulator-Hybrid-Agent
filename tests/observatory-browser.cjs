const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve('output/observatory');fs.mkdirSync(output,{recursive:true});
const {spawn}=require('node:child_process');
const checks=[],errors=[];let browser,server;
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name)}
(async()=>{
  try{await fetch('http://127.0.0.1:8766')}catch{
    server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:'ignore',windowsHide:true});
    for(let i=0;i<40;i++){try{await fetch('http://127.0.0.1:8766');break}catch{await new Promise(r=>setTimeout(r,100))}}
  }
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:8766/hybrid-learning-v6.html');
  // Drive rendering explicitly during this interaction suite so idle software
  // WebGL rendering does not compete with the deterministic rollout checks.
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;restartRun('observatory-qa');setPaused(true);advanceTime(5000)});
  await check('observatory opens with accounted populations and closes accessibly',async()=>{
    await page.locator('#btnObservatory').click();assert.equal(await page.locator('#btnObservatory').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#obsBalance').textContent(),'Population accounted for');
    assert.equal(await page.locator('#obsIntroductions').textContent(),'52 / 8');
    assert.ok(await page.locator('#censusLedger li').count()>0);
    await page.screenshot({path:path.join(output,'desktop-census.png')});
    await page.getByRole('button',{name:'Close Living systems census',exact:true}).click();
    assert.equal(await page.locator('#btnObservatory').getAttribute('aria-expanded'),'false');
  });
  await check('history switches readable units without modifying model state',async()=>{
    const saved=await page.evaluate(()=>snapshot());
    for(const [metric,unit] of [['resources','plants'],['energy','energy units'],['population','animals']]){
      await page.locator('#historyMetric').selectOption(metric);assert.match(await page.locator('#historySummary').textContent(),new RegExp(unit));
      assert.match(await page.locator('#graph').getAttribute('aria-label'),new RegExp(metric));
    }
    assert.deepEqual(await page.evaluate(()=>snapshot()),saved);
  });
  await check('behavior toggles and the two additional experiment arms have defined effects',async()=>{
    await page.locator('details').filter({has:page.locator('#chkEnergyAware')}).locator('summary').click();
    await page.locator('#chkEnergyAware').uncheck();await page.locator('#chkLocalRegrowth').uncheck();
    assert.deepEqual(await page.evaluate(()=>[settings.energyAware,settings.localRegrowth]),[false,false]);
    await page.locator('#chkEnergyAware').check();await page.locator('#chkLocalRegrowth').check();
    const result=await page.evaluate(()=>{const saved=snapshot();applyExperimentAction('energyOff');const energy=!settings.energyAware&&settings.localRegrowth;restoreSnapshot(saved);applyExperimentAction('regrowthOff');const renewal=settings.energyAware&&!settings.localRegrowth;restoreSnapshot(saved);return {energy,renewal}});
    assert.deepEqual(result,{energy:true,renewal:true});
  });
  await check('history CSV contains recorded energy and demographic measurements',async()=>{
    await page.locator('summary').filter({hasText:'Checkpoints & data'}).click();
    const pending=page.waitForEvent('download');await page.locator('#btnExport').click();const download=await pending;const file=path.join(output,'history.csv');await download.saveAs(file);
    const csv=fs.readFileSync(file,'utf8');assert.match(csv,/prey_mean_energy,predator_mean_energy,births,deaths/);assert.ok(csv.split('\n').length>2);
  });
  await check('new experiment arms complete with census endpoints and exact live-state restoration',async()=>{
    for(const action of ['energyOff','regrowthOff']){
      await page.evaluate(action=>{document.getElementById('forecastHorizon').value='10';settings.forecastHorizon=10;document.getElementById('experimentReplicates').value='2';document.getElementById('experimentAction').value=action},action);
      const saved=await page.evaluate(()=>snapshot());
      await page.evaluate(()=>runMicroForecast());
      assert.deepEqual(await page.evaluate(()=>snapshot()),saved);
      const experiment=await page.evaluate(()=>lastExperiment);assert.equal(experiment.action,action);assert.equal(experiment.rows.length,2);
      assert.equal(experiment.startingSnapshot.schemaVersion,7);
      for(const row of experiment.rows)for(const key of ['births','deaths','predation','starvation','kills','failedHunts','grazes','regrown','livingLineages','preyEnergy','predatorEnergy'])assert.equal(row.delta[key],row.intervention[key]-row.baseline[key]);
      fs.writeFileSync(path.join(output,action+'-experiment.json'),JSON.stringify(experiment,null,2));
    }
  });
  await check('complete 6.0-format state migrates in-browser with explicit model-change provenance',async()=>{
    const legacy=await page.evaluate(()=>{
      restartRun('migration-qa');const s=snapshot();s.version='6.0';s.schemaVersion=6;
      for(const key of ['census','censusEvents','growthAccumulator'])delete s[key];
      delete s.settings.energyAware;delete s.settings.localRegrowth;
      for(const a of s.agents)for(const key of ['founderId','attackCooldown','handlingTimer','pendingMeal','lastMealTime','deathCause'])delete a[key];
      return s;
    });
    const result=await page.evaluate(legacy=>{restoreSnapshot(legacy);const s=snapshot();return {schema:s.schemaVersion,version:s.version,notice:s.stats.events[0],population:s.agents.length,introduced:s.census.introductions.prey+s.census.introductions.pred}},legacy);
    assert.equal(result.schema,7);assert.equal(result.version,'6.1');assert.match(result.notice,/not an exact 6.0 continuation/);assert.equal(result.population,result.introduced);
  });
  await check('census panel and close controls remain usable on a narrow screen',async()=>{
    await page.evaluate(()=>{document.getElementById('forecastPanel').style.display='none';document.getElementById('controlsToggle').checked=false;updateUI(1/60)});
    await page.setViewportSize({width:390,height:844});await page.locator('#btnObservatory').click();
    const box=await page.locator('#observatoryPanel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'mobile-census.png')});
    await page.getByRole('button',{name:'Close Living systems census',exact:true}).click();assert.equal(await page.locator('#btnObservatory').getAttribute('aria-expanded'),'false');
  });
  await check('no browser errors',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
  console.log(checks.length+' observatory browser checks passed');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
