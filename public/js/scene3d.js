let scene,camera,renderer,controls;
let cabinetMeshes={};
let raycaster,mouse;
const SCALE=0.001;
let isDragging=false,dragStartMouse={x:0,y:0};
let dragState={active:false,cabinetId:null};
let dragOffset=new THREE.Vector3();
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

// --- Texturas ---
const texLoader=new THREE.TextureLoader();
const texCache={};
const MAT_COLORS={white:'#F5F5F0',anthracite:'#3A3A3A',oak:'#B8860B',walnut:'#5C4033',grey:'#8A8A8A',cream:'#F0E8D0',navy:'#1B2A4A',sage:'#7C9A7E',terracotta:'#C4704F',concrete:'#A0A0A0'};
const TEX_URLS={oak:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/hardwood2_diffuse.jpg',walnut:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/hardwood2_diffuse.jpg',floor:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',wall:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/brick_diffuse.jpg'};

function loadTex(url,rx,ry){ const k=url+rx+ry; if(texCache[k]) return texCache[k]; const t=texLoader.load(url); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||2,ry||2); texCache[k]=t; return t; }
function makeMaterial(matKey,glossy){
  const url=TEX_URLS[matKey]; const color=MAT_COLORS[matKey]||'#F5F5F0';
  const tex=url?loadTex(url,3,3):null;
  if(['oak','walnut','terracotta'].includes(matKey)&&tex) return new THREE.MeshPhongMaterial({map:tex,color:new THREE.Color(color),shininess:glossy?90:20});
  if(tex) return new THREE.MeshLambertMaterial({map:tex});
  if(glossy) return new THREE.MeshPhongMaterial({color:new THREE.Color(color),shininess:90});
  return new THREE.MeshLambertMaterial({color:new THREE.Color(color)});
}

function init3D(){
  const container=document.getElementById('viewport3d');
  const W=container.clientWidth||800,H=container.clientHeight||600;
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x1a1a2e); scene.fog=new THREE.Fog(0x1a1a2e,15,30);
  camera=new THREE.PerspectiveCamera(45,W/H,0.1,100);
  camera.position.set(3,2.5,5); camera.lookAt(2,1,0);
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(W,H); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  document.getElementById('viewport3d').appendChild(renderer.domElement);
  // Vilagitas
  scene.add(new THREE.AmbientLight(0xfff8f0,0.7));
  const dir=new THREE.DirectionalLight(0xfff8e7,1.0); dir.position.set(5,8,5); dir.castShadow=true; dir.shadow.mapSize.set(2048,2048); scene.add(dir);
  scene.add(Object.assign(new THREE.DirectionalLight(0x8899ff,0.35),{position:new THREE.Vector3(-3,3,-2)}));
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
  // Padlo
  const floorTex=loadTex(TEX_URLS.floor,8,8);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshLambertMaterial({map:floorTex}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  const grid=new THREE.GridHelper(20,40,0x00000033,0x00000022); grid.position.y=0.001; scene.add(grid);
  // Szoba doboz
  const wallTex=loadTex(TEX_URLS.wall,4,3);
  const roomBox=new THREE.Mesh(new THREE.BoxGeometry(16,6,16),new THREE.MeshLambertMaterial({map:wallTex,side:THREE.BackSide}));
  roomBox.position.set(2,3,1); roomBox.name='room_box'; scene.add(roomBox);
  // Munkalap csoport
  scene.add(Object.assign(new THREE.Group(),{name:'worktops'}));
  // Events
  renderer.domElement.addEventListener('mousedown',onMouseDown);
  renderer.domElement.addEventListener('mousemove',onMouseMove);
  renderer.domElement.addEventListener('mouseup',onMouseUp);
  renderer.domElement.addEventListener('click',onSceneClick);
  window.addEventListener('keydown',onKeyDown);
  window.addEventListener('resize',()=>{ const c=document.getElementById('viewport3d'); camera.aspect=c.clientWidth/c.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(c.clientWidth,c.clientHeight); });
  animate3D();
}
function animate3D(){ requestAnimationFrame(animate3D); renderer.render(scene,camera); }

function drawRoomWalls(room,walls){
  const old=scene.getObjectByName('room_walls'); if(old) scene.remove(old);
  const g=new THREE.Group(); g.name='room_walls';
  const wallTex=loadTex(TEX_URLS.wall,4,3);
  const mat=new THREE.MeshLambertMaterial({map:wallTex,side:THREE.DoubleSide});
  const H=(room.h||2700)*SCALE;
  walls.forEach(w=>{
    const x1=w.x1*SCALE,z1=w.z1*SCALE,x2=w.x2*SCALE,z2=w.z2*SCALE;
    const len=Math.sqrt((x2-x1)**2+(z2-z1)**2);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(len,H,0.06),mat.clone());
    mesh.position.set((x1+x2)/2,H/2,(z1+z2)/2);
    mesh.rotation.y=-Math.atan2(z2-z1,x2-x1);
    mesh.receiveShadow=true; mesh.castShadow=true; g.add(mesh);
  });
  scene.add(g);
}

