let scene,camera,renderer,controls;
let cabinetMeshes={};
let raycaster,mouse;
const SCALE=0.001;
let isDragging=false,dragStartMouse={x:0,y:0};
let dragState={active:false,cabinetId:null};
let dragOffset=new THREE.Vector3();
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

// Lights refs
let ambientLight, dirLight, fillLight;
let turntableActive=false, turntableRAF=null;
let shadowCatcher;

// Custom textures per material key
const customTextures={};

const texLoader=new THREE.TextureLoader();
const texCache={};
const MAT_COLORS={white:'#F5F5F0',anthracite:'#3A3A3A',oak:'#B8860B',walnut:'#5C4033',grey:'#8A8A8A',cream:'#F0E8D0',navy:'#1B2A4A',sage:'#7C9A7E',terracotta:'#C4704F',concrete:'#A0A0A0'};
const TEX_URLS={
  oak:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/hardwood2_diffuse.jpg',
  walnut:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/hardwood2_diffuse.jpg',
  floor:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
  wall:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/brick_diffuse.jpg'
};

function loadTex(url,rx,ry){
  const k=url+rx+ry;
  if(texCache[k]) return texCache[k];
  const t=texLoader.load(url);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(rx||2,ry||2);
  texCache[k]=t;
  return t;
}

function makeMaterial(matKey,glossy){
  // Egyedi feltoltott textura prioritas
  if(customTextures[matKey]){
    const t=customTextures[matKey];
    return new THREE.MeshStandardMaterial({map:t,roughness:glossy?0.2:0.7,metalness:0.0});
  }
  const url=TEX_URLS[matKey];
  const color=MAT_COLORS[matKey]||'#F5F5F0';
  const tex=url?loadTex(url,3,3):null;
  if(tex){
    if(['oak','walnut','terracotta'].includes(matKey))
      return new THREE.MeshStandardMaterial({map:tex,color:new THREE.Color(color),roughness:0.6,metalness:0.0});
    return new THREE.MeshStandardMaterial({map:tex,roughness:0.65,metalness:0.0});
  }
  return new THREE.MeshStandardMaterial({color:new THREE.Color(color),roughness:glossy?0.15:0.75,metalness:glossy?0.05:0.0});
}

