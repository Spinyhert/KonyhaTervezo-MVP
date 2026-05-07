let scene,camera,renderer,controls;
let cabinetMeshes={};
let raycaster,mouse;
const SCALE=0.001;

// --- Drag state ---
let dragState={active:false,cabinetId:null,planeY:0,offset:new THREE.Vector3()};
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

// --- Texture cache ---
const texCache={};
function makeWoodTexture(hex1,hex2,grain=12){
  const key='wood_'+hex1+hex2;
  if(texCache[key]) return texCache[key];
  const c=document.createElement('canvas'); c.width=256; c.height=256;
  const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,256,0);
  g.addColorStop(0,hex1); g.addColorStop(0.5,hex2); g.addColorStop(1,hex1);
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  ctx.globalAlpha=0.18;
  for(let i=0;i<grain;i++){
    const x=Math.random()*256;
    ctx.strokeStyle=i%2===0?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.3)';
    ctx.lineWidth=Math.random()*3+0.5;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.bezierCurveTo(x+15,80,x-10,160,x+5,256); ctx.stroke();
  }
  ctx.globalAlpha=1;
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2);
  texCache[key]=t; return t;
}
function makeSolidTexture(hex){
  const key='solid_'+hex;
  if(texCache[key]) return texCache[key];
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const ctx=c.getContext('2d');
  ctx.fillStyle=hex; ctx.fillRect(0,0,64,64);
  ctx.globalAlpha=0.04;
  for(let i=0;i<64;i+=4){ ctx.fillStyle=i%8===0?'#fff':'#000'; ctx.fillRect(0,i,64,2); }
  ctx.globalAlpha=1;
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3);
  texCache[key]=t; return t;
}
function makeConcreteTexture(){
  const key='concrete';
  if(texCache[key]) return texCache[key];
  const c=document.createElement('canvas'); c.width=256; c.height=256;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#A0A0A0'; ctx.fillRect(0,0,256,256);
  for(let i=0;i<2000;i++){
    const x=Math.random()*256,y=Math.random()*256;
    ctx.fillStyle=`rgba(${Math.random()>0.5?255:0},${Math.random()>0.5?255:0},${Math.random()>0.5?255:0},0.03)`;
    ctx.fillRect(x,y,Math.random()*4,Math.random()*4);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2);
  texCache[key]=t; return t;
}
function getTexture(matKey){
  const woodMap={
    oak:      ['#C8A050','#A07828'],
    walnut:   ['#6B4226','#4A2C17'],
    terracotta:['#C4704F','#A0543A']
  };
  const concreteKeys=['concrete'];
  if(woodMap[matKey]) return makeWoodTexture(woodMap[matKey][0],woodMap[matKey][1]);
  if(concreteKeys.includes(matKey)) return makeConcreteTexture();
  return makeSolidTexture(getMaterialHex(matKey));
}
function makeMaterial(matKey,shininess=0){
  const tex=getTexture(matKey);
  if(shininess>0) return new THREE.MeshPhongMaterial({map:tex,shininess});
  return new THREE.MeshLambertMaterial({map:tex});
}

function init3D(){
  const container=document.getElementById('viewport3d');
  const W=container.clientWidth||800, H=container.clientHeight||600;
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a1a2e);
  camera=new THREE.PerspectiveCamera(45,W/H,0.1,100);
  camera.position.set(3,2.5,4);
  camera.lookAt(2,1,0);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(W,H);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const ambient=new THREE.AmbientLight(0xffffff,0.65); scene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.85); dir.position.set(5,8,5); dir.castShadow=true; scene.add(dir);
  const fill=new THREE.DirectionalLight(0x8888ff,0.3); fill.position.set(-3,2,-2); scene.add(fill);
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  raycaster=new THREE.Raycaster();
  mouse=new THREE.Vector2();
  // Event listeners
  renderer.domElement.addEventListener('mousedown',onMouseDown);
  renderer.domElement.addEventListener('mousemove',onMouseMove);
  renderer.domElement.addEventListener('mouseup',onMouseUp);
  renderer.domElement.addEventListener('click',onSceneClick);
  const grid=new THREE.GridHelper(20,40,0x333355,0x222244); scene.add(grid);
  const floorGeo=new THREE.PlaneGeometry(20,20);
  const floorMat=new THREE.MeshLambertMaterial({color:0x1e1e3a});
  const floor=new THREE.Mesh(floorGeo,floorMat); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  window.addEventListener('resize',()=>{
    const c=document.getElementById('viewport3d');
    camera.aspect=c.clientWidth/c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth,c.clientHeight);
  });
  animate3D();
}