function createCabinetMesh(cab){
  const group=new THREE.Group(); group.userData={cabinetId:cab.id};
  const W=cab.w*SCALE,H=cab.h*SCALE,D=cab.d*SCALE,T=0.018;
  const cMat=makeMaterial(cab.corpus_material,false);
  const fMat=makeMaterial(cab.front_material,true);
  function panel(w,h,d,px,py,pz,mat){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat.clone()); m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true; group.add(m); return m; }
  panel(T,H,D,-(W/2-T/2),H/2,0,cMat);
  panel(T,H,D,(W/2-T/2),H/2,0,cMat);
  panel(W-2*T,T,D,0,H-T/2,0,cMat);
  panel(W-2*T,T,D,0,T/2,0,cMat);
  panel(W-2*T,H-2*T,0.008,0,H/2,-(D/2-0.004),cMat);
  const shelves=cab.shelves||0;
  if(shelves>0){ const step=(H-2*T)/(shelves+1); for(let i=1;i<=shelves;i++) panel(W-2*T-0.004,T,D-0.02,0,T+step*i,0.01,cMat); }
  // Ajto
  const doorPivot=new THREE.Group(); doorPivot.position.set(-(W/2-T),0,0);
  const door=new THREE.Mesh(new THREE.BoxGeometry(W-2*T,H-2*T,0.019),fMat.clone()); door.position.set((W-2*T)/2,H/2,D/2+0.0095); door.castShadow=true; doorPivot.add(door);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.1,8),new THREE.MeshPhongMaterial({color:0xcccccc,shininess:200}));
  handle.rotation.z=Math.PI/2; handle.position.set(W*0.35,H*0.5,D/2+0.032); doorPivot.add(handle);
  group.add(doorPivot); group.userData.doorPivot=doorPivot;
  if(cab.door_open) doorPivot.rotation.y=-Math.PI/2;
  // El keret
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W,H,D)),new THREE.LineBasicMaterial({color:0x888888,transparent:true,opacity:0.25}));
  edges.position.set(0,H/2,0); group.add(edges);
  // Pozicio + forgatas
  const wallOffset=(cab.type==='wall')?1.5:0;
  group.position.set(cab.x*SCALE,wallOffset,cab.z*SCALE);
  group.rotation.y=((cab.rotation||0)*Math.PI/180);
  return group;
}
function addOrUpdateCabinetMesh(cab){ if(cabinetMeshes[cab.id]) scene.remove(cabinetMeshes[cab.id]); const m=createCabinetMesh(cab); cabinetMeshes[cab.id]=m; scene.add(m); }
function removeCabinetMesh(id){ if(cabinetMeshes[id]){ scene.remove(cabinetMeshes[id]); delete cabinetMeshes[id]; } }
function toggleDoor(id,open){ const mesh=cabinetMeshes[id]; if(!mesh) return; const pivot=mesh.userData.doorPivot; if(!pivot) return; const start=pivot.rotation.y,end=open?-Math.PI/2:0,dur=30; let p=0; (function step(){ p++; pivot.rotation.y=start+(end-start)*(p/dur); if(p<dur) requestAnimationFrame(step); })(); }
function highlightCabinet(id){ Object.entries(cabinetMeshes).forEach(([cid,mesh])=>{ mesh.traverse(c=>{ if(c.isMesh&&c.material) c.material.emissive=new THREE.Color(cid===id?0x112233:0x000000); }); }); }
function cameraFitAll(){ if(controls&&controls._fit) controls._fit(1.5,0.8,0.5,6); }

