
'use strict';

const VERSION='6.0';
const FIXED_DT=1/60, MAX_AGENTS=1200;
let runSeed='evosim-2026', terrainSeed=runSeed+':terrain';
let simRng=EvoLab.createRng(runSeed+':ecology'), sensorRng=EvoLab.createRng(runSeed+':sensors'), visualRng=EvoLab.createRng(runSeed+':visuals');
let simulationTick=0, accumulator=0, nextAgentId=1, experimentRunning=false;
let phenologyCache={prey:1,pred:1};
const plantGrid=new EvoLab.PointIndex(8);
const animalParts={head:new THREE.SphereGeometry(1,7,5),leg:new THREE.BoxGeometry(1,1,1),ear:new THREE.ConeGeometry(1,1,4)};
function addAnimalDetails(body,size,type,material){
  // Merge the silhouette into one draw call; shared templates stay alive.
  const parts=[body.geometry.toNonIndexed()];
  const part=(geometry,scale,position,rotation=0)=>{const g=geometry.toNonIndexed();g.scale(...scale.map(v=>v*size));if(rotation)g.rotateX(rotation);g.translate(...position.map(v=>v*size));parts.push(g)};
  part(animalParts.head,[.23,.23,.28],[0,.23,.43]);
  for(const x of [-.16,.16])for(const z of [-.25,.25])part(animalParts.leg,[.09,.3,.10],[x,-.32,z]);
  for(const x of [-.12,.12])part(animalParts.ear,[.085,type==='prey'?.23:.15,.075],[x,.47,.44]);
  part(animalParts.leg,[.07,.07,type==='prey'?.2:.45],[0,.06,-.57],-.35);
  const merged=new THREE.BufferGeometry();
  for(const attr of ['position','normal']){const values=[];for(const g of parts)values.push(...g.attributes[attr].array);merged.setAttribute(attr,new THREE.Float32BufferAttribute(values,3))}
  parts.forEach(g=>g.dispose());body.geometry.dispose();body.geometry=merged;
}
const random=()=>simRng.next(), visualRandom=()=>visualRng.next(), visualRnd=(a,b)=>a+(b-a)*visualRandom();
const WORLD_SIZE = 150, TERR_RES = 140, MAX_PLANTS = 3800;
const COLORS = { prey:0x5eff7e, pred:0xff4f66, water:0x4fc3f7, night:0x03070d, day:0x89cdf2, dusk:0xff9c68, refuge:0x56f0b2, sensor:0x7dd3fc, fear:0xff8b3d };
const rnd=(a,b)=>random()*(b-a)+a, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz};

let scene,camera,renderer,controls,clock,terrain,water,sun,lightDir,lightHemi,fireflies,weatherSystem,pheromones,heatmapMesh,refugeGroup;
let simplex, envData, vegetation, terrainMaterial;
let agents=[], followTarget=null, selectedId=null;
let mouse=new THREE.Vector2(), raycaster=new THREE.Raycaster();
let time=0, dayDuration=120, paused=false, lastFps=60, uiTick=0, plantCursor=0, cinematicAngle=0, extremeEventClock=0;
let refugia=[], restoredCorridors=[], soilPulses=[], fearPulses=[], sensors=[];
let pathogen={id:1,virulence:.55,transmission:.5,immuneEscape:.35};
let settings={
  speed:1,chaos:1,climateStress:.35,climateTrend:.10,mutation:.05,diseasePressure:.2,fragmentation:.2,learningRate:.25,phenologyDrift:.20,sensorNoise:.18,forecastHorizon:30,
  particles:true,pheromones:true,heatmap:false,riskMap:false,lineage:false,cameraMode:'orbit',shadows:true,quality:false,
  adaptiveLearning:true,carryingCapacity:true,defendedPrey:true,autoEvents:true,fearLandscape:true,nicheConstruction:true,socialLearning:true,ednaSensors:true
};
let stats={history:[],events:[],speciesCount:0,diversity:0,weather:'Clear',season:'Spring',sick:0,ews:'Stable',ac1:0,variance:0,climateAnomaly:0,phenologyMismatch:0,edna:{observed:0,true:0,confidence:0,bias:0,last:'No sweep yet'},forecast:{risk:0,action:'Run forecast',notes:'No forecast yet'}};
const dummy=new THREE.Object3D();

class SpatialHash{
  constructor(cellSize){this.cell=cellSize;this.map=new Map()}
  key(x,z){return Math.floor(x/this.cell)+'_'+Math.floor(z/this.cell)}
  clear(){this.map.clear()}
  insert(obj){const k=this.key(obj.pos.x,obj.pos.z);if(!this.map.has(k))this.map.set(k,[]);this.map.get(k).push(obj)}
  query(x,z,r){const out=[],range=Math.ceil(r/this.cell),cx=Math.floor(x/this.cell),cz=Math.floor(z/this.cell);for(let i=-range;i<=range;i++)for(let j=-range;j<=range;j++){const k=(cx+i)+'_'+(cz+j);if(this.map.has(k))out.push(...this.map.get(k))}return out}
}
const grid=new SpatialHash(9);

const waterVert=`uniform float uTime; varying float vHeight; void main(){vec3 pos=position;float wave=sin(pos.x*.45+uTime)*.16+cos(pos.z*.36+uTime*.8)*.13+sin((pos.x+pos.z)*.12+uTime*1.4)*.05;pos.y+=wave;vHeight=wave;gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);}`;
const waterFrag=`varying float vHeight; void main(){vec3 deep=vec3(0.0,0.18,0.42);vec3 shallow=vec3(0.18,0.62,0.92);vec3 col=mix(deep,shallow,clamp(vHeight+0.52,0.0,1.0));gl_FragColor=vec4(col,0.72);}`;

function notify(msg){if(experimentRunning)return;const t=document.getElementById('toast');t.textContent=msg;t.style.opacity=1;clearTimeout(notify.t);notify.t=setTimeout(()=>t.style.opacity=0,2400)}
function logEvent(msg){stats.events.unshift(`D${Math.floor(time/dayDuration)} ${msg}`);stats.events=stats.events.slice(0,34)}
function dynamicClimateStress(){return clamp(settings.climateStress + settings.climateTrend*(time/(dayDuration*36)),0,1.35)}
function seasonInfo(){const y=(time%(dayDuration*4))/(dayDuration*4);const idx=Math.floor(y*4);const names=['Spring','Summer','Autumn','Winter'];const anomaly=dynamicClimateStress()-settings.climateStress;const temp=clamp([.62,.92,.48,.18][idx]+anomaly*.35,0,1.25);const growth=clamp([1.25,.95,.75,.36][idx]*(1-dynamicClimateStress()*.25),.08,1.55);return {idx,name:names[idx],temp,growth};}
function refugeAt(x,z){let bonus=0,nearest=999; for(const r of refugia){const d=Math.hypot(x-r.x,z-r.z); if(d<r.radius){bonus=Math.max(bonus,(1-d/r.radius)*r.quality); nearest=Math.min(nearest,d)}} return {bonus,nearest}}
function corridorAt(x,z){let bonus=0; for(const c of restoredCorridors){const d=distanceToSegment(x,z,c.x1,c.z1,c.x2,c.z2); if(d<c.width)bonus=Math.max(bonus,(1-d/c.width)*c.quality)} return bonus}
function distanceToSegment(px,pz,x1,z1,x2,z2){const vx=x2-x1,vz=z2-z1,wx=px-x1,wz=pz-z1,c1=vx*wx+vz*wz,c2=vx*vx+vz*vz,t=clamp(c1/Math.max(.0001,c2),0,1),x=x1+t*vx,z=z1+t*vz;return Math.hypot(px-x,pz-z)}
function habitatConnectivity(x,z){const frag=settings.fragmentation; const corridor=corridorAt(x,z); const n=simplex?simplex.noise2D(x*.045+710,z*.045-330):0; const road=Math.abs(simplex?simplex.noise2D(x*.015-90,z*.015+80):0); let pass=clamp(1-frag*(road>.62?.85:.32)-frag*clamp(n*.5+.5,0,1)*.32+corridor*.75,0,1); return pass}
function habitatRisk(x,z,h){const m=moistureAt(x,z,h), f=fertilityAt(x,z,h,m), conn=habitatConnectivity(x,z), fear=settings.fearLandscape?fearAt(x,z)*.12:0; return clamp((1-f)*.55+(1-conn)*.35+dynamicClimateStress()*.22+fear,0,1)}
function radialPulseAt(list,x,z,scale=1){let v=0; for(const p of list){const r=p.radius||10,d=Math.hypot(x-p.x,z-p.z); if(d<r)v+=p.strength*(1-d/r)*scale} return clamp(v,0,2)}
function soilAt(x,z){return settings.nicheConstruction?radialPulseAt(soilPulses,x,z,1):0}
function fearAt(x,z){return settings.fearLandscape?radialPulseAt(fearPulses,x,z,1):0}
function depositSoil(pos,amount=.25,radius=8){if(!settings.nicheConstruction)return; soilPulses.push({x:pos.x,z:pos.z,strength:amount,radius,life:1}); if(soilPulses.length>360)soilPulses.shift()}
function depositFear(pos,amount=.55,radius=13){if(!settings.fearLandscape)return; fearPulses.push({x:pos.x,z:pos.z,strength:amount,radius,life:1}); if(fearPulses.length>420)fearPulses.shift()}
function updateEcoFields(dt){for(const p of soilPulses){p.life-=dt*.018;p.strength*=1-dt*.010} for(const p of fearPulses){p.life-=dt*.060;p.strength*=1-dt*.040} soilPulses=soilPulses.filter(p=>p.life>0&&p.strength>.015); fearPulses=fearPulses.filter(p=>p.life>0&&p.strength>.015)}
function phenologyMatch(type,si){const seasonal=[.95,.82,.58,.36][si.idx], drift=dynamicClimateStress()*settings.phenologyDrift, trait=phenologyCache[type]; return clamp(seasonal + (trait-1)*.22 - drift*(type==='pred'?.45:.35), .12, 1.08)}
function initSensors(){sensors=[{x:-42,z:-34,radius:27,last:0},{x:38,z:-26,radius:27,last:0},{x:0,z:42,radius:30,last:0}]}

