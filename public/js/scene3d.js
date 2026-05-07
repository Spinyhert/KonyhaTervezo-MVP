let scene,camera,renderer,controls;
let cabinetMeshes={};
let raycaster,mouse;
const SCALE=0.001;

// --- Drag state ---
let dragState={active:false,cabinetId:null};
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let isDragging=false,dragStartMouse={x:0,y:0};
let dragOffset=new THREE.Vector3();

// --- Texture loader ---
const texLoader=new THREE.TextureLoader();
const texCache={};

// Színek fallback-ként
const MAT_COLORS={
  white:'#F5F5F0', anthracite:'#3A3A3A', oak:'#B8860B',
  walnut:'#5C4033', grey:'#8A8A8A', cream:'#F0E8D0',
  navy:'#1B2A4A', sage:'#7C9A7E', terracotta:'#C4704F', concrete:'#A0A0A0'
};

// Ingyenes textura URL-ek (CORS-barát CDN-ek)
const TEX_URLS={
  oak:       'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/hardwood2_diffuse.jpg',
  walnut:    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/hardwood2_diffuse.jpg',
  concrete:  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/terrain/grasslight-big.jpg',
  floor:     'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
  wall:      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r134/examples/textures/brick_diffuse.jpg',
  white:     null, anthracite:null, grey:null, cream:null, navy:null, sage:null, terracotta:null
};

function loadTex(url,repeatX,repeatY,tint){
  if(!url) return null;
  const key=url+repeatX+repeatY;
  if(texCache[key]) return texCache[key];
  const t=texLoader.load(url);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(repeatX||2,repeatY||2);
  texCache[key]=t;
  return t;
}

function makeMaterial(matKey,isGlossy){
  const url=TEX_URLS[matKey];
  const color=MAT_COLORS[matKey]||'#F5F5F0';
  let tex=url?loadTex(url,3,3):null;
  // Wood és terrakotta színérzés megtartása
  if(['oak','walnut','terracotta'].includes(matKey)&&tex){
    const mat=new THREE.MeshPhongMaterial({map:tex,color:new THREE.Color(color),shininess:isGlossy?90:20});
    return mat;
  }
  if(tex){
    return new THREE.MeshLambertMaterial({map:tex});
  }
  // Egyszerű szín
  if(isGlossy) return new THREE.MeshPhongMaterial({color:new THREE.Color(color),shininess:90});
  return new THREE.MeshLambertMaterial({color:new THREE.Color(color)});
}

function init3D(){
  const container=document.getElementById('viewport3d');
  const W=container.clientWidth||800, H=container.clientHeight||600;
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x1a1a2e);
  scene.fog=new THREE.Fog(0x1a1a2e,15,30);

  camera=new THREE.PerspectiveCamera(45,W/H,0.1,100);
  camera.position.set(3,2.5,5);
  camera.lookAt(2,1,0);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(W,H);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  container.appendChild(renderer.domElement);

  // Világítás
  const ambient=new THREE.AmbientLight(0xfff8f0,0.7); scene.add(ambient);
  const dir=new THREE.DirectionalLight(0xfff8e7,1.0);
  dir.position.set(5,8,5); dir.castShadow=true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=30;
  scene.add(dir);
  const fill=new THREE.DirectionalLight(0x8899ff,0.35); fill.position.set(-3,3,-2); scene.add(fill);
  const back=new THREE.DirectionalLight(0xffffff,0.2); back.position.set(0,2,-5); scene.add(back);

  controls=new THREE.OrbitControls(camera,renderer.domElement);

  raycaster=new THREE.Raycaster();
  mouse=new THREE.Vector2();

  // Padló - csempe texturával
  const floorTex=loadTex(TEX_URLS.floor,8,8);
  const floorGeo=new THREE.PlaneGeometry(20,20);
  const floorMat=floorTex
    ? new THREE.MeshLambertMaterial({map:floorTex})
    : new THREE.MeshLambertMaterial({color:0x8a8060});
  const floor=new THREE.Mesh(floorGeo,floorMat);
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

  // Ényalalt Grid a padló fölé
  const grid=new THREE.GridHelper(20,40,0x00000033,0x00000022);
  grid.position.y=0.001; scene.add(grid);

  // Háttér falak
  buildRoomBox();

  // Events
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

function buildRoomBox(){
  const wallTex=loadTex(TEX_URLS.wall,4,3);
  const wallMat=wallTex
    ? new THREE.MeshLambertMaterial({map:wallTex,side:THREE.BackSide})
    : new THREE.MeshLambertMaterial({color:0xd8cfc0,side:THREE.BackSide});
  const room=new THREE.Mesh(new THREE.BoxGeometry(16,6,16),wallMat);
  room.position.set(2,3,1); room.name='room_box'; scene.add(room);
}

function animate3D(){ requestAnimationFrame(animate3D); renderer.render(scene,camera); }

function drawRoomWalls(room,walls){
  const old=scene.getObjectByName('room_walls'); if(old) scene.remove(old);
  const g=new THREE.Group(); g.name='room_walls';
  const wallTex=loadTex(TEX_URLS.wall,4,3);
  const mat=wallTex
    ? new THREE.MeshLambertMaterial({map:wallTex,side:THREE.DoubleSide})
    : new THREE.MeshLambertMaterial({color:0xd8cfc0,side:THREE.DoubleSide});
  const H=(room.h||2700)*SCALE;
  walls.forEach(w=>{
    const x1=w.x1*SCALE,z1=w.z1*SCALE,x2=w.x2*SCALE,z2=w.z2*SCALE;
    const len=Math.sqrt((x2-x1)**2+(z2-z1)**2);
    const geo=new THREE.BoxGeometry(len,H,0.06);
    const mesh=new THREE.Mesh(geo,mat.clone());
    mesh.position.set((x1+x2)/2,H/2,(z1+z2)/2);
    mesh.rotation.y=-Math.atan2(z2-z1,x2-x1);
    mesh.receiveShadow=true; mesh.castShadow=true;
    g.add(mesh);
  });
  scene.add(g);
}

