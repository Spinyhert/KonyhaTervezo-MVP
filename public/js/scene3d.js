let scene,camera,renderer,controls;
let cabinetMeshes={};
let raycaster,mouse;
const SCALE=0.001;

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

  const ambient=new THREE.AmbientLight(0xffffff,0.6); scene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.8); dir.position.set(5,8,5); dir.castShadow=true; scene.add(dir);
  const fill=new THREE.DirectionalLight(0x8888ff,0.3); fill.position.set(-3,2,-2); scene.add(fill);

  controls=new THREE.OrbitControls(camera,renderer.domElement);

  raycaster=new THREE.Raycaster();
  mouse=new THREE.Vector2();
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
  const W=cab.w*SCALE,H=cab.h*SCALE,D=cab.d*SCALE,T=0.018;
  const cMat=new THREE.MeshLambertMaterial({color:new THREE.Color(getMaterialHex(cab.corpus_material))});
  const fMat=new THREE.MeshPhongMaterial({color:new THREE.Color(getMaterialHex(cab.front_material)),shininess:80});

  function panel(w,h,d,px,py,pz,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
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
  const door=new THREE.Mesh(new THREE.BoxGeometry(W-2*T,H-2*T,0.019),fMat);
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
  group.position.set(cab.x*SCALE,wallOffset,cab.z*SCALE);
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
  if(controls._fit) controls._fit(1.5,0.8,0.5,6);
}
function onSceneClick(e){
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