function init(){
  const container=document.getElementById('canvasContainer');
  scene=new THREE.Scene(); scene.background=new THREE.Color(COLORS.day); scene.fog=new THREE.Fog(COLORS.day,60,175);
  camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,240); camera.position.set(0,32,46);
  renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:new URLSearchParams(location.search).has('capture')}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(1); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; container.appendChild(renderer.domElement);
  controls=new THREE.OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxPolarAngle=Math.PI/2-.08; controls.target.set(0,0,0);
  clock=new THREE.Clock();
  lightHemi=new THREE.HemisphereLight(0xffffff,0x27313b,.62); scene.add(lightHemi);
  lightDir=new THREE.DirectionalLight(0xffffff,1); lightDir.position.set(50,90,45); lightDir.castShadow=true; Object.assign(lightDir.shadow.camera,{left:-82,right:82,top:82,bottom:-82,near:1,far:180}); lightDir.shadow.mapSize.set(2048,2048); scene.add(lightDir);
  sun=new THREE.Mesh(new THREE.SphereGeometry(4,18,18),new THREE.MeshBasicMaterial({color:0xffb13d})); scene.add(sun);
  refugeGroup=new THREE.Group(); scene.add(refugeGroup); initSensors();
  initWorld({repopulate:true}); fireflies=new Fireflies(); weatherSystem=new WeatherSystem(); pheromones=new Pheromones();
  for(let i=0;i<52;i++) spawnAgent('prey',rnd(-35,35),rnd(-35,35));
  for(let i=0;i<8;i++) spawnAgent('pred',rnd(-35,35),rnd(-35,35));
  setupUI(); setupLabUI(); sampleHistory(); updateUI(1/60); updateODDNotes(); addEventListener('resize',onResize); renderer.domElement.addEventListener('pointerdown',onPointerDown); animate();
}

function noiseHeight(x,z){
  const c=settings.chaos;
  let n=simplex.noise2D(x*.018*c,z*.018*c)*8.8;
  n+=simplex.noise2D(x*.065,z*.065)*1.55;
  n+=simplex.noise2D(x*.15+90,z*.15-40)*.42;
  const radial=Math.hypot(x,z)/(WORLD_SIZE*.58); n-=Math.max(0,radial-1)*5;
  if(n<0)n*=.42; return n;
}
function moistureAt(x,z,h){const stress=dynamicClimateStress(),soil=soilAt(x,z);return clamp(.55+simplex.noise2D(x*.025+200,z*.025-90)*.32 - Math.max(0,h-4)*.035 + (h<.2?.22:0) - stress*.12 + refugeAt(x,z).bonus*.18 + soil*.05,0,1)}
function fertilityAt(x,z,h,m){const warmth=seasonInfo().temp,conn=habitatConnectivity(x,z),ref=refugeAt(x,z).bonus,soil=soilAt(x,z),fear=settings.fearLandscape?fearAt(x,z)*.05:0; return clamp((1-Math.abs(h-1.5)/8)*.50+m*.38+warmth*.17-dynamicClimateStress()*.14-settings.fragmentation*.1 + conn*.18 + ref*.35 + soil*.22 + fear,0,1)}
function getTerrainHeight(x,z){if(!simplex)return 0; if(Math.abs(x)>WORLD_SIZE/2||Math.abs(z)>WORLD_SIZE/2)return -10; return noiseHeight(x,z)}