// --- MUNKALAP ---
function rebuildWorktops(cabinets){
  const grp=scene.getObjectByName('worktops');
  if(!grp) return;
  while(grp.children.length) grp.remove(grp.children[0]);
  const baseCabs=cabinets.filter(c=>c.type==='base'||c.type==='drawer_base'||c.type==='corner_base');
  const wMat=new THREE.MeshPhongMaterial({color:0x8a9a7a,shininess:120});
  baseCabs.forEach(cab=>{
    const W=cab.w*SCALE,D=cab.d*SCALE,H=cab.h*SCALE;
    const wt=new THREE.Mesh(new THREE.BoxGeometry(W+0.04,0.04,D+0.04),wMat.clone());
    wt.position.set(cab.x*SCALE,H+0.02,cab.z*SCALE);
    wt.rotation.y=(cab.rotation||0)*Math.PI/180;
    wt.castShadow=true; grp.add(wt);
  });
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
  const scale=Math.min((W-40)/rw,(H-40)/rd);
  const ox=20,oz=20;
  function tx(x){ return ox+x*scale; }
  function tz(z){ return oz+z*scale; }
  // Hatter
  ctx.fillStyle='#1e1e3a'; ctx.fillRect(0,0,W,H);
  // Padlo
  ctx.fillStyle='#2a2a4a'; ctx.fillRect(ox,oz,rw*scale,rd*scale);
  // Falak
  ctx.strokeStyle='#aaaacc'; ctx.lineWidth=8;
  walls.forEach(w=>{ ctx.beginPath(); ctx.moveTo(tx(w.x1),tz(w.z1)); ctx.lineTo(tx(w.x2),tz(w.z2)); ctx.stroke(); });
  // Szekrenyek
  cabinets.forEach(cab=>{
    const rot=(cab.rotation||0)*Math.PI/180;
    ctx.save();
    ctx.translate(tx(cab.x),tz(cab.z));
    ctx.rotate(rot);
    const hw=cab.w*scale/2, hd=cab.d*scale/2;
    // Kitoltes szin szerint
    ctx.fillStyle=getMaterialHex(cab.corpus_material)+'cc';
    ctx.fillRect(-hw,-hd,cab.w*scale,cab.d*scale);
    ctx.strokeStyle=getMaterialHex(cab.front_material);
    ctx.lineWidth=3;
    ctx.strokeRect(-hw,-hd,cab.w*scale,cab.d*scale);
    // Front vonal
    ctx.strokeStyle='#e94560'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(-hw,hd); ctx.lineTo(hw,hd); ctx.stroke();
    // Cimke
    ctx.fillStyle='#ffffff'; ctx.font=`${Math.max(9,10*scale/0.08)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${cab.w}`, 0, 0);
    ctx.restore();
  });
  // Meretek
  ctx.fillStyle='#aaaacc'; ctx.font='11px sans-serif'; ctx.textAlign='left';
  ctx.fillText(`Szoba: ${rw} x ${rd} mm`,ox,H-8);
}

// --- Nyil billentyuk ---
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
  if(e.key==='r'||e.key==='R') { dr=90; e.preventDefault(); }
  if(dx===0&&dz===0&&dr===0) return;
  if(dr) { cab.rotation=((cab.rotation||0)+dr)%360; }
  else { cab.x+=dx; cab.z+=dz; }
  // Utkozesvizsgalat
  const collision=checkCollision(cab,window.state.cabinets);
  if(collision&&!dr) { cab.x-=dx; cab.z-=dz; showToast('⚠️ ÜTKÖZÉS! A szekrény nem fér el ott.'); return; }
  const mesh=cabinetMeshes[id];
  if(mesh){ mesh.position.x=cab.x*SCALE; mesh.position.z=cab.z*SCALE; mesh.rotation.y=(cab.rotation||0)*Math.PI/180; }
  if(typeof updateCabinetPosition==='function') updateCabinetPosition(id,cab.x,cab.z,cab.rotation);
  if(typeof renderPropsPanel==='function') renderPropsPanel(cab);
  if(typeof rebuildWorktops==='function') rebuildWorktops(window.state.cabinets);
  refreshCanvas2D();
}

// --- Drag & drop ---
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
  const nx=Math.round((wp.x+dragOffset.x)/snap)*snap; const nz=Math.round((wp.z+dragOffset.z)/snap)*snap;
  const mesh=cabinetMeshes[dragState.cabinetId]; if(mesh){ mesh.position.x=nx; mesh.position.z=nz; }
  e.preventDefault();
}
async function onMouseUp(e){
  if(dragState.active&&isDragging&&dragState.cabinetId){
    const mesh=cabinetMeshes[dragState.cabinetId];
    if(mesh){
      const xmm=Math.round(mesh.position.x/SCALE); const zmm=Math.round(mesh.position.z/SCALE);
      const cab=window.state&&window.state.cabinets.find(c=>c.id===dragState.cabinetId);
      if(cab){ const collision=checkCollision({...cab,x:xmm,z:zmm},window.state.cabinets); if(collision){ mesh.position.x=cab.x*SCALE; mesh.position.z=cab.z*SCALE; showToast('⚠️ ÜTKÖZÉS!'); } else if(typeof updateCabinetPosition==='function') updateCabinetPosition(dragState.cabinetId,xmm,zmm,cab.rotation); }
      refreshCanvas2D();
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