function animate3D(){ requestAnimationFrame(animate3D); renderer.render(scene,camera); }

function drawRoomWalls(room,walls){
  const old=scene.getObjectByName('room_walls'); if(old) scene.remove(old);
  const g=new THREE.Group(); g.name='room_walls';
  const mat=new THREE.MeshLambertMaterial({color:0x2a2a4a,side:THREE.DoubleSide});
  const H=(room.h||2700)*SCALE;
  walls.forEach(w=>{
    const x1=w.x1*SCALE,z1=w.z1*SCALE,x2=w.x2*SCALE,z2=w.z2*SCALE;
    const len=Math.sqrt((x2-x1)**2+(z2-z1)**2);
    const geo=new THREE.BoxGeometry(len,H,0.08);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set((x1+x2)/2,H/2,(z1+z2)/2);
    mesh.rotation.y=-Math.atan2(z2-z1,x2-x1);
    g.add(mesh);
  });
  scene.add(g);
}

function createCabinetMesh(cab){
  const group=new THREE.Group(); group.userData={cabinetId:cab.id};
  const W=cab.w*SCALE, H=cab.h*SCALE, D=cab.d*SCALE, T=0.018;
  const cMat=makeMaterial(cab.corpus_material);
  const fMat=makeMaterial(cab.front_material,80);
  function panel(w,h,d,px,py,pz,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat.clone());
    m.position.set(px,py,pz); m.castShadow=true; group.add(m); return m;
  }
  panel(T,H,D,-(W/2-T/2),H/2,0,cMat);
  panel(T,H,D, (W/2-T/2),H/2,0,cMat);
  panel(W-2*T,T,D,0,H-T/2,0,cMat);
  panel(W-2*T,T,D,0,T/2,0,cMat);
  panel(W-2*T,H-2*T,0.008,0,H/2,-(D/2-0.004),cMat);
  const shelves=cab.shelves||0;
  if(shelves>0){
    const step=(H-2*T)/(shelves+1);
    for(let i=1;i<=shelves;i++) panel(W-2*T-0.004,T,D-0.02,0,T+step*i,0.01,cMat);
  }
  const doorPivot=new THREE.Group();
  doorPivot.position.set(-(W/2-T),0,0);
  const door=new THREE.Mesh(new THREE.BoxGeometry(W-2*T,H-2*T,0.019),fMat.clone());
  door.position.set((W-2*T)/2,H/2,D/2+0.0095);
  doorPivot.add(door);
  const hGeo=new THREE.CylinderGeometry(0.007,0.007,0.1,8);
  const hMat=new THREE.MeshPhongMaterial({color:0xcccccc,shininess:200});
  const handle=new THREE.Mesh(hGeo,hMat);
  handle.rotation.z=Math.PI/2; handle.position.set(W*0.35,H*0.5,D/2+0.03);
  doorPivot.add(handle);
  group.add(doorPivot);
  group.userData.doorPivot=doorPivot;
  if(cab.door_open) doorPivot.rotation.y=-Math.PI/2;
  const wallOffset=(cab.type==='wall')?1.5:0;
  group.position.set(cab.x*SCALE, wallOffset, cab.z*SCALE);
  return group;
}