function initWorld({regenerate=false,repopulate=false}={}){
  if(regenerate)terrainSeed=runSeed+':terrain:'+Math.floor(random()*4294967296);
  simplex=new SimplexNoise(terrainSeed);
  if(terrain){scene.remove(terrain); terrain.geometry.dispose(); terrain.material.dispose()}
  if(water){scene.remove(water); water.geometry.dispose(); water.material.dispose()}
  if(heatmapMesh){scene.remove(heatmapMesh); heatmapMesh.geometry.dispose(); heatmapMesh.material.dispose()}
  const geo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,TERR_RES,TERR_RES); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, colors=new Float32Array(pos.count*3);
  envData={height:new Float32Array(pos.count),moisture:new Float32Array(pos.count),fertility:new Float32Array(pos.count),mini:null};
  const dirt=new THREE.Color(0x49351d), grass=new THREE.Color(0x2e7d32), rock=new THREE.Color(0x7f8792), snow=new THREE.Color(0xf0f6ff), sand=new THREE.Color(0xe6ca91), swamp=new THREE.Color(0x31583c), poor=new THREE.Color(0x281f1b), refugeColor=new THREE.Color(0x2bd88f);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),h=noiseHeight(x,z),m=moistureAt(x,z,h),f=fertilityAt(x,z,h,m),risk=habitatRisk(x,z,h),ref=refugeAt(x,z).bonus; envData.height[i]=h; envData.moisture[i]=m; envData.fertility[i]=f; pos.setY(i,h);
    const c=new THREE.Color();
    if(h<-1)c.copy(sand); else if(h<2.8)c.copy(grass).lerp(swamp,m*.35).lerp(dirt,clamp((.45-f)*.7,0,.45)); else if(h<8.2)c.copy(rock).lerp(grass,clamp((7-h)/6,0,.45)); else c.copy(snow);
    c.lerp(poor,risk*.24).lerp(refugeColor,ref*.28);
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3)); geo.computeVertexNormals();
  terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,flatShading:true}); terrain=new THREE.Mesh(geo,terrainMaterial); terrain.receiveShadow=true; scene.add(terrain);
  const wGeo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,70,70); wGeo.rotateX(-Math.PI/2); water=new THREE.Mesh(wGeo,new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:waterVert,fragmentShader:waterFrag,transparent:true,depthWrite:false})); water.position.y=-1.15; scene.add(water);
  buildHeatmap(); if(repopulate||!vegetation)initVegetation(); makeMiniTerrainCache(); drawRefugia();
}
function buildHeatmap(){
  const geo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,70,70); geo.rotateX(-Math.PI/2); const pos=geo.attributes.position, colors=new Float32Array(pos.count*3); const cool=new THREE.Color(0x244bff), hot=new THREE.Color(0xffff3d), riskC=new THREE.Color(0xff315d);
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=getTerrainHeight(x,z),m=moistureAt(x,z,h),f=fertilityAt(x,z,h,m),risk=habitatRisk(x,z,h);pos.setY(i,h+.06);const c=cool.clone().lerp(hot,f).lerp(riskC,risk*.35);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3)); heatmapMesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.40,depthWrite:false})); heatmapMesh.visible=settings.heatmap; scene.add(heatmapMesh);
}
function initVegetation(populate=true){
  plantGrid.clear();
  if(vegetation){scene.remove(vegetation.mesh); vegetation.mesh.geometry.dispose(); vegetation.mesh.material.dispose()}
  const geo=new THREE.CylinderGeometry(0,.55,1.55,5); geo.translate(0,.75,0);
  const mat=new THREE.MeshLambertMaterial({color:0x65bd65}); const mesh=new THREE.InstancedMesh(geo,mat,MAX_PLANTS); mesh.castShadow=true; mesh.receiveShadow=true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vegetation={mesh,data:[],active:0}; scene.add(mesh); if(populate)for(let i=0;i<1550;i++) spawnPlant(); mesh.count=vegetation.data.length; mesh.instanceMatrix.needsUpdate=true;
}
function rebuildPlantIndex(){plantGrid.clear();vegetation.data.forEach((p,i)=>{if(p.active)plantGrid.insert(i,p.x,p.z)})}
function localPlantDensity(x,z,r=5){return plantGrid.query(x,z,r).filter(i=>vegetation.data[i]?.active).length}
function drawPlant(i){const p=vegetation.data[i];if(!p.active){hidePlant(i);return}dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.scale||1);dummy.rotation.set(0,p.rotation||0,0);dummy.updateMatrix();vegetation.mesh.setMatrixAt(i,dummy.matrix);vegetation.mesh.instanceMatrix.needsUpdate=true}
function spawnPlant(index=null){
  let x,z,y,m,f,ok=false; for(let k=0;k<20;k++){x=rnd(-WORLD_SIZE/2,WORLD_SIZE/2);z=rnd(-WORLD_SIZE/2,WORLD_SIZE/2);y=getTerrainHeight(x,z);m=moistureAt(x,z,y);f=fertilityAt(x,z,y,m); const crowd=settings.carryingCapacity?localPlantDensity(x,z,6):0; if(y>-.75&&y<7.5&&random()<f+.10-crowd*.02){ok=true;break}}
  if(!ok)return false; const s=rnd(.45,1.25)*(0.72+f*.82); dummy.position.set(x,y,z); dummy.scale.set(s,s,s); dummy.rotation.y=random()*Math.PI; dummy.updateMatrix();
  const plant={x,z,y,scale:s,rotation:dummy.rotation.y,active:true,energy:24*s*(.68+f),fertility:f,nutrient:rnd(.7,1.35)+soilAt(x,z)*.25,age:0};
  if(index===null){if(vegetation.data.length>=MAX_PLANTS)return false; index=vegetation.data.length; vegetation.data.push(plant); vegetation.mesh.count=vegetation.data.length}else vegetation.data[index]=plant;
  vegetation.mesh.setMatrixAt(index,dummy.matrix); plantGrid.insert(index,x,z); vegetation.active++; vegetation.mesh.instanceMatrix.needsUpdate=true; return true;
}
function hidePlant(i){dummy.scale.set(0,0,0);dummy.position.set(0,-999,0);dummy.updateMatrix();vegetation.mesh.setMatrixAt(i,dummy.matrix);vegetation.mesh.instanceMatrix.needsUpdate=true}
function regrowPlants(dt){
  const s=seasonInfo(); let attempts=Math.ceil(2*s.growth*(1-dynamicClimateStress()*.45));
  if(stats.weather==='Drought'||stats.weather==='Heatwave')attempts=Math.max(0,attempts-1); if(stats.weather==='Storm')attempts+=1;
  for(let a=0;a<attempts;a++){plantCursor=(plantCursor+17)%Math.max(1,vegetation.data.length); const p=vegetation.data[plantCursor]; if(p&&!p.active && random()<0.025*s.growth*(1-dynamicClimateStress()*.5))spawnPlant(plantCursor)}
}
function makeMiniTerrainCache(){
  const size=224,can=document.createElement('canvas'),ctx=can.getContext('2d'); can.width=can.height=size; const img=ctx.createImageData(size,size),half=WORLD_SIZE/2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const wx=x/size*WORLD_SIZE-half,wz=y/size*WORLD_SIZE-half,h=getTerrainHeight(wx,wz),m=moistureAt(wx,wz,h),f=fertilityAt(wx,wz,h,m),risk=habitatRisk(wx,wz,h),ref=refugeAt(wx,wz).bonus,i=(y*size+x)*4; let r=35,g=85,b=42; if(h<-1){r=39;g=96;b=150}else if(h<-.5){r=202;g=180;b=117}else if(h>8){r=230;g=238;b=245}else if(h>3){r=105;g=111;b=116}else{g=95+Math.floor(m*70);r=35+Math.floor(m*20)} r=Math.floor(lerp(r,55+f*30,ref*.4)); g=Math.floor(lerp(g,205,ref*.38)); b=Math.floor(lerp(b,135,ref*.3)); r=Math.floor(lerp(r,120,risk*.18)); g=Math.floor(lerp(g,50,risk*.14)); img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255}
  ctx.putImageData(img,0,0); envData.mini=can;
}
function drawRefugia(){
  while(refugeGroup.children.length){const o=refugeGroup.children.pop(); o.geometry.dispose(); o.material.dispose()}
  for(const r of refugia){const geo=new THREE.RingGeometry(r.radius*.94,r.radius,64);geo.rotateX(-Math.PI/2);const mat=new THREE.MeshBasicMaterial({color:COLORS.refuge,transparent:true,opacity:.38,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(r.x,getTerrainHeight(r.x,r.z)+.18,r.z);refugeGroup.add(mesh)}
}

function randomGenes(type){return {size:rnd(.82,1.18),speed:rnd(.88,1.14),sense:rnd(.88,1.15),immunity:rnd(.82,1.18),thermal:rnd(.82,1.18),efficiency:rnd(.82,1.16),plasticity:rnd(.75,1.25),defense:type==='prey'?rnd(.05,.55):rnd(0,.2),boldness:type==='pred'?rnd(.55,.95):rnd(.2,.65),memory:rnd(.75,1.25),policy:[rnd(.75,1.3),rnd(.75,1.3),rnd(.75,1.3),rnd(.75,1.3)]}}
function mutateGenes(g){
  const m=settings.mutation, mg=v=>clamp(v*(1+rnd(-m,m)),.35,2.1);
  return {size:mg(g.size),speed:mg(g.speed),sense:mg(g.sense),immunity:mg(g.immunity),thermal:mg(g.thermal||1),efficiency:mg(g.efficiency||1),plasticity:mg(g.plasticity||1),defense:clamp((g.defense||0)+rnd(-m,m),0,1.2),boldness:clamp(g.boldness+rnd(-m,m),0,1),memory:mg(g.memory),policy:g.policy.map(w=>clamp(w+rnd(-m*2,m*2),.20,2.4))}
}
function mixGenes(a,b){return EvoLab.crossGenes(a,b,settings.mutation,random)}
function geneDistance(a,b){return Math.abs(a.size-b.size)+Math.abs(a.speed-b.speed)+Math.abs(a.sense-b.sense)+Math.abs(a.immunity-b.immunity)+Math.abs((a.thermal||1)-(b.thermal||1))+Math.abs((a.plasticity||1)-(b.plasticity||1))+Math.abs((a.defense||0)-(b.defense||0))+Math.abs(a.boldness-b.boldness)+Math.abs(a.memory-b.memory)}
function ecoType(g,type){const a=Math.floor(clamp(g.size*3,0,5)),b=Math.floor(clamp(g.speed*3,0,5)),c=Math.floor(clamp(g.sense*3,0,5)),d=Math.floor(clamp((g.defense||0)*5,0,5)); return (type==='pred'?'P':'H')+String.fromCharCode(65+((a*7+b*3+c+d*5)%18));}
function policyName(g){const p=g.policy,idx=p.indexOf(Math.max(...p));return ['social','forager','evasive','explorer'][idx]||'balanced'}
function spawnAgent(type,x,z,genes=null,parent=null){if(agents.length>=MAX_AGENTS)return null;
  const habitable=(x,z)=>{const h=getTerrainHeight(x,z);return h>=-.75&&h<=7.5};
  if(!habitable(x,z)){
    let found=false;
    for(let i=0;i<24;i++){const px=clamp(x+rnd(-12,12),-70,70),pz=clamp(z+rnd(-12,12),-70,70);if(habitable(px,pz)){x=px;z=pz;found=true;break}}
    if(!found){const land=vegetation.data.filter(p=>habitable(p.x,p.z));if(!land.length)return null;const p=land[Math.floor(random()*land.length)];x=p.x;z=p.z}
  }
  const a=new Agent(type,x,z,genes,parent); agents.push(a); return a}
function agentColor(type,genes,sick=false){if(sick)return 0xb86cff; if(type==='prey'){const base=new THREE.Color(COLORS.prey),def=new THREE.Color(0xe6ff55); return base.lerp(def,settings.defendedPrey?clamp(genes.defense||0,0,1)*.75:0).getHex()} return COLORS.pred}

class Agent{
  constructor(type,x,z,genes=null,parent=null){
    this.id=nextAgentId++; this.type=type; this.parent=parent||null; this.generation=parent?parent.generation+1:0; this.pos=new THREE.Vector3(x,getTerrainHeight(x,z),z); this.vel=new THREE.Vector3(rnd(-1,1),0,rnd(-1,1)).normalize(); this.acc=new THREE.Vector3(); this.genes=genes||randomGenes(type);
    this.maxSpeed=(type==='prey'?3.45:4.05)*this.genes.speed*(1-(type==='prey'&&settings.defendedPrey?(this.genes.defense||0)*.12:0)); this.maxForce=6.3; this.perception=(type==='prey'?16:26)*this.genes.sense; this.size=this.genes.size; this.energy=rnd(82,105); this.health=100; this.age=0; this.state='IDLE'; this.target=null; this.targetIdx=-1; this.memory=[]; this.sick=false; this.immuneMemory=0; this.dead=false; this.eco=ecoType(this.genes,type); this.lastBirth=0; this.lastEnergy=this.energy; this.lastHealth=this.health; this.reward=0; this.actionIdx=3;
    const col=agentColor(type,this.genes,false); const geo=new THREE.BoxGeometry((type==='prey'?.42:.55)*this.size,.45*this.size,(type==='prey'?.78:.95)*this.size);
    const mat=new THREE.MeshStandardMaterial({color:col,roughness:.38,metalness:.02}); this.mesh=new THREE.Mesh(geo,mat); this.mesh.castShadow=true; this.mesh.userData={agent:this}; addAnimalDetails(this.mesh,this.size,type,mat); this.mesh.position.copy(this.pos);this.mesh.position.y+=.42*this.size;this.mesh.lookAt(this.pos.clone().add(this.vel));scene.add(this.mesh);
    if(settings.lineage&&!experimentRunning)this.addLabel();
  }
  addLabel(){if(this.label)return; const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'); canvas.width=160;canvas.height=34;ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(0,0,160,34);ctx.fillStyle='#fff';ctx.font='18px Segoe UI';ctx.textAlign='center';ctx.fillText(this.eco+' G'+this.generation,80,22); const tex=new THREE.CanvasTexture(canvas); const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true})); spr.scale.set(6.2,1.32,1); this.label=spr; scene.add(spr)}
  removeLabel(){if(this.label){scene.remove(this.label);this.label.material.map.dispose();this.label.material.dispose();this.label=null}}
  update(dt,neighbors,dayRatio){
    this.age+=dt/dayDuration; if(settings.lineage&&!this.label&&!experimentRunning)this.addLabel(); if(!settings.lineage&&this.label)this.removeLabel(); this.memory.forEach(m=>m.ttl-=dt); this.memory=this.memory.filter(m=>m.ttl>0);
    const si=seasonInfo(), h=getTerrainHeight(this.pos.x,this.pos.z), moist=moistureAt(this.pos.x,this.pos.z,h), fert=fertilityAt(this.pos.x,this.pos.z,h,moist);
    this.handleDisease(dt,neighbors,fert); this.decide(neighbors,dayRatio,si); this.steerAndMove(dt,neighbors,si,h,fert); this.learn(dt); this.socialImitate(neighbors);
    if(!experimentRunning){this.mesh.position.copy(this.pos); this.mesh.position.y+=.42*this.size; if(this.vel.lengthSq()>.04)this.mesh.lookAt(this.pos.clone().add(this.vel));
    this.mesh.material.color.lerp(new THREE.Color(agentColor(this.type,this.genes,this.sick)),.08);
    if(this.label)this.label.position.copy(this.mesh.position).add(new THREE.Vector3(0,1.2*this.size,0));
    }
    if(this.energy<=0||this.health<=0||this.age>(this.type==='prey'?11.5:13.5)){this.dead=true}
  }
  handleDisease(dt,neighbors,fert){
    const refuge=refugeAt(this.pos.x,this.pos.z).bonus, immune=(this.genes.immunity+this.immuneMemory*.45)*(1-refuge*.2);
    const base=settings.diseasePressure*.0022*(1.2-fert)*(pathogen.transmission+.4)*(1+pathogen.immuneEscape*.4)*(1-refuge*.45);
    if(!this.sick&&random()<base*dt*60/Math.max(.35,immune)){this.sick=true;logEvent(`${this.type} ${this.eco} infected by strain v${pathogen.id}`)}
    if(this.sick){this.health-=dt*(1.0+pathogen.virulence*1.4)*settings.diseasePressure/Math.max(.42,this.genes.immunity+this.immuneMemory*.3); this.energy-=dt*(.7+pathogen.virulence); if(random()<dt*.010*(this.genes.immunity+this.immuneMemory*.7)){this.sick=false;this.immuneMemory=clamp(this.immuneMemory+.28,0,1.6);this.health=clamp(this.health+16,0,100)}}
    if(this.sick){for(const n of neighbors){if(!n.dead&&n!==this&&!n.sick&&n.type===this.type&&this.pos.distanceTo(n.pos)<2.2&&random()<dt*.016*settings.diseasePressure*pathogen.transmission/Math.max(.5,n.genes.immunity+n.immuneMemory*.25))n.sick=true}}
  }
  decide(neighbors,dayRatio,si){
    const night=isNight(), hungry=this.energy<(this.type==='prey'?48:72), veryHungry=this.energy<28, risk=habitatRisk(this.pos.x,this.pos.z,getTerrainHeight(this.pos.x,this.pos.z)), fear=fearAt(this.pos.x,this.pos.z), phen=phenologyMatch(this.type,si);
    let nearestPred=null,nearestPrey=null,nearestMate=null,dp=1e9,dq=1e9,dm=1e9;
    for(const n of neighbors){if(n===this||n.dead)continue;const d=this.pos.distanceTo(n.pos); if(n.type==='pred'&&d<dp){dp=d;nearestPred=n} if(n.type==='prey'&&d<dq){dq=d;nearestPrey=n} if(n.type===this.type&&!n.sick&&n.age>(this.type==='prey'?.25:.35)&&n.energy>(this.type==='prey'?72:85)&&time-n.lastBirth>(this.type==='prey'?8:12)&&d<dm&&d<8){dm=d;nearestMate=n}}
    if(this.type==='prey'){
      if(nearestPred&&dp<this.perception*(1.08-this.genes.boldness*.42)){this.state='FLEE';this.target=nearestPred.pos;this.actionIdx=2}
      else if(fear>.45&&this.energy>42){this.state='SHELTER';this.seekRefuge();this.actionIdx=2}
      else if(this.energy>88&&this.age>.25&&time-this.lastBirth>8&&nearestMate&&random()<.004*this.genes.policy[0]*phen){this.state='MATE';this.reproduce(nearestMate);this.actionIdx=0}
      else if((hungry||risk<.3)){this.state='FORAGE';this.findFood();this.actionIdx=1}
      else if((night||risk>.7)&&this.energy>62&&random()>.018){this.state='SHELTER';this.seekRefuge();this.actionIdx=2}
      else {this.state=random()<.24?'EXPLORE':'IDLE';this.target=null;this.actionIdx=3}
    }else{
      if(this.energy>96&&this.age>.35&&time-this.lastBirth>12&&nearestMate&&random()<.0027*phen){this.state='MATE';this.reproduce(nearestMate);this.actionIdx=0}
      else if((hungry||this.genes.boldness>.75)&&nearestPrey&&dq<this.perception){this.state='HUNT';this.target=nearestPrey.pos;this.actionIdx=1;if(dq<1.55*this.size)this.attackPrey(nearestPrey)}
      else if(night&&this.energy>78){this.state='PATROL';this.target=null;this.actionIdx=3}
      else {this.state='FORAGE';this.target=null;this.actionIdx=3}
    }
    if(veryHungry&&(this.state==='SHELTER'||this.state==='SLEEP'))this.state='FORAGE';
  }
  attackPrey(prey){
    if(prey.dead||prey.health<=0)return;
    const defense=settings.defendedPrey?(prey.genes.defense||0):0, success=clamp(.78+this.genes.boldness*.16-defense*.55-prey.genes.speed*.05, .12, .94);
    if(random()<success){const gain=62*(1-defense*.45); this.energy=clamp(this.energy+gain,0,135); if(defense>.55){this.health-=defense*8; this.energy-=defense*8} prey.health=0;prey.dead=true;pheromones.drop(this.pos,0xff516b); depositFear(prey.pos,.9,16); this.reward+=12; prey.reward-=10;}
    else{this.energy-=7+defense*8;prey.energy-=3;prey.reward+=5;depositFear(prey.pos,.45,12);pheromones.drop(this.pos,0xffff80)}
  }
  steerAndMove(dt,neighbors,si,h,fert){
    if(this.state==='SHELTER'&&this.target&&this.pos.distanceTo(this.target)<2.5){this.vel.multiplyScalar(.35);this.energy=clamp(this.energy+dt*(2.7+refugeAt(this.pos.x,this.pos.z).bonus*3),0,112);return}
    let steer=new THREE.Vector3(); const p=this.genes.policy;
    steer.add(this.separate(neighbors).multiplyScalar(1.35*p[2])); steer.add(this.align(neighbors).multiplyScalar((this.type==='prey'?.62:.25)*p[0]));
    if(this.state==='FLEE'&&this.target)steer.add(this.seek(this.target,-1).multiplyScalar(3.2*p[2]));
    else if(this.state==='HUNT'&&this.target)steer.add(this.seek(this.target).multiplyScalar(1.65*(.8+this.genes.boldness)));
    else if((this.state==='FORAGE'||this.state==='SHELTER')&&this.target)steer.add(this.seek(this.target).multiplyScalar(1.15*p[1]));
    else if(this.state==='PATROL')steer.add(this.wander(dt).multiplyScalar(.65));
    else steer.add(this.wander(dt).multiplyScalar((this.state==='EXPLORE'?.9:.42)*p[3]));
    steer.add(this.avoidBadTerrain().multiplyScalar(2)); if(this.type==='prey')steer.add(this.avoidFear().multiplyScalar(1.6)); steer.add(this.avoidFragmentation().multiplyScalar(1.8)); steer.add(this.avoidBoundaries().multiplyScalar(2.5)); steer.clampLength(0,this.maxForce); this.acc.add(steer);
    const tempCost=Math.abs(si.temp-.62)*dynamicClimateStress()/Math.max(.45,this.genes.thermal), sickness=this.sick?1.35:1, risk=habitatRisk(this.pos.x,this.pos.z,h), conn=habitatConnectivity(this.pos.x,this.pos.z);
    this.vel.add(this.acc.multiplyScalar(dt)).clampLength(0,this.maxSpeed*(this.sick?.72:1)*(0.65+conn*.35)); this.pos.add(this.vel.clone().multiplyScalar(dt)); this.acc.set(0,0,0);
    this.pos.x=clamp(this.pos.x,-WORLD_SIZE/2+1,WORLD_SIZE/2-1);this.pos.z=clamp(this.pos.z,-WORLD_SIZE/2+1,WORLD_SIZE/2-1);
    const nh=getTerrainHeight(this.pos.x,this.pos.z); if(nh<-1.1){this.energy-=dt*11;this.vel.multiplyScalar(.52)} this.pos.y=Math.max(nh,-1.45);
    const defenseCost=this.type==='prey'&&settings.defendedPrey?(this.genes.defense||0)*.18:0;
    const fearCost=this.type==='prey'?fearAt(this.pos.x,this.pos.z)*.10:0; const metabolic=(.72+this.size*this.size*.43+defenseCost)*(1+this.vel.length()*.23+tempCost+risk*.22+fearCost)*sickness/Math.max(.58,this.genes.efficiency||1); this.energy-=dt*metabolic;
    if(settings.pheromones&&!experimentRunning&&visualRandom()<dt*(this.type==='prey'?.8:.45))pheromones.drop(this.pos,this.type==='prey'?0x5eff7e:0xff4f66);
  }
  learn(dt){
    const reward=(this.energy-this.lastEnergy)*.06+(this.health-this.lastHealth)*.08+this.reward*.05; this.reward=lerp(this.reward,reward,.22); this.lastEnergy=this.energy; this.lastHealth=this.health;
    if(settings.adaptiveLearning){this.genes.policy[this.actionIdx]=clamp(this.genes.policy[this.actionIdx]+reward*settings.learningRate*.008,.20,2.4); const avg=this.genes.policy.reduce((a,b)=>a+b,0)/this.genes.policy.length; this.genes.policy=this.genes.policy.map(w=>lerp(w,w/avg,.015));}
  }
  findFood(){
    let best=null,bestScore=-1,idx=-1; const memBoost=this.genes.memory;
    for(const j of plantGrid.query(this.pos.x,this.pos.z,this.perception)){const p=vegetation.data[j]; if(!p||!p.active)continue; const d=Math.sqrt(dist2(this.pos.x,this.pos.z,p.x,p.z)); if(d>this.perception*1.55)continue; const score=(p.energy*(.5+p.fertility)*p.nutrient)/(1+d)+refugeAt(p.x,p.z).bonus*2; if(score>bestScore){bestScore=score;best=p;idx=j}}
    for(const m of this.memory){const d=Math.sqrt(dist2(this.pos.x,this.pos.z,m.x,m.z)); const score=12*memBoost/(1+d); if(score>bestScore){bestScore=score;best=m;idx=-1}}
    if(best){this.target=new THREE.Vector3(best.x,best.y??getTerrainHeight(best.x,best.z),best.z);this.targetIdx=idx; const d=this.pos.distanceTo(this.target); if(d<1.15&&idx>=0){const p=vegetation.data[idx]; if(p.active){this.energy=clamp(this.energy+p.energy,0,125);p.active=false;vegetation.active--;hidePlant(idx);this.rememberPatch(p);depositSoil(this.pos,.18,7);this.reward+=3}}} else this.target=null;
  }
  seekRefuge(){let best=null,bestD=1e9; for(const r of refugia){const d=dist2(this.pos.x,this.pos.z,r.x,r.z); if(d<bestD){bestD=d;best=r}} if(best)this.target=new THREE.Vector3(best.x,getTerrainHeight(best.x,best.z),best.z); else this.target=null}
  rememberPatch(p){this.memory.push({x:p.x+rnd(-5,5),z:p.z+rnd(-5,5),y:p.y,ttl:50}); if(this.memory.length>Math.round(4*this.genes.memory))this.memory.shift()}
  reproduce(mate=null){
    if(agents.length>=MAX_AGENTS||mate?.dead)return;
    this.lastBirth=time; this.energy*=.56; if(mate){mate.energy*=.85;mate.lastBirth=time;} const childGenes=mixGenes(this.genes,mate?.genes); if(dynamicClimateStress()>.55){childGenes.thermal=clamp((childGenes.thermal||1)+.03,0,2.2);childGenes.plasticity=clamp((childGenes.plasticity||1)+.02,0,2.2)} const child=spawnAgent(this.type,this.pos.x+rnd(-1.8,1.8),this.pos.z+rnd(-1.8,1.8),childGenes,this); logEvent(`${this.type} ${this.eco} → ${child.eco} generation ${child.generation}`); pheromones.drop(this.pos,0xffff80); this.reward+=8;
  }
  seek(target,w=1){const desired=target.clone().sub(this.pos); desired.y=0; if(desired.lengthSq()===0)return desired; desired.normalize().multiplyScalar(this.maxSpeed); if(w<0)desired.negate(); return desired.sub(this.vel)}
  wander(){return new THREE.Vector3(rnd(-1,1),0,rnd(-1,1)).multiplyScalar(48)}
  separate(neighbors){const sum=new THREE.Vector3();let c=0;for(const n of neighbors){if(n===this||n.dead)continue;const d=this.pos.distanceTo(n.pos);if(d>0&&d<2.25*this.size){sum.add(this.pos.clone().sub(n.pos).normalize().divideScalar(d));c++}} if(c)sum.divideScalar(c).normalize().multiplyScalar(this.maxSpeed);return sum.sub(this.vel)}
  align(neighbors){const sum=new THREE.Vector3();let c=0;for(const n of neighbors){if(!n.dead&&n!==this&&n.type===this.type&&this.pos.distanceTo(n.pos)<6){sum.add(n.vel);c++}} if(c)sum.divideScalar(c).normalize().multiplyScalar(this.maxSpeed);return sum.sub(this.vel)}
  avoidBadTerrain(){const ahead=this.pos.clone().add(this.vel.clone().normalize().multiplyScalar(5)); const h=getTerrainHeight(ahead.x,ahead.z); if(h<-1||h>9.2)return this.pos.clone().sub(ahead).normalize().multiplyScalar(this.maxSpeed); return new THREE.Vector3()}
  avoidFear(){const ahead=this.pos.clone().add(this.vel.clone().normalize().multiplyScalar(5)); const f=fearAt(ahead.x,ahead.z); if(f>.25)return this.pos.clone().sub(ahead).normalize().multiplyScalar(this.maxSpeed*f); return new THREE.Vector3()}
  socialImitate(neighbors){if(!settings.socialLearning||random()>.018)return; let best=null; for(const n of neighbors){if(!n.dead&&n!==this&&n.type===this.type&&n.reward>this.reward+.8&&this.pos.distanceTo(n.pos)<7){best=n;break}} if(best){this.genes.policy=this.genes.policy.map((w,i)=>clamp(lerp(w,best.genes.policy[i],.035),.2,2.4)); this.reward+=.1}}
  avoidFragmentation(){const ahead=this.pos.clone().add(this.vel.clone().normalize().multiplyScalar(4)); const conn=habitatConnectivity(ahead.x,ahead.z); if(conn<.35)return this.pos.clone().sub(ahead).normalize().multiplyScalar(this.maxSpeed*(.5-conn)); return new THREE.Vector3()}
  avoidBoundaries(){const v=new THREE.Vector3(),m=WORLD_SIZE/2-5;if(this.pos.x>m)v.x=-this.maxSpeed;if(this.pos.x<-m)v.x=this.maxSpeed;if(this.pos.z>m)v.z=-this.maxSpeed;if(this.pos.z<-m)v.z=this.maxSpeed;return v}
  dispose(){this.removeLabel();scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose()}
}

class Pheromones{
  constructor(){this.items=[];this.geo=new THREE.BufferGeometry();this.mat=new THREE.PointsMaterial({size:.18,transparent:true,opacity:.55,vertexColors:true,depthWrite:false});this.points=new THREE.Points(this.geo,this.mat);scene.add(this.points)}
  drop(pos,color){if(!settings.pheromones||experimentRunning)return; if(this.items.length>950)this.items.shift();const c=new THREE.Color(color);this.items.push({x:pos.x,y:pos.y+.08,z:pos.z,life:1,c})}
  update(dt){for(const p of this.items)p.life-=dt*.13;this.items=this.items.filter(p=>p.life>0);const pos=[],col=[];for(const p of this.items){pos.push(p.x,p.y,p.z);col.push(p.c.r*p.life,p.c.g*p.life,p.c.b*p.life)}this.geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));this.mat.opacity=settings.pheromones?.5:0}
}
class Fireflies{
  constructor(){const geo=new THREE.BufferGeometry(),pos=[];for(let i=0;i<280;i++)pos.push(visualRnd(-WORLD_SIZE/2,WORLD_SIZE/2),visualRnd(1,7),visualRnd(-WORLD_SIZE/2,WORLD_SIZE/2));geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.mesh=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffff9b,size:.28,transparent:true,opacity:0}));scene.add(this.mesh);this.t=0}
  update(dt,night){this.t+=dt;this.mesh.material.opacity=settings.particles&&night?lerp(this.mesh.material.opacity,.72,dt):lerp(this.mesh.material.opacity,0,dt);const p=this.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){p.setY(i,p.getY(i)+Math.sin(this.t*2+i)*dt*1.08);p.setX(i,p.getX(i)+Math.sin(this.t*.45+i*7)*dt*.36)}p.needsUpdate=true}
}
class WeatherSystem{
  constructor(){const geo=new THREE.BufferGeometry(),pos=[];for(let i=0;i<950;i++)pos.push(visualRnd(-80,80),visualRnd(20,70),visualRnd(-80,80));geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.mesh=new THREE.Points(geo,new THREE.PointsMaterial({color:0x9fdcff,size:.11,transparent:true,opacity:0}));scene.add(this.mesh);this.timer=0;this.kind='Clear'}
  trigger(kind,dur){this.kind=kind;this.timer=dur;stats.weather=kind;notify(kind+' event started');logEvent(kind+' event')}
  update(dt){const active=settings.particles&&(this.kind==='Storm'||this.kind==='Drought'||this.kind==='Heatwave'); this.mesh.material.color.set(this.kind==='Heatwave'?0xffc069:0x9fdcff); this.mesh.material.opacity=active?(this.kind==='Storm'?.55:this.kind==='Heatwave'?.22:.18):0; const p=this.mesh.geometry.attributes.position; if(active){for(let i=0;i<p.count;i++){let y=p.getY(i)-(this.kind==='Storm'?dt*38:dt*5),x=p.getX(i)+(this.kind!=='Storm'?Math.sin(time+i)*dt*3:0); if(y<0){y=visualRnd(35,75);x=visualRnd(-80,80);p.setZ(i,visualRnd(-80,80))}p.setY(i,y);p.setX(i,x)}p.needsUpdate=true} }
}