function init3D(){
  const container=document.getElementById('viewport3d');
  const W=container.clientWidth||800,H=container.clientHeight||600;

  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a1a2e);
  scene.fog=new THREE.Fog(0x1a1a2e,18,35);

  camera=new THREE.PerspectiveCamera(45,W/H,0.1,100);
  camera.position.set(3,2.5,5);
  camera.lookAt(2,1,0);

  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(W,H);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.physicallyCorrectLights=true;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  renderer.outputEncoding=THREE.sRGBEncoding||3001;
  document.getElementById('viewport3d').appendChild(renderer.domElement);

  // --- Vilagitas ---
  ambientLight=new THREE.AmbientLight(0xfff8f0,0.6);
  scene.add(ambientLight);

  dirLight=new THREE.DirectionalLight(0xfff5e0,2.0);
  dirLight.position.set(6,10,6);
  dirLight.castShadow=true;
  dirLight.shadow.mapSize.set(2048,2048);
  dirLight.shadow.camera.near=0.5;
  dirLight.shadow.camera.far=40;
  dirLight.shadow.camera.left=-8;
  dirLight.shadow.camera.right=8;
  dirLight.shadow.camera.top=8;
  dirLight.shadow.camera.bottom=-8;
  dirLight.shadow.bias=-0.001;
  dirLight.shadow.radius=3;
  scene.add(dirLight);

  fillLight=new THREE.DirectionalLight(0x8899ff,0.4);
  fillLight.position.set(-4,4,-3);
  scene.add(fillLight);

  const rimLight=new THREE.DirectionalLight(0xffffff,0.25);
  rimLight.position.set(0,3,-6);
  scene.add(rimLight);

  // --- Padlo ---
  const floorTex=loadTex(TEX_URLS.floor,10,10);
  const floorMat=new THREE.MeshStandardMaterial({map:floorTex,roughness:0.4,metalness:0.05});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(25,25),floorMat);
  floor.rotation.x=-Math.PI/2;
  floor.receiveShadow=true;
  scene.add(floor);

  // Grid
  const grid=new THREE.GridHelper(25,50,0x000000,0x000000);
  grid.material.opacity=0.12;
  grid.material.transparent=true;
  grid.position.y=0.001;
  scene.add(grid);

  // --- Shadow catcher (kontakt arnyek) ---
  const shadowMat=new THREE.ShadowMaterial({opacity:0.28});
  shadowCatcher=new THREE.Mesh(new THREE.PlaneGeometry(25,25),shadowMat);
  shadowCatcher.rotation.x=-Math.PI/2;
  shadowCatcher.position.y=0.002;
  shadowCatcher.receiveShadow=true;
  scene.add(shadowCatcher);

  // --- Szoba hatter ---
  buildRoomBox();

  // Munkalap csoport
  const wtGrp=new THREE.Group(); wtGrp.name='worktops'; scene.add(wtGrp);

  controls=new THREE.OrbitControls(camera,renderer.domElement);
  raycaster=new THREE.Raycaster();
  mouse=new THREE.Vector2();

  renderer.domElement.addEventListener('mousedown',onMouseDown);
  renderer.domElement.addEventListener('mousemove',onMouseMove);
  renderer.domElement.addEventListener('mouseup',onMouseUp);
  renderer.domElement.addEventListener('click',onSceneClick);
  window.addEventListener('keydown',onKeyDown);
  window.addEventListener('resize',()=>{
    const c=document.getElementById('viewport3d');
    camera.aspect=c.clientWidth/c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth,c.clientHeight);
  });

  animate3D();
}

function animate3D(){
  requestAnimationFrame(animate3D);
  renderer.render(scene,camera);
}

function buildRoomBox(){
  const old=scene.getObjectByName('room_box'); if(old) scene.remove(old);
  const wallTex=loadTex(TEX_URLS.wall,5,3);
  const wallMat=new THREE.MeshStandardMaterial({map:wallTex,side:THREE.BackSide,roughness:0.9,metalness:0.0});
  const roomBox=new THREE.Mesh(new THREE.BoxGeometry(18,7,18),wallMat);
  roomBox.position.set(2,3.5,1);
  roomBox.name='room_box';
  scene.add(roomBox);
}

function drawRoomWalls(room,walls){
  const old=scene.getObjectByName('room_walls'); if(old) scene.remove(old);
  const g=new THREE.Group(); g.name='room_walls';
  const wallTex=loadTex(TEX_URLS.wall,4,3);
  const mat=new THREE.MeshStandardMaterial({map:wallTex,side:THREE.DoubleSide,roughness:0.9});
  const H=(room.h||2700)*SCALE;
  walls.forEach(w=>{
    const x1=w.x1*SCALE,z1=w.z1*SCALE,x2=w.x2*SCALE,z2=w.z2*SCALE;
    const len=Math.sqrt((x2-x1)**2+(z2-z1)**2);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(len,H,0.07),mat.clone());
    mesh.position.set((x1+x2)/2,H/2,(z1+z2)/2);
    mesh.rotation.y=-Math.atan2(z2-z1,x2-x1);
    mesh.receiveShadow=true; mesh.castShadow=true;
    g.add(mesh);
  });
  scene.add(g);
}