function addOrUpdateCabinetMesh(cab){
  if(cabinetMeshes[cab.id]) scene.remove(cabinetMeshes[cab.id]);
  const mesh=createCabinetMesh(cab);
  cabinetMeshes[cab.id]=mesh;
  scene.add(mesh);
}
function removeCabinetMesh(id){
  if(cabinetMeshes[id]){ scene.remove(cabinetMeshes[id]); delete cabinetMeshes[id]; }
}
function toggleDoor(id,open){
  const mesh=cabinetMeshes[id]; if(!mesh) return;
  const pivot=mesh.userData.doorPivot; if(!pivot) return;
  const start=pivot.rotation.y, end=open?-Math.PI/2:0, dur=30;
  let p=0;
  (function step(){ p++; pivot.rotation.y=start+(end-start)*(p/dur); if(p<dur) requestAnimationFrame(step); })();
}
function highlightCabinet(id){
  Object.entries(cabinetMeshes).forEach(([cid,mesh])=>{
    mesh.traverse(c=>{ if(c.isMesh&&c.material) c.material.emissive=new THREE.Color(cid===id?0x223344:0x000000); });
  });
}
function cameraFitAll(){
  if(controls&&controls._fit) controls._fit(1.5,0.8,0.5,6);
}

// --- Drag & Drop ---
let isDragging=false, dragStartMouse={x:0,y:0};
function getWorldPosOnFloor(e){
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const target=new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane,target);
  return target;
}
function onMouseDown(e){
  if(e.button!==0) return;
  dragStartMouse={x:e.clientX,y:e.clientY};
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const all=Object.values(cabinetMeshes).flatMap(g=>g.children);
  const hits=raycaster.intersectObjects(all,true);
  if(hits.length>0){
    let obj=hits[0].object;
    while(obj.parent&&!obj.parent.userData.cabinetId) obj=obj.parent;
    if(obj.parent&&obj.parent.userData.cabinetId){
      dragState.active=true;
      dragState.cabinetId=obj.parent.userData.cabinetId;
      const mesh=cabinetMeshes[dragState.cabinetId];
      const worldPos=getWorldPosOnFloor(e);
      dragState.offset.set(mesh.position.x-worldPos.x,0,mesh.position.z-worldPos.z);
      // Disable orbit while dragging
      controls._disabled=true;
      e.preventDefault();
    }
  }
}
function onMouseMove(e){
  if(!dragState.active) return;
  const dx=Math.abs(e.clientX-dragStartMouse.x), dz=Math.abs(e.clientY-dragStartMouse.y);
  if(dx>3||dz>3) isDragging=true;
  if(!isDragging) return;
  const worldPos=getWorldPosOnFloor(e);
  const newX=worldPos.x+dragState.offset.x;
  const newZ=worldPos.z+dragState.offset.z;
  const mesh=cabinetMeshes[dragState.cabinetId];
  if(mesh){
    // Rácshoz igazítás (grid snap) 100mm = 0.1 egység
    const snap=0.1;
    mesh.position.x=Math.round(newX/snap)*snap;
    mesh.position.z=Math.round(newZ/snap)*snap;
  }
  e.preventDefault();
}
async function onMouseUp(e){
  if(dragState.active&&isDragging&&dragState.cabinetId){
    const mesh=cabinetMeshes[dragState.cabinetId];
    if(mesh){
      // mm-be visszakonvertálás
      const newXmm=Math.round(mesh.position.x/SCALE);
      const newZmm=Math.round(mesh.position.z/SCALE);
      // State és API frissítés
      if(typeof updateCabinetPosition==='function') updateCabinetPosition(dragState.cabinetId,newXmm,newZmm);
    }
  }
  dragState.active=false; isDragging=false; dragState.cabinetId=null;
  controls._disabled=false;
}
function onSceneClick(e){
  if(isDragging) return;
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const all=Object.values(cabinetMeshes).flatMap(g=>g.children);
  const hits=raycaster.intersectObjects(all,true);
  if(hits.length>0){
    let obj=hits[0].object;
    while(obj.parent&&!obj.parent.userData.cabinetId) obj=obj.parent;
    if(obj.parent&&obj.parent.userData.cabinetId) selectCabinet(obj.parent.userData.cabinetId);
  }
}