function createCabinetMesh(cab){
  const group=new THREE.Group(); group.userData={cabinetId:cab.id};
  const W=cab.w*SCALE, H=cab.h*SCALE, D=cab.d*SCALE, T=0.018;

  const cMat=makeMaterial(cab.corpus_material,false);
  const fMat=makeMaterial(cab.front_material,true);

  function panel(w,h,d,px,py,pz,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat.clone());
    m.position.set(px,py,pz); m.castShadow=true; m.receiveShadow=true;
    group.add(m); return m;
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

  // Ajtó
  const doorPivot=new THREE.Group();
  doorPivot.position.set(-(W/2-T),0,0);
  const door=new THREE.Mesh(new THREE.BoxGeometry(W-2*T,H-2*T,0.019),fMat.clone());
  door.position.set((W-2*T)/2,H/2,D/2+0.0095);
  door.castShadow=true;
  doorPivot.add(door);
  // Fogá
  const hMat=new THREE.MeshPhongMaterial({color:0xcccccc,shininess:200});
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.1,8),hMat);
  handle.rotation.z=Math.PI/2; handle.position.set(W*0.35,H*0.5,D/2+0.032);
  doorPivot.add(handle);
  group.add(doorPivot);
  group.userData.doorPivot=doorPivot;
  if(cab.door_open) doorPivot.rotation.y=-Math.PI/2;

  // Szél highlight keret
  const edgeMat=new THREE.LineBasicMaterial({color:0x888888,transparent:true,opacity:0.3});
  const edgesGeo=new THREE.EdgesGeometry(new THREE.BoxGeometry(W,H,D));
  const edges=new THREE.LineSegments(edgesGeo,edgeMat);
  edges.position.set(0,H/2,0); group.add(edges);

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
  const start=pivot.rotation.y, end=open?-Math.PI/2:0, dur=30; let p=0;
  (function step(){ p++; pivot.rotation.y=start+(end-start)*(p/dur); if(p<dur) requestAnimationFrame(step); })();
}
function highlightCabinet(id){
  Object.entries(cabinetMeshes).forEach(([cid,mesh])=>{
    mesh.traverse(c=>{ if(c.isMesh&&c.material) c.material.emissive=new THREE.Color(cid===id?0x112233:0x000000); });
  });
}
function cameraFitAll(){
  if(controls&&controls._fit) controls._fit(1.5,0.8,0.5,6);
}

// --- Nyíl billentyűk ---
const ARROW_STEP=50; // mm
function onKeyDown(e){
  if(!window.state||!window.state.selectedCabinetId) return;
  const id=window.state.selectedCabinetId;
  const cab=window.state.cabinets.find(c=>c.id===id); if(!cab) return;
  let dx=0,dz=0;
  if(e.key==='ArrowLeft')  { dx=-ARROW_STEP; e.preventDefault(); }
  if(e.key==='ArrowRight') { dx= ARROW_STEP; e.preventDefault(); }
  if(e.key==='ArrowUp')    { dz=-ARROW_STEP; e.preventDefault(); }
  if(e.key==='ArrowDown')  { dz= ARROW_STEP; e.preventDefault(); }
  if(dx===0&&dz===0) return;
  cab.x+=dx; cab.z+=dz;
  const mesh=cabinetMeshes[id];
  if(mesh){ mesh.position.x=cab.x*SCALE; mesh.position.z=cab.z*SCALE; }
  if(typeof updateCabinetPosition==='function') updateCabinetPosition(id,cab.x,cab.z);
  if(typeof renderPropsPanel==='function') renderPropsPanel(cab);
}

// --- Mouse drag (egeres mozgatás megtartva opcionálisan) ---
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
      dragState.active=true; dragState.cabinetId=obj.parent.userData.cabinetId;
      const mesh=cabinetMeshes[dragState.cabinetId];
      const wp=getWorldPosOnFloor(e);
      dragOffset.set(mesh.position.x-wp.x,0,mesh.position.z-wp.z);
      controls._disabled=true; e.preventDefault();
    }
  }
}
function onMouseMove(e){
  if(!dragState.active) return;
  const dx2=Math.abs(e.clientX-dragStartMouse.x),dz2=Math.abs(e.clientY-dragStartMouse.y);
  if(dx2>4||dz2>4) isDragging=true;
  if(!isDragging) return;
  const wp=getWorldPosOnFloor(e);
  const snap=0.05;
  const nx=Math.round((wp.x+dragOffset.x)/snap)*snap;
  const nz=Math.round((wp.z+dragOffset.z)/snap)*snap;
  const mesh=cabinetMeshes[dragState.cabinetId];
  if(mesh){ mesh.position.x=nx; mesh.position.z=nz; }
  e.preventDefault();
}
async function onMouseUp(e){
  if(dragState.active&&isDragging&&dragState.cabinetId){
    const mesh=cabinetMeshes[dragState.cabinetId];
    if(mesh){
      const xmm=Math.round(mesh.position.x/SCALE);
      const zmm=Math.round(mesh.position.z/SCALE);
      if(typeof updateCabinetPosition==='function') updateCabinetPosition(dragState.cabinetId,xmm,zmm);
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