function simulationStep(){
  const dt=FIXED_DT; simulationTick++; time=simulationTick*dt;
  if(weatherSystem.timer>0){weatherSystem.timer=Math.max(0,weatherSystem.timer-dt);if(weatherSystem.timer===0){weatherSystem.kind='Clear';stats.weather='Clear'}}
  updateEcoFields(dt);
  phenologyCache={prey:mean(agents.filter(a=>a.type==='prey'),a=>a.genes.plasticity)||1,pred:mean(agents.filter(a=>a.type==='pred'),a=>a.genes.plasticity)||1};
  grid.clear(); for(const a of agents)if(!a.dead)grid.insert(a);
  const cohort=agents.slice();
  for(let i=cohort.length-1;i>=0;i--){const a=cohort[i];if(a.dead)continue;a.update(dt,grid.query(a.pos.x,a.pos.z,a.perception).filter(n=>!n.dead),(time%dayDuration)/dayDuration)}
  agents=agents.filter(a=>{if(!a.dead)return true;if(followTarget===a)unfollow();depositSoil(a.pos,.35,8);a.dispose();return false});
  regrowPlants(dt); climateAutoEvents(dt);
  if(simulationTick%60===0){rebuildPlantIndex();sampleHistory()}
}
function sampleHistory(){
  const prey=agents.filter(a=>a.type==='prey'),pred=agents.filter(a=>a.type==='pred'),food=vegetation.active;
  stats.speciesCount=new Set(agents.map(a=>a.eco)).size; stats.diversity=diversityIndex(agents);
  stats.phenologyMismatch=1-(phenologyMatch('prey',seasonInfo())+phenologyMatch('pred',seasonInfo()))/2;
  stats.history.push({day:time/dayDuration,prey:prey.length,pred:pred.length,food:food/20,div:stats.diversity*30,risk:earlyWarningScore()*60,climate:dynamicClimateStress(),phenology:stats.phenologyMismatch,soil:soilPulses.length,fear:fearPulses.length,edna:stats.edna.confidence||0,pathogenId:pathogen.id});
  if(stats.history.length>600)stats.history.shift(); computeEarlyWarnings();
}
function advanceSimulation(seconds){const steps=Math.round(seconds/FIXED_DT);for(let i=0;i<steps;i++)simulationStep()}
function renderFrame(dt){
  updateDayNight(dt);if(water?.material.uniforms)water.material.uniforms.uTime.value=time;
  fireflies.update(paused?0:dt,isNight());weatherSystem.update(paused?0:dt);pheromones.update(paused?0:dt);
  updateCamera(dt);controls.update();renderer.render(scene,camera);
}
function animate(){requestAnimationFrame(animate);const rawDt=Math.min(clock.getDelta(),.1);
  if(experimentRunning)return;
  if(!paused){accumulator+=rawDt*settings.speed;let count=0;while(accumulator+1e-10>=FIXED_DT&&count<30){simulationStep();accumulator=Math.max(0,accumulator-FIXED_DT);count++}}
  uiTick+=rawDt; renderFrame(rawDt);if(uiTick>.2){updateUI(rawDt);uiTick=0}
}
function isNight(){const r=(time%dayDuration)/dayDuration;return Math.sin(r*Math.PI*2)<0}
function updateDayNight(dt){const dayRatio=(time%dayDuration)/dayDuration,theta=dayRatio*Math.PI*2,sunH=Math.sin(theta),orbit=86; sun.position.set(Math.cos(theta)*orbit,Math.max(-12,Math.sin(theta)*orbit),0); lightDir.position.copy(sun.position); const night=sunH<0, dusk=Math.abs(sunH)<.18; const target=new THREE.Color(night?COLORS.night:(dusk?COLORS.dusk:COLORS.day)); scene.background.lerp(target,dt*.8); scene.fog.color.copy(scene.background); lightHemi.intensity=lerp(lightHemi.intensity,night?.12:(dusk?.38:.65),dt); lightDir.intensity=lerp(lightDir.intensity,night?0:(dusk?.45:1),dt);}
function climateAutoEvents(dt){if(!settings.autoEvents)return; extremeEventClock+=dt; const stress=dynamicClimateStress(); if(extremeEventClock>28 && weatherSystem.kind==='Clear' && random()<(.006+stress*.018)*dt){extremeEventClock=0; const r=random(); if(r<stress*.45)triggerHeatwave(); else if(r<.65)weatherSystem.trigger('Drought',rnd(16,28)); else weatherSystem.trigger('Storm',rnd(12,22));}}
function updateCamera(dt){
  if(settings.cameraMode==='follow'&&followTarget){const off=new THREE.Vector3(0,14,16);controls.target.lerp(followTarget.pos,.12);camera.position.lerp(followTarget.pos.clone().add(off),.06)}
  if(settings.cameraMode==='cinematic'){cinematicAngle+=dt*.07; const r=78; camera.position.lerp(new THREE.Vector3(Math.cos(cinematicAngle)*r,42,Math.sin(cinematicAngle)*r),.012); controls.target.lerp(new THREE.Vector3(0,0,0),.02)}
}
function onResize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
function onPointerDown(e){mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(agents.map(a=>a.mesh),false)[0]; if(hit?.object?.userData?.agent){followTarget=hit.object.userData.agent;selectedId=followTarget.id;document.getElementById('selectionPanel').style.display='block';settings.cameraMode=document.getElementById('cameraMode').value==='orbit'?'follow':settings.cameraMode;document.getElementById('cameraMode').value=settings.cameraMode;notify('Following '+followTarget.type+' '+followTarget.eco)}}
function unfollow(){followTarget=null;selectedId=null;document.getElementById('selectionPanel').style.display='none'; if(settings.cameraMode==='follow'){settings.cameraMode='orbit';document.getElementById('cameraMode').value='orbit'}}