function createCabinetMesh(cab){
  const group=new THREE.Group(); group.userData={cabinetId:cab.id};
  const W=cab.w*SCALE,H=cab.h*SCALE,D=cab.d*SCALE,T=0.018;
  const cMat=makeMaterial(cab.corpus_material,false);
  const fMat=makeMaterial(cab.front_material,true);

  function panel(w,h,d,px,py,pz,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat.clone());
    m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true;
    group.add(m); return m;
  }
  panel(T,H,D,-(W/2-T/2),H/2,0,cMat);
  panel(T,H,D,(W/2-T/2),H/2,0,cMat);
  panel(W-2*T,T,D,0,H-T/2,0,cMat);
  panel(W-2*T,T,D,0,T/2,0,cMat);
  panel(W-2*T,H-2*T,0.008,0,H/2,-(D/2-0.004),cMat);

  const shelves=cab.shelves||0;
  if(shelves>0){
    const step=(H-2*T)/(shelves+1);
    for(let i=1;i<=shelves;i++) panel(W-2*T-0.004,T,D-0.02,0,T+step*i,0.01,cMat);
  }

  // Ajto
  const doorPivot=new THREE.Group();
  doorPivot.position.set(-(W/2-T),0,0);
  const doorMesh=new THREE.Mesh(new THREE.BoxGeometry(W-2*T,H-2*T,0.019),fMat.clone());
  doorMesh.position.set((W-2*T)/2,H/2,D/2+0.0095);
  doorMesh.castShadow=true;
  doorPivot.add(doorMesh);
  // Fogank
  const hMat=new THREE.MeshStandardMaterial({color:0xcccccc,roughness:0.1,metalness:0.9});
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.12,12),hMat);
  handle.rotation.z=Math.PI/2;
  handle.position.set(W*0.35,H*0.5,D/2+0.035);
  doorPivot.add(handle);
  group.add(doorPivot);
  group.userData.doorPivot=doorPivot;
  if(cab.door_open) doorPivot.rotation.y=-Math.PI/2;

  // El keret
  const edges=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W,H,D)),
    new THREE.LineBasicMaterial({color:0x888888,transparent:true,opacity:0.2})
  );
  edges.position.set(0,H/2,0); group.add(edges);

  const wallOffset=(cab.type==='wall')?1.5:0;
  group.position.set(cab.x*SCALE,wallOffset,cab.z*SCALE);
  group.rotation.y=((cab.rotation||0)*Math.PI/180);
  return group;
}

function addOrUpdateCabinetMesh(cab){
  if(cabinetMeshes[cab.id]) scene.remove(cabinetMeshes[cab.id]);
  const m=createCabinetMesh(cab);
  cabinetMeshes[cab.id]=m;
  scene.add(m);
}
function removeCabinetMesh(id){
  if(cabinetMeshes[id]){ scene.remove(cabinetMeshes[id]); delete cabinetMeshes[id]; }
}
function toggleDoor(id,open){
  const mesh=cabinetMeshes[id]; if(!mesh) return;
  const pivot=mesh.userData.doorPivot; if(!pivot) return;
  const start=pivot.rotation.y,end=open?-Math.PI/2:0,dur=30; let p=0;
  (function step(){ p++; pivot.rotation.y=start+(end-start)*(p/dur); if(p<dur) requestAnimationFrame(step); })();
}
function highlightCabinet(id){
  Object.entries(cabinetMeshes).forEach(([cid,mesh])=>{
    mesh.traverse(c=>{ if(c.isMesh&&c.material) c.material.emissive=new THREE.Color(cid===id?0x112244:0x000000); });
  });
}
function cameraFitAll(){
  if(controls&&controls._fit) controls._fit(1.5,0.8,0.5,6);
}

// --- MUNKALAP ---
function rebuildWorktops(cabinets){
  const grp=scene.getObjectByName('worktops');
  if(!grp) return;
  while(grp.children.length) grp.remove(grp.children[0]);
  const baseCabs=cabinets.filter(c=>['base','drawer_base','corner_base'].includes(c.type));
  const wMat=new THREE.MeshStandardMaterial({color:0x7a9a6a,roughness:0.25,metalness:0.05});
  baseCabs.forEach(cab=>{
    const W=cab.w*SCALE,D=cab.d*SCALE,H=cab.h*SCALE;
    const wt=new THREE.Mesh(new THREE.BoxGeometry(W+0.04,0.04,D+0.04),wMat.clone());
    wt.position.set(cab.x*SCALE,H+0.02,cab.z*SCALE);
    wt.rotation.y=(cab.rotation||0)*Math.PI/180;
    wt.castShadow=true; wt.receiveShadow=true;
    grp.add(wt);
  });
}

