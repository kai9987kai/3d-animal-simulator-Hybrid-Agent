const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:8766/hybrid-learning-v6.html');
 await page.evaluate(()=>{restartRun('evosim-2026');setPaused(true);experimentRunning=true});
 const endpoints=[];
 for(let i=0;i<6;i++){
  const row=await page.evaluate(()=>{advanceSimulation(20);const s=snapshot();validateSnapshot(s);return {time,prey:agents.filter(a=>a.type==='prey').length,predators:agents.filter(a=>a.type==='pred').length,plants:vegetation.active,births:nextAgentId-61,maxGeneration:Math.max(0,...agents.map(a=>a.generation)),history:stats.history.length}});
  endpoints.push(row);console.log(JSON.stringify(row));
 }
 await page.evaluate(()=>{experimentRunning=false;restartRun('evosim-2026');advanceSimulation(8);ednaSweep();const s=snapshot();restoreSnapshot(s);setPaused(true);updateUI(1/60);renderFrame(0)});
 const candidate=await page.evaluate(()=>agents.map(a=>{const p=a.mesh.position.clone().project(camera);return {id:a.id,x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z}}).find(p=>p.x>300&&p.x<1080&&p.y>160&&p.y<900&&p.z<1));
 if(!candidate)throw Error('No visible candidate');await page.mouse.click(candidate.x,candidate.y);
 const selected=await page.evaluate(()=>selectedId);if(selected===null)throw Error('Animal selection failed');
 await page.evaluate(()=>{renderFrame(0);updateUI(1/60)});await page.screenshot({path:'output/browser/inspector.png'});
 await page.evaluate(()=>{unfollow();document.getElementById('controlsPanel').scrollTop=0;camera.position.set(0,32,46);controls.target.set(0,0,0);renderFrame(0)});await page.screenshot({path:'output/browser/final-desktop.png'});
 const zero=await page.evaluate(()=>{const s=snapshot();settings.speed=0;const tick=simulationTick,timer=weatherSystem.timer;setPaused(false);return {tick,timer}});await page.waitForTimeout(300);
 const afterZero=await page.evaluate(()=>{setPaused(true);return {tick:simulationTick,timer:weatherSystem.timer}});
 if(JSON.stringify(zero)!==JSON.stringify(afterZero))throw Error('Zero speed advances ecology');
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('output/browser/extended-smoke.json',JSON.stringify({endpoints,selected,zeroSpeedStable:true,errors},null,2));console.log('Extended runtime, valid surveyed checkpoint, selection and zero-speed checks passed.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