function updateUI(rawDt){
  const fps=rawDt>0?1/rawDt:lastFps; lastFps=lerp(lastFps,fps,.25); const prey=agents.filter(a=>a.type==='prey'),pred=agents.filter(a=>a.type==='pred'),sick=agents.filter(a=>a.sick).length,food=vegetation.data.filter(p=>p.active).length; 
  const s=seasonInfo();  document.getElementById('fps').textContent=Math.round(lastFps); document.getElementById('cntPrey').textContent=prey.length; document.getElementById('cntPred').textContent=pred.length; document.getElementById('cntFood').textContent=food; document.getElementById('cntSick').textContent=sick; document.getElementById('seasonLabel').textContent=s.name; document.getElementById('weatherLabel').textContent=stats.weather; document.getElementById('climateLabel').textContent=(dynamicClimateStress()-settings.climateStress>=0?'+':'')+(dynamicClimateStress()-settings.climateStress).toFixed(2);
  document.getElementById('phenologyLabel').textContent=Math.round(stats.phenologyMismatch*100)+'%'; document.getElementById('fieldLabel').textContent=soilPulses.length+' / '+fearPulses.length; document.getElementById('ednaLabel').textContent=stats.edna.sampled?Math.round(stats.edna.confidence*100)+'%':'--';
  const dayN=Math.floor(time/dayDuration),hour=String(Math.floor(((time%dayDuration)/dayDuration)*24)).padStart(2,'0'); document.getElementById('timeLabel').textContent=`Day ${dayN} - ${hour}:00`;
  document.getElementById('valSpeed').textContent=settings.speed.toFixed(1)+'x'; document.getElementById('valChaos').textContent=settings.chaos.toFixed(1); document.getElementById('valClimate').textContent=settings.climateStress.toFixed(2); document.getElementById('valTrend').textContent=settings.climateTrend.toFixed(2); document.getElementById('valMutation').textContent=settings.mutation.toFixed(3); document.getElementById('valDisease').textContent=settings.diseasePressure.toFixed(2); document.getElementById('valFragment').textContent=settings.fragmentation.toFixed(2); document.getElementById('valLearning').textContent=settings.learningRate.toFixed(2); document.getElementById('valPhenology').textContent=settings.phenologyDrift.toFixed(2); document.getElementById('valSensorNoise').textContent=settings.sensorNoise.toFixed(2); document.getElementById('valHorizon').textContent=settings.forecastHorizon+'s';

  document.getElementById('cntSpecies').textContent=new Set(agents.map(a=>a.eco)).size;document.getElementById('ewsLabel').textContent=stats.ews;updateRunStatus();
  drawGraph(); drawMinimap(); updateInspector(); updateResearch(prey,pred); updateSentinelPanel(); updateForecastPanel();
}
function diversityIndex(list){if(!list.length)return 0; const counts={}; for(const a of list)counts[a.eco]=(counts[a.eco]||0)+1; let sum=0; for(const k in counts){const p=counts[k]/list.length;sum-=p*Math.log(p)} return sum/Math.log(Math.max(2,Object.keys(counts).length+1))}
function autocorr1(arr){if(arr.length<4)return 0; const m=mean(arr,x=>x), num=arr.slice(1).reduce((s,v,i)=>s+(arr[i]-m)*(v-m),0), den=arr.reduce((s,v)=>s+(v-m)*(v-m),0); return den?num/den:0}
function variance(arr){if(arr.length<2)return 0; const m=mean(arr,x=>x); return arr.reduce((s,v)=>s+(v-m)*(v-m),0)/(arr.length-1)}
function computeEarlyWarnings(){const recent=stats.history.slice(-54).map(p=>p.prey+p.pred*.8+p.food*.12), ac=autocorr1(recent), va=variance(recent)/400; stats.ac1=ac; stats.variance=va; const score=earlyWarningScore(); stats.ews=recent.length<10?'Warming up':score>.68?'High':score>.42?'Watch':'Stable'; const el=document.getElementById('ewsLabel'); el.textContent=stats.ews; el.style.color=stats.ews==='High'?'var(--bad)':stats.ews==='Watch'?'var(--warn)':'var(--ok)'}
function earlyWarningScore(){const recent=stats.history.slice(-54).map(p=>p.prey+p.pred*.8+p.food*.12); if(recent.length<10)return 0; const ac=clamp((autocorr1(recent)+.2)/1.2,0,1), va=clamp(variance(recent)/900,0,1), low=agents.filter(a=>a.type==='prey').length<14?.3:0, stress=dynamicClimateStress()*.18; return clamp(ac*.42+va*.28+low+stress,0,1)}
function updateResearch(prey,pred){document.getElementById('divIndex').textContent=stats.diversity.toFixed(2); document.getElementById('meanPreySpeed').textContent=mean(prey,a=>a.genes.speed).toFixed(2); document.getElementById('meanPreyDefense').textContent=mean(prey,a=>a.genes.defense||0).toFixed(2); document.getElementById('meanPredSense').textContent=mean(pred,a=>a.genes.sense).toFixed(2); document.getElementById('meanThermal').textContent=mean(agents,a=>a.genes.thermal||1).toFixed(2)+' / '+mean(agents,a=>a.genes.plasticity||1).toFixed(2); document.getElementById('fieldStats').textContent=fearPulses.length+' / '+soilPulses.length; document.getElementById('resilienceStats').textContent=stats.ac1.toFixed(2)+' / '+stats.variance.toFixed(2); const risk=prey.length<8||pred.length<1||stats.ews==='High'?'High':(prey.length<18||pred.length>prey.length*.45||stats.ews==='Watch'?'Medium':'Low'); document.getElementById('riskLabel').textContent=risk; document.getElementById('riskLabel').style.color=risk==='High'?'var(--bad)':risk==='Medium'?'var(--warn)':'var(--ok)'; document.getElementById('pathogenLabel').textContent=`v${pathogen.id} μ${pathogen.virulence.toFixed(2)} τ${pathogen.transmission.toFixed(2)}`; document.getElementById('lineageList').textContent=stats.events.join('\n')||'No events yet.'; drawTraitGraph(prey,pred)}
function mean(arr,fn){return arr.length?arr.reduce((s,a)=>s+fn(a),0)/arr.length:0}
function updateInspector(){if(!followTarget)return; const a=followTarget; if(a.dead){unfollow();return} document.getElementById('selType').textContent=a.type.toUpperCase(); document.getElementById('selType').className=a.type==='prey'?'c-prey':'c-pred'; document.getElementById('selId').textContent='#'+a.id; document.getElementById('selState').textContent=a.state+(a.sick?' / SICK':''); document.getElementById('selEnergy').style.width=clamp(a.energy,0,100)+'%'; document.getElementById('selHealth').style.width=clamp(a.health,0,100)+'%'; document.getElementById('selHealth').style.background=a.sick?'linear-gradient(90deg,#9c6cff,#ff80df)':'linear-gradient(90deg,var(--ok),#d6ff6d)'; document.getElementById('selAge').textContent=a.age.toFixed(1)+'d / '+a.generation; document.getElementById('selEco').textContent=a.eco; document.getElementById('selReward').textContent=a.reward.toFixed(2); document.getElementById('geneSize').textContent=a.genes.size.toFixed(2); document.getElementById('geneSpeed').textContent=a.genes.speed.toFixed(2); document.getElementById('geneSense').textContent=a.genes.sense.toFixed(2); document.getElementById('geneImmune').textContent=a.genes.immunity.toFixed(2); document.getElementById('geneThermal').textContent=(a.genes.thermal||1).toFixed(2); document.getElementById('geneDefense').textContent=(a.genes.defense||0).toFixed(2); document.getElementById('genePlasticity').textContent=(a.genes.plasticity||1).toFixed(2); document.getElementById('genePolicy').textContent=policyName(a.genes); drawPolicyCanvas(a)}
function drawGraph(){const ctx=document.getElementById('graph').getContext('2d'),w=252,h=76;ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,w,h);drawLine(ctx,stats.history.map(p=>p.prey),w,h,'#6dff7d',125);drawLine(ctx,stats.history.map(p=>p.pred),w,h,'#ff5e72',85);drawLine(ctx,stats.history.map(p=>p.food),w,h,'#ffc04d',165);drawLine(ctx,stats.history.map(p=>p.div),w,h,'#e0fb7a',60);drawLine(ctx,stats.history.map(p=>p.risk),w,h,'#ff9a9a',80)}
function drawLine(ctx,arr,w,h,col,max){ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=1.7;arr.forEach((v,i)=>{const x=i/Math.max(1,arr.length-1)*w,y=h-clamp(v/max,0,1)*h;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.stroke()}
function drawTraitGraph(prey,pred){const ctx=document.getElementById('traitGraph').getContext('2d'),w=304,h=78;ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,.23)';ctx.fillRect(0,0,w,h);const traits=[['speed',mean(prey,a=>a.genes.speed),mean(pred,a=>a.genes.speed),'#6dff7d'],['sense',mean(prey,a=>a.genes.sense),mean(pred,a=>a.genes.sense),'#7fd8ff'],['immune',mean(prey,a=>a.genes.immunity),mean(pred,a=>a.genes.immunity),'#d4a3ff'],['def',mean(prey,a=>a.genes.defense||0),0,'#e0fb7a']];ctx.font='10px Segoe UI';traits.forEach((t,i)=>{const x=14+i*72;ctx.fillStyle='rgba(255,255,255,.11)';ctx.fillRect(x,10,22,h-24);ctx.fillStyle=t[3];ctx.fillRect(x,h-14-clamp(t[1]/1.6,0,1)*(h-28),9,clamp(t[1]/1.6,0,1)*(h-28));ctx.fillStyle='#ff5e72';ctx.fillRect(x+11,h-14-clamp(t[2]/1.6,0,1)*(h-28),9,clamp(t[2]/1.6,0,1)*(h-28));ctx.fillStyle='#cbd5e1';ctx.fillText(t[0],x-4,h-2)})}
function drawPolicyCanvas(a){const ctx=document.getElementById('policyCanvas').getContext('2d'),w=266,h=42,labels=['soc','food','evade','explore'];ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,w,h);a.genes.policy.forEach((v,i)=>{const bw=52,x=8+i*64,bar=clamp(v/2.4,0,1)*(h-18);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(x,6,bw,h-17);ctx.fillStyle=i===a.actionIdx?'#00d2ff':'#8cff7a';ctx.fillRect(x,h-11-bar,bw,bar);ctx.fillStyle='#cbd5e1';ctx.font='10px Segoe UI';ctx.fillText(labels[i],x+9,h-2)})}
function drawMinimap(){const can=document.getElementById('miniCanvas'),ctx=can.getContext('2d'),w=224,half=WORLD_SIZE/2;ctx.clearRect(0,0,w,w); if(envData.mini)ctx.drawImage(envData.mini,0,0,w,w); if(settings.riskMap){const cell=8;ctx.globalAlpha=.28;for(let y=0;y<w;y+=cell)for(let x=0;x<w;x+=cell){const wx=x/w*WORLD_SIZE-half,wz=y/w*WORLD_SIZE-half,r=habitatRisk(wx,wz,getTerrainHeight(wx,wz)); if(r>.55){ctx.fillStyle=`rgba(255,60,80,${r})`;ctx.fillRect(x,y,cell,cell)}}ctx.globalAlpha=1} ctx.globalAlpha=.65;ctx.fillStyle='#45c75e';for(let i=0;i<vegetation.data.length;i+=2){const p=vegetation.data[i];if(p.active){ctx.fillRect((p.x+half)/WORLD_SIZE*w,(p.z+half)/WORLD_SIZE*w,1,1)}}ctx.globalAlpha=1; for(const r of refugia){ctx.strokeStyle='#56f0b2';ctx.lineWidth=1;ctx.beginPath();ctx.arc((r.x+half)/WORLD_SIZE*w,(r.z+half)/WORLD_SIZE*w,r.radius/WORLD_SIZE*w,0,Math.PI*2);ctx.stroke()} if(settings.fearLandscape){ctx.globalAlpha=.28;ctx.fillStyle='#ff8b3d';for(const f of fearPulses.slice(-120)){ctx.beginPath();ctx.arc((f.x+half)/WORLD_SIZE*w,(f.z+half)/WORLD_SIZE*w,Math.max(2,f.radius/WORLD_SIZE*w*f.life),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1} if(settings.nicheConstruction){ctx.globalAlpha=.22;ctx.fillStyle='#b9f05a';for(const p of soilPulses.slice(-120)){ctx.beginPath();ctx.arc((p.x+half)/WORLD_SIZE*w,(p.z+half)/WORLD_SIZE*w,Math.max(2,p.radius/WORLD_SIZE*w*p.life),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1} if(settings.ednaSensors){for(const se of sensors){ctx.strokeStyle='#7dd3fc';ctx.lineWidth=1;ctx.beginPath();ctx.arc((se.x+half)/WORLD_SIZE*w,(se.z+half)/WORLD_SIZE*w,se.radius/WORLD_SIZE*w,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e0f2fe';ctx.fillRect((se.x+half)/WORLD_SIZE*w-2,(se.z+half)/WORLD_SIZE*w-2,4,4)}} for(const a of agents){const x=(a.pos.x+half)/WORLD_SIZE*w,z=(a.pos.z+half)/WORLD_SIZE*w;ctx.fillStyle=a.sick?'#d4a3ff':(a.type==='prey'?'#77ff77':'#ff5468');ctx.fillRect(x-1,z-1,3,3)} if(followTarget){const x=(followTarget.pos.x+half)/WORLD_SIZE*w,z=(followTarget.pos.z+half)/WORLD_SIZE*w;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x-6,z-6,12,12)}}

function assistedGeneFlow(){
  const base={size:1,speed:1.04,sense:1.02,immunity:1.18,thermal:1.34,efficiency:1.12,plasticity:1.28,defense:.28,boldness:.45,memory:1.16,policy:[1.05,1.18,1.12,1.0]};
  for(let i=0;i<10;i++)spawnAgent('prey',rnd(-16,16),rnd(-16,16),mutateGenes(base));
  logEvent('assisted gene flow introduced thermal/plastic founders'); notify('Assisted gene flow: climate-ready founders added');
}
function novelPredatorPulse(){
  for(let i=0;i<2;i++){const g=randomGenes('pred');g.sense*=1.28;g.boldness=clamp(g.boldness+.18,0,1);g.policy[1]+=0.35;spawnAgent('pred',rnd(-40,40),rnd(-40,40),g)}
  for(const p of fearPulses)p.strength*=1.15;
  logEvent('novel predator pulse changed trophic pressure'); notify('Novel predator pressure introduced');
}
function triggerHeatwave(){weatherSystem.trigger('Heatwave',rnd(14,25)); for(const a of agents){const therm=a.genes.thermal||1; a.energy-=rnd(2,8)/therm} logEvent('heatwave mortality risk increased')}
function patchFire(){const x=rnd(-45,45),z=rnd(-45,45),r=rnd(10,18); let burned=0; vegetation.data.forEach((p,i)=>{if(p.active&&dist2(p.x,p.z,x,z)<r*r){p.active=false;vegetation.active--;hidePlant(i);burned++}}); agents.forEach(a=>{if(dist2(a.pos.x,a.pos.z,x,z)<r*r){a.energy-=rnd(12,25);a.health-=rnd(3,12);a.vel.add(new THREE.Vector3(a.pos.x-x,0,a.pos.z-z).normalize().multiplyScalar(4))}}); logEvent(`patch fire burned ${burned} plants`); notify('Patch fire disturbance')}
function addRefuge(){const r={x:rnd(-45,45),z:rnd(-45,45),radius:rnd(10,16),quality:rnd(.65,1)}; r.y=getTerrainHeight(r.x,r.z); refugia.push(r); refreshHabitat(); logEvent('habitat refuge seeded'); notify('Refuge seeded: local fertility and disease buffering improved')}
function restoreCorridor(){const c={x1:rnd(-65,-20),z1:rnd(-55,55),x2:rnd(20,65),z2:rnd(-55,55),width:rnd(5,9),quality:rnd(.65,1)}; restoredCorridors.push(c); refreshHabitat(); logEvent('connectivity corridor restored'); notify('Corridor restored: movement friction reduced')}
function mutatePathogen(){pathogen.id++; pathogen.virulence=clamp(pathogen.virulence+rnd(-.08,.16),.15,1.2); pathogen.transmission=clamp(pathogen.transmission+rnd(-.08,.14),.1,1.2); pathogen.immuneEscape=clamp(pathogen.immuneEscape+rnd(-.06,.12),.05,1.1); shuffleSample(agents,Math.max(1,Math.floor(agents.length*.08))).forEach(a=>a.sick=true); notify('Pathogen pulse released: strain v'+pathogen.id);logEvent('pathogen pulse strain v'+pathogen.id)}
function applyPreset(name){
  const preset={balanced:{climateStress:.35,climateTrend:.10,diseasePressure:.20,fragmentation:.20,mutation:.05},climate:{climateStress:.55,climateTrend:.42,diseasePressure:.25,fragmentation:.30,mutation:.07},disease:{climateStress:.35,climateTrend:.05,diseasePressure:.58,fragmentation:.18,mutation:.09},fragmented:{climateStress:.42,climateTrend:.16,diseasePressure:.25,fragmentation:.72,mutation:.06},rewilding:{climateStress:.35,climateTrend:.00,diseasePressure:.18,fragmentation:.45,mutation:.05}}[name];
  Object.assign(settings,preset); syncUI(); if(name==='rewilding'){refugia=[];restoredCorridors=[];for(let i=0;i<3;i++)refugia.push({x:rnd(-45,45),z:rnd(-45,45),radius:rnd(11,17),quality:rnd(.75,1)});restoreCorridor();} else refreshHabitat(); notify('Preset loaded: '+name); updateODDNotes();
}

function setupUI(){
  const by=id=>document.getElementById(id); by('simSpeed').oninput=e=>settings.speed=parseFloat(e.target.value); by('terrChaos').onchange=e=>{settings.chaos=parseFloat(e.target.value);restartRun(runSeed)}; by('climateStress').oninput=e=>settings.climateStress=parseFloat(e.target.value); by('climateTrend').oninput=e=>settings.climateTrend=parseFloat(e.target.value); by('mutationRate').oninput=e=>settings.mutation=parseFloat(e.target.value); by('diseasePressure').oninput=e=>settings.diseasePressure=parseFloat(e.target.value); by('fragmentation').oninput=e=>{settings.fragmentation=parseFloat(e.target.value);refreshHabitat()}; by('learningRate').oninput=e=>settings.learningRate=parseFloat(e.target.value); by('phenologyDrift').oninput=e=>settings.phenologyDrift=parseFloat(e.target.value); by('sensorNoise').oninput=e=>settings.sensorNoise=parseFloat(e.target.value); by('forecastHorizon').oninput=e=>settings.forecastHorizon=parseInt(e.target.value,10);
  by('presetSelect').onchange=e=>applyPreset(e.target.value);
  by('btnAddPrey').onclick=()=>{for(let i=0;i<6;i++)spawnAgent('prey',rnd(-8,8),rnd(-8,8));notify('Added prey')}; by('btnAddPred').onclick=()=>{for(let i=0;i<2;i++)spawnAgent('pred',rnd(-8,8),rnd(-8,8));notify('Added predators')}; by('btnRegen').onclick=()=>restartRun(runSeed+'-new');
  by('btnStorm').onclick=()=>{weatherSystem.trigger('Storm',18); for(const a of agents)a.energy-=rnd(3,10)}; by('btnDrought').onclick=()=>{weatherSystem.trigger('Drought',24); for(const p of vegetation.data)if(p.active&&random()<.08){p.active=false;vegetation.active--;hidePlant(vegetation.data.indexOf(p))}}; by('btnHeatwave').onclick=triggerHeatwave; by('btnFire').onclick=patchFire; by('btnDisease').onclick=mutatePathogen; by('btnRefuge').onclick=addRefuge; by('btnCorridor').onclick=restoreCorridor; by('btnGeneFlow').onclick=assistedGeneFlow; by('btnSensorSweep').onclick=ednaSweep; by('btnForecastRun').onclick=runMicroForecast; by('btnNovelPred').onclick=novelPredatorPulse;
  by('btnPause').onclick=()=>setPaused(!paused); by('btnUnfollow').onclick=unfollow; by('btnResearch').onclick=()=>{const p=by('researchPanel');p.style.display=getComputedStyle(p).display==='none'?'block':'none'}; by('btnScenario').onclick=()=>{const p=by('scenarioPanel');p.style.display=getComputedStyle(p).display==='none'?'block':'none';updateODDNotes()}; by('btnSentinel').onclick=()=>{const p=by('sentinelPanel');p.style.display=getComputedStyle(p).display==='none'?'block':'none';updateSentinelPanel()}; by('btnForecast').onclick=()=>{const p=by('forecastPanel');p.style.display=getComputedStyle(p).display==='none'?'block':'none';updateForecastPanel()};
  by('btnSave').onclick=saveState; by('btnLoad').onclick=loadState; by('btnExport').onclick=exportCSV; by('btnExportJSON').onclick=exportJSON;
  by('chkPheromones').onchange=e=>settings.pheromones=e.target.checked; by('chkShadows').onchange=e=>renderer.shadowMap.enabled=settings.shadows=e.target.checked; by('chkParticles').onchange=e=>settings.particles=e.target.checked; by('chkHeatmap').onchange=e=>{settings.heatmap=e.target.checked;if(heatmapMesh)heatmapMesh.visible=settings.heatmap}; by('chkRiskMap').onchange=e=>settings.riskMap=e.target.checked; by('chkLineage').onchange=e=>settings.lineage=e.target.checked; by('chkQuality').onchange=e=>{settings.quality=e.target.checked;renderer.setPixelRatio(settings.quality?Math.min(devicePixelRatio,2):1)}; by('cameraMode').onchange=e=>settings.cameraMode=e.target.value;
  by('chkLearning').onchange=e=>settings.adaptiveLearning=e.target.checked; by('chkCarrying').onchange=e=>settings.carryingCapacity=e.target.checked; by('chkDefense').onchange=e=>settings.defendedPrey=e.target.checked; by('chkAutoEvents').onchange=e=>settings.autoEvents=e.target.checked; by('chkFear').onchange=e=>settings.fearLandscape=e.target.checked; by('chkNiche').onchange=e=>settings.nicheConstruction=e.target.checked; by('chkSocial').onchange=e=>settings.socialLearning=e.target.checked; by('chkSensors').onchange=e=>settings.ednaSensors=e.target.checked;
}
function syncUI(){const by=id=>document.getElementById(id);by('runSeed').value=runSeed;by('chkShadows').checked=settings.shadows;by('chkQuality').checked=settings.quality;renderer.shadowMap.enabled=settings.shadows;renderer.setPixelRatio(settings.quality?Math.min(devicePixelRatio,2):1); by('simSpeed').value=settings.speed; by('terrChaos').value=settings.chaos; by('climateStress').value=settings.climateStress; by('climateTrend').value=settings.climateTrend; by('mutationRate').value=settings.mutation; by('diseasePressure').value=settings.diseasePressure; by('fragmentation').value=settings.fragmentation; by('learningRate').value=settings.learningRate; by('phenologyDrift').value=settings.phenologyDrift; by('sensorNoise').value=settings.sensorNoise; by('forecastHorizon').value=settings.forecastHorizon; by('chkPheromones').checked=settings.pheromones; by('chkParticles').checked=settings.particles; by('chkHeatmap').checked=settings.heatmap; by('chkRiskMap').checked=settings.riskMap; by('chkLineage').checked=settings.lineage; by('cameraMode').value=settings.cameraMode; by('chkLearning').checked=settings.adaptiveLearning; by('chkCarrying').checked=settings.carryingCapacity; by('chkDefense').checked=settings.defendedPrey; by('chkAutoEvents').checked=settings.autoEvents; by('chkFear').checked=settings.fearLandscape; by('chkNiche').checked=settings.nicheConstruction; by('chkSocial').checked=settings.socialLearning; by('chkSensors').checked=settings.ednaSensors}
function exportCSV(){let csv='day,prey,predators,plants,diversity,early_warning,climate_stress,pathogen_id\n'; stats.history.forEach(p=>csv+=`${p.day.toFixed(2)},${p.prey},${p.pred},${Math.round(p.food*20)},${(p.div/30).toFixed(3)},${(p.risk/60).toFixed(3)},${p.climate.toFixed(3)},${p.pathogenId}\n`); downloadBlob(csv,'evosim6-history.csv','text/csv');notify('CSV exported')}
function downloadBlob(data,name,type){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function updateODDNotes(){document.getElementById('oddNotes').innerHTML=`
  <strong>Purpose:</strong> explore qualitative eco-evolutionary responses to climate, fragmentation, disease and management interventions.<br><br>
  <strong>Entities:</strong> prey, predators, vegetation patches, terrain cells, pathogen strain, refugia and corridors.<br><br>
  <strong>State variables:</strong> energy, health, age, position, memory, sickness, immune memory, generation, eco-type and genes for size, speed, sense, immunity, thermal tolerance, efficiency, defense and behaviour policy.<br><br>
  <strong>Processes:</strong> movement, foraging, predation, reproduction, mutation, disease transmission/recovery, plant regrowth, extreme events, climate trend and habitat connectivity.<br><br>
  <strong>Learning:</strong> agents nudge inherited policy weights using recent energy/health reward; optional social imitation copies successful nearby policies, and learned weights can be inherited with mutation.<br><br>
  <strong>Research-inspired modules:</strong> noisy eDNA sentinels, paired short-horizon scenario experiments, phenology mismatch, niche-construction soil memory, non-consumptive predator fear landscapes and assisted gene-flow interventions.<br><br>
  <strong>Outputs:</strong> populations, trait means, diversity, AC1/variance warning, pathogen strain, empirical sentinel coverage, paired scenario endpoints, lineage events, CSV and JSON snapshots.`}



function shuffleSample(list,count){const copy=list.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,count)}
function refreshHabitat(){if(experimentRunning)return;if(heatmapMesh){scene.remove(heatmapMesh);heatmapMesh.geometry.dispose();heatmapMesh.material.dispose()}buildHeatmap();makeMiniTerrainCache();drawRefugia()}