// --- NAPSZAK ---
const dayPresets=[
  { label:'Hajnal',  sky:0x2a1a4a, amb:0.3, ambCol:0x6655aa, dir:0.4, dirCol:0xff9944, dirPos:[4,3,5] },
  { label:'Reggel',  sky:0x87ceeb, amb:0.7, ambCol:0xfff8e0, dir:1.5, dirCol:0xffd580, dirPos:[8,12,6] },
  { label:'Del',     sky:0x5a8fcf, amb:0.9, ambCol:0xffffff, dir:2.5, dirCol:0xfff5e0, dirPos:[2,15,4] },
  { label:'Este',    sky:0x1a1030, amb:0.4, ambCol:0xffaa66, dir:0.6, dirCol:0xff6633, dirPos:[8,4,8] },
  { label:'Ejszaka', sky:0x050510, amb:0.15,ambCol:0x3344aa, dir:0.1, dirCol:0x8899cc, dirPos:[3,8,3] }
];
function setDayTime(idx){
  const p=dayPresets[idx];
  scene.background=new THREE.Color(p.sky);
  scene.fog.color=new THREE.Color(p.sky);
  ambientLight.intensity=p.amb;
  ambientLight.color=new THREE.Color(p.ambCol);
  dirLight.intensity=p.dir;
  dirLight.color=new THREE.Color(p.dirCol);
  dirLight.position.set(...p.dirPos);
  renderer.toneMappingExposure=p.label==='Del'?1.3:(p.label==='Ejszaka'?0.7:1.0);
  const lbl=document.getElementById('daytime-label');
  if(lbl) lbl.textContent=p.label;
}

// --- TURNTABLE ---
function toggleTurntable(){
  turntableActive=!turntableActive;
  const btn=document.getElementById('btn-turntable');
  if(btn) btn.classList.toggle('active',turntableActive);
  if(turntableActive){
    let angle=0;
    (function spin(){
      if(!turntableActive) return;
      angle+=0.005;
      const r=controls._radius||6;
      camera.position.set(
        controls.target.x+r*Math.sin(Math.PI/4)*Math.cos(angle),
        controls.target.y+r*Math.cos(Math.PI/4),
        controls.target.z+r*Math.sin(Math.PI/4)*Math.sin(angle)
      );
      camera.lookAt(controls.target);
      turntableRAF=requestAnimationFrame(spin);
    })();
  }
}

// --- EGYEDI TEXTURA FELTOLTES ---
function loadCustomTexture(matKey, file){
  const reader=new FileReader();
  reader.onload=function(e){
    const img=new Image();
    img.onload=function(){
      const canvas=document.createElement('canvas');
      canvas.width=512; canvas.height=512;
      canvas.getContext('2d').drawImage(img,0,0,512,512);
      const tex=new THREE.CanvasTexture(canvas);
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      tex.repeat.set(2,2);
      customTextures[matKey]=tex;
      // Ujrarajzol minden szekrenyt ezzel az anyaggal
      if(window.state&&window.state.cabinets){
        window.state.cabinets
          .filter(c=>c.corpus_material===matKey||c.front_material===matKey)
          .forEach(c=>addOrUpdateCabinetMesh(c));
      }
      showToast('✅ Textúra betöltve: '+matKey);
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- SNAPSHOT ---
function takeSnapshot(){
  renderer.render(scene,camera);
  const url=renderer.domElement.toDataURL('image/png');
  const a=document.createElement('a'); a.href=url; a.download='konyha_terv.png'; a.click();
}

// --- 2D ALAPRAJZ ---
function draw2D(cabinets,room,walls){
  const canvas=document.getElementById('canvas2d');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const rw=room.w||4000,rd=room.d||2800;
  const scale=Math.min((W-60)/rw,(H-60)/rd);
  const ox=30,oz=30;
  function tx(x){ return ox+x*scale; }
  function tz(z){ return oz+z*scale; }
  ctx.fillStyle='#1e1e3a'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#252545'; ctx.fillRect(ox,oz,rw*scale,rd*scale);
  // Grid vonalak
  ctx.strokeStyle='rgba(100,100,180,0.15)'; ctx.lineWidth=1;
  for(let x=0;x<=rw;x+=500){ ctx.beginPath(); ctx.moveTo(tx(x),tz(0)); ctx.lineTo(tx(x),tz(rd)); ctx.stroke(); }
  for(let z=0;z<=rd;z+=500){ ctx.beginPath(); ctx.moveTo(tx(0),tz(z)); ctx.lineTo(tx(rw),tz(z)); ctx.stroke(); }
  // Falak
  ctx.strokeStyle='#aaaacc'; ctx.lineWidth=8;
  walls.forEach(w=>{ ctx.beginPath(); ctx.moveTo(tx(w.x1),tz(w.z1)); ctx.lineTo(tx(w.x2),tz(w.z2)); ctx.stroke(); });
  // Szekrenyek
  cabinets.forEach(cab=>{
    const rot=(cab.rotation||0)*Math.PI/180;
    ctx.save();
    ctx.translate(tx(cab.x),tz(cab.z));
    ctx.rotate(rot);
    const hw=cab.w*scale/2,hd=cab.d*scale/2;
    ctx.fillStyle=getMaterialHex(cab.corpus_material)+'cc';
    ctx.fillRect(-hw,-hd,cab.w*scale,cab.d*scale);
    ctx.strokeStyle=getMaterialHex(cab.front_material);
    ctx.lineWidth=3;
    ctx.strokeRect(-hw,-hd,cab.w*scale,cab.d*scale);
    ctx.strokeStyle='#e94560'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(-hw,hd); ctx.lineTo(hw,hd); ctx.stroke();
    ctx.fillStyle='#ffffff'; ctx.font=`${Math.max(9,11)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const typeShort={base:'A',wall:'F',tall:'M',drawer_base:'FI',corner_base:'S'};
    ctx.fillText(typeShort[cab.type]||'?',0,-6);
    ctx.font='9px sans-serif'; ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillText(`${cab.w}`,0,6);
    ctx.restore();
  });
  // Meretek
  ctx.fillStyle='#8888aa'; ctx.font='11px sans-serif'; ctx.textAlign='left';
  ctx.fillText(`Szoba: ${rw} × ${rd} mm  |  szekrények: ${cabinets.length} db`,ox,H-10);
}

// --- NYIL + FORGATAS ---
const ARROW_STEP=50;
function onKeyDown(e){
  if(!window.state||!window.state.selectedCabinetId) return;
  const id=window.state.selectedCabinetId;
  const cab=window.state.cabinets.find(c=>c.id===id); if(!cab) return;
  let dx=0,dz=0,dr=0;
  if(e.key==='ArrowLeft')  { dx=-ARROW_STEP; e.preventDefault(); }
  if(e.key==='ArrowRight') { dx= ARROW_STEP; e.preventDefault(); }
  if(e.key==='ArrowUp')    { dz=-ARROW_STEP; e.preventDefault(); }
  if(e.key==='ArrowDown')  { dz= ARROW_STEP; e.preventDefault(); }
  if(e.key==='r'||e.key==='R'){ dr=90; e.preventDefault(); }
  if(dx===0&&dz===0&&dr===0) return;
  if(dr){ cab.rotation=((cab.rotation||0)+dr)%360; }
  else { cab.x+=dx; cab.z+=dz; }
  if(!dr&&checkCollision(cab,window.state.cabinets)){ cab.x-=dx; cab.z-=dz; showToast('⚠️ ÜTKÖZÉS!'); return; }
  const mesh=cabinetMeshes[id];
  if(mesh){ mesh.position.x=cab.x*SCALE; mesh.position.z=cab.z*SCALE; mesh.rotation.y=(cab.rotation||0)*Math.PI/180; }
  if(typeof updateCabinetPosition==='function') updateCabinetPosition(id,cab.x,cab.z,cab.rotation);
  if(typeof renderPropsPanel==='function') renderPropsPanel(cab);
  if(typeof rebuildWorktops==='function') rebuildWorktops(window.state.cabinets);
  refreshCanvas2D();
}

// --- DRAG ---
function getWorldPosOnFloor(e){ const rect=renderer.domElement.getBoundingClientRect(); mouse.x=((e.clientX-rect.left)/rect.width)*2-1; mouse.y=-((e.clientY-rect.top)/rect.height)*2+1; raycaster.setFromCamera(mouse,camera); const t=new THREE.Vector3(); raycaster.ray.intersectPlane(dragPlane,t); return t; }
function onMouseDown(e){
  if(e.button!==0) return;
  dragStartMouse={x:e.clientX,y:e.clientY};
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(Object.values(cabinetMeshes).flatMap(g=>g.children),true);
  if(hits.length>0){
    let obj=hits[0].object; while(obj.parent&&!obj.parent.userData.cabinetId) obj=obj.parent;
    if(obj.parent&&obj.parent.userData.cabinetId){
      dragState.active=true; dragState.cabinetId=obj.parent.userData.cabinetId;
      const wp=getWorldPosOnFloor(e); const mesh=cabinetMeshes[dragState.cabinetId];
      dragOffset.set(mesh.position.x-wp.x,0,mesh.position.z-wp.z);
      controls._disabled=true; e.preventDefault();
    }
  }
}
function onMouseMove(e){
  if(!dragState.active) return;
  if(Math.abs(e.clientX-dragStartMouse.x)>4||Math.abs(e.clientY-dragStartMouse.y)>4) isDragging=true;
  if(!isDragging) return;
  const wp=getWorldPosOnFloor(e); const snap=0.05;
  const nx=Math.round((wp.x+dragOffset.x)/snap)*snap;
  const nz=Math.round((wp.z+dragOffset.z)/snap)*snap;
  const mesh=cabinetMeshes[dragState.cabinetId]; if(mesh){ mesh.position.x=nx; mesh.position.z=nz; }
  e.preventDefault();
}
async function onMouseUp(e){
  if(dragState.active&&isDragging&&dragState.cabinetId){
    const mesh=cabinetMeshes[dragState.cabinetId];
    if(mesh){
      const xmm=Math.round(mesh.position.x/SCALE); const zmm=Math.round(mesh.position.z/SCALE);
      const cab=window.state&&window.state.cabinets.find(c=>c.id===dragState.cabinetId);
      if(cab){
        const collision=checkCollision({...cab,x:xmm,z:zmm},window.state.cabinets);
        if(collision){ mesh.position.x=cab.x*SCALE; mesh.position.z=cab.z*SCALE; showToast('⚠️ ÜTKÖZÉS!'); }
        else if(typeof updateCabinetPosition==='function') updateCabinetPosition(dragState.cabinetId,xmm,zmm,cab.rotation);
        refreshCanvas2D();
      }
    }
  }
  dragState.active=false; isDragging=false; dragState.cabinetId=null; controls._disabled=false;
}
function onSceneClick(e){
  if(isDragging) return;
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1; mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(Object.values(cabinetMeshes).flatMap(g=>g.children),true);
  if(hits.length>0){
    let obj=hits[0].object; while(obj.parent&&!obj.parent.userData.cabinetId) obj=obj.parent;
    if(obj.parent&&obj.parent.userData.cabinetId) selectCabinet(obj.parent.userData.cabinetId);
  }
}
