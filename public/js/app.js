const API='http://localhost:3000/api';
window.state={ projects:[], currentProjectId:null, cabinets:[], selectedCabinetId:null, template:'straight', currentRoom:null, currentWalls:[], customer:null };
const state=window.state;
let viewMode='3d';

document.addEventListener('DOMContentLoaded',async()=>{
  init3D();
  await loadProjects();
});

function showToast(msg,duration=2500){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.style.cssText='position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:0.6rem 1.4rem;border-radius:20px;font-size:0.9rem;z-index:9999;pointer-events:none;transition:opacity 0.3s;'; document.body.appendChild(t); }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.style.opacity='0',duration);
}

function switchView(mode){
  viewMode=mode;
  document.getElementById('viewport3d').style.display=mode==='3d'?'block':'none';
  document.getElementById('canvas2d-wrap').style.display=mode==='2d'?'flex':'none';
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===mode));
  if(mode==='2d') refreshCanvas2D();
}
function refreshCanvas2D(){
  if(viewMode!=='2d') return;
  const tpl=KitchenTemplates[state.template]||KitchenTemplates.straight;
  draw2D(state.cabinets,state.currentRoom||tpl.room,state.currentWalls.length?state.currentWalls:tpl.walls);
}

async function loadProjects(){
  const res=await fetch(`${API}/projects`);
  state.projects=await res.json();
  renderProjectList();
}
function renderProjectList(){
  const ul=document.getElementById('project-list');
  ul.innerHTML=state.projects.length===0?'<li class="empty-hint">Még nincs projekt.</li>'
    :state.projects.map(p=>`<li class="project-item ${p.id===state.currentProjectId?'active':''}" onclick="openProject('${p.id}')">
      <span class="proj-name">${p.name}</span>
      <button class="btn-icon danger" onclick="deleteProject(event,'${p.id}')">🗑</button></li>`).join('');
}
async function createProject(){
  const tpl=state.template; const tplData=KitchenTemplates[tpl];
  const name=prompt('Projekt neve:',`Új konyha - ${tplData.label}`); if(!name) return;
  const res=await fetch(`${API}/projects`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,template:tpl,room_width:tplData.room.w,room_depth:tplData.room.d,room_height:tplData.room.h,customer_name:'',customer_email:'',customer_phone:''})});
  const {id}=await res.json(); await loadProjects(); await openProject(id);
}
async function openProject(id){
  const res=await fetch(`${API}/projects/${id}`);
  const {project,cabinets}=await res.json();
  state.currentProjectId=id; state.cabinets=cabinets; state.template=project.template;
  state.currentRoom={w:project.room_width,d:project.room_depth,h:project.room_height};
  state.customer={name:project.customer_name||'',email:project.customer_email||'',phone:project.customer_phone||''};
  document.getElementById('cust-name').value=state.customer.name;
  document.getElementById('cust-email').value=state.customer.email;
  document.getElementById('cust-phone').value=state.customer.phone;
  const tpl=KitchenTemplates[project.template]||KitchenTemplates.straight;
  state.currentWalls=tpl.walls;
  Object.keys(cabinetMeshes).forEach(cid=>removeCabinetMesh(cid));
  drawRoomWalls({h:project.room_height},tpl.walls);
  cabinets.forEach(cab=>addOrUpdateCabinetMesh(cab));
  rebuildWorktops(cabinets);
  renderCabinetList(); renderBomPanel(cabinets); renderProjectList();
  document.getElementById('project-title').textContent=project.name;
  document.getElementById('room-w').value=project.room_width;
  document.getElementById('room-d').value=project.room_depth;
  document.getElementById('room-h').value=project.room_height;
  refreshCanvas2D();
}
async function deleteProject(event,id){
  event.stopPropagation(); if(!confirm('Törlöd?')) return;
  await fetch(`${API}/projects/${id}`,{method:'DELETE'});
  if(state.currentProjectId===id){ state.currentProjectId=null; state.cabinets=[]; Object.keys(cabinetMeshes).forEach(cid=>removeCabinetMesh(cid)); document.getElementById('project-title').textContent='—'; document.getElementById('cabinet-list').innerHTML=''; document.getElementById('props-panel').innerHTML='<p class="empty-hint">Kattints egy szekrényre.</p>'; }
  await loadProjects();
}

async function updateRoom(){
  if(!state.currentProjectId) return;
  const w=+document.getElementById('room-w').value;
  const d=+document.getElementById('room-d').value;
  const h=+document.getElementById('room-h').value;
  await fetch(`${API}/projects/${state.currentProjectId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name:document.getElementById('project-title').textContent,
    template:state.template,
    room_width:w,room_depth:d,room_height:h,
    customer_name:state.customer?.name||'',
    customer_email:state.customer?.email||'',
    customer_phone:state.customer?.phone||''
  })});
  state.currentRoom={w,d,h};
  const tpl=KitchenTemplates[state.template]||KitchenTemplates.straight;
  drawRoomWalls({h},tpl.walls); refreshCanvas2D();
  showToast('✅ Szoba méret frissítve!');
}

async function addCabinet(type){
  if(!state.currentProjectId){alert('Előbb nyiss meg egy projektet!');return;}
  const def=CabinetDefaults[type]; const zOffset=state.cabinets.length*(def.w+20);
  await fetch(`${API}/cabinets`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({project_id:state.currentProjectId,type,x:0,z:zOffset,w:def.w,h:def.h,d:def.d,corpus_material:'white',front_material:'anthracite',shelves:def.shelves,label:CabinetTypeLabel[type],rotation:0})});
  await reloadCabinets();
}
async function reloadCabinets(){
  const res=await fetch(`${API}/projects/${state.currentProjectId}`);
  const {cabinets}=await res.json();
  state.cabinets=cabinets;
  cabinets.forEach(cab=>addOrUpdateCabinetMesh(cab));
  rebuildWorktops(cabinets);
  renderCabinetList(); renderBomPanel(cabinets); refreshCanvas2D();
}
function renderCabinetList(){
  const ul=document.getElementById('cabinet-list');
  ul.innerHTML=state.cabinets.length===0?'<li class="empty-hint">Adj hozzá szekrényt!</li>'
    :state.cabinets.map(c=>`<li class="cabinet-item ${c.id===state.selectedCabinetId?'selected':''}" onclick="selectCabinet('${c.id}')">
      <span>${getCabIcon(c.type)}</span><span class="cab-label">${c.label}</span><span class="cab-size">${c.w}×${c.h}</span>
      <button class="btn-icon danger" onclick="deleteCabinet(event,'${c.id}')">🗑</button></li>`).join('');
}
function getCabIcon(t){ return {base:'🟧',wall:'⬜',tall:'📦',drawer_base:'🗄️',corner_base:'📐'}[t]||'📦'; }
function selectCabinet(id){ state.selectedCabinetId=id; highlightCabinet(id); renderCabinetList(); const cab=state.cabinets.find(c=>c.id===id); if(cab) renderPropsPanel(cab); }
async function deleteCabinet(event,id){
  event.stopPropagation();
  await fetch(`${API}/cabinets/${id}`,{method:'DELETE'});
  removeCabinetMesh(id); state.cabinets=state.cabinets.filter(c=>c.id!==id);
  if(state.selectedCabinetId===id){ state.selectedCabinetId=null; document.getElementById('props-panel').innerHTML='<p class="empty-hint">Kattints egy szekrényre.</p>'; }
  rebuildWorktops(state.cabinets); renderCabinetList(); renderBomPanel(state.cabinets); refreshCanvas2D();
}

async function doSnapToWall(id){
  const cab=state.cabinets.find(c=>c.id===id); if(!cab) return;
  const tpl=KitchenTemplates[state.template]||KitchenTemplates.straight;
  const snapped=snapToNearestWall(cab,tpl.walls);
  Object.assign(cab,snapped);
  addOrUpdateCabinetMesh(cab);
  await fetch(`${API}/cabinets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cab)});
  renderPropsPanel(cab); refreshCanvas2D();
  showToast('🧲 Falra illesztve!');
}

function renderPropsPanel(cab){
  const panel=document.getElementById('props-panel');
  const matOpts=MaterialPresets.map(m=>`<option value="${m.key}" ${m.key===cab.corpus_material?'selected':''}>${m.label}</option>`).join('');
  const frtOpts=MaterialPresets.map(m=>`<option value="${m.key}" ${m.key===cab.front_material?'selected':''}>${m.label}</option>`).join('');
  panel.innerHTML=`
    <h3>✏️ ${cab.label}</h3>
    <div class="prop-group"><label>Megnevezés</label><input type="text" value="${cab.label}" onchange="updateProp('${cab.id}','label',this.value)"/></div>
    <div class="prop-row">
      <div class="prop-group"><label>Szél. (mm)</label><input type="number" min="200" max="1200" step="100" value="${cab.w}" onchange="updateProp('${cab.id}','w',+this.value)"/></div>
      <div class="prop-group"><label>Mag. (mm)</label><input type="number" min="300" max="2400" step="100" value="${cab.h}" onchange="updateProp('${cab.id}','h',+this.value)"/></div>
      <div class="prop-group"><label>Mél. (mm)</label><input type="number" min="200" max="800" step="50" value="${cab.d}" onchange="updateProp('${cab.id}','d',+this.value)"/></div>
    </div>
    <div class="prop-row">
      <div class="prop-group"><label>X poz.</label><input type="number" step="50" value="${cab.x}" onchange="updateProp('${cab.id}','x',+this.value)"/></div>
      <div class="prop-group"><label>Z poz.</label><input type="number" step="50" value="${cab.z}" onchange="updateProp('${cab.id}','z',+this.value)"/></div>
      <div class="prop-group"><label>Forgatás°</label><input type="number" min="0" max="270" step="90" value="${cab.rotation||0}" onchange="updateProp('${cab.id}','rotation',+this.value)"/></div>
    </div>
    <div class="prop-group"><label>Korpusz anyag</label><select onchange="updateProp('${cab.id}','corpus_material',this.value)">${matOpts}</select></div>
    <div class="prop-group"><label>Front szín</label><select onchange="updateProp('${cab.id}','front_material',this.value)">${frtOpts}</select></div>
    <div class="prop-group"><label>Polcok száma</label><input type="number" min="0" max="6" value="${cab.shelves}" onchange="updateProp('${cab.id}','shelves',+this.value)"/></div>
    <div class="prop-group"><label>Ajtó</label>
      <button class="${cab.door_open?'btn-open':'btn-closed'}" onclick="toggleDoorBtn('${cab.id}',${!cab.door_open})">${cab.door_open?'🚫 Bezárás':'🚪 Kinyitás'}</button></div>
    <button class="btn btn-block" style="margin-top:0.5rem" onclick="doSnapToWall('${cab.id}')">🧲 Falra illesztés</button>
    <div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(255,255,255,0.04);border-radius:6px;font-size:0.72rem;color:var(--text2)">
      ⌨️ ←→↑↓ mozgatás · <b>R</b> = 90° forgatás
    </div>
    <button class="btn-danger" onclick="deleteCabinet(event,'${cab.id}')">🗑 Törlés</button>`;
}

async function updateProp(id,prop,value){
  const cab=state.cabinets.find(c=>c.id===id); if(!cab) return;
  const old=cab[prop]; cab[prop]=value;
  if(['w','d','x','z','rotation'].includes(prop)&&checkCollision(cab,state.cabinets)){ cab[prop]=old; showToast('⚠️ ÜTKÖZÉS!'); renderPropsPanel(cab); return; }
  await fetch(`${API}/cabinets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cab)});
  addOrUpdateCabinetMesh(cab); rebuildWorktops(state.cabinets);
  renderBomPanel(state.cabinets); renderCabinetList(); renderPropsPanel(cab); refreshCanvas2D();
}
async function updateCabinetPosition(id,xmm,zmm,rot){
  const cab=state.cabinets.find(c=>c.id===id); if(!cab) return;
  cab.x=xmm; cab.z=zmm; if(rot!==undefined) cab.rotation=rot;
  await fetch(`${API}/cabinets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cab)});
  if(state.selectedCabinetId===id) renderPropsPanel(cab);
  refreshCanvas2D();
}
async function toggleDoorBtn(id,open){
  const cab=state.cabinets.find(c=>c.id===id); if(!cab) return;
  cab.door_open=open?1:0; toggleDoor(id,open);
  await fetch(`${API}/cabinets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cab)});
  renderPropsPanel(cab);
}
function selectTemplate(tpl){ state.template=tpl; document.querySelectorAll('.tpl-card').forEach(el=>el.classList.toggle('active',el.dataset.tpl===tpl)); }

// --- Ügyfél adatok ---
async function saveCustomer(){
  if(!state.currentProjectId) return;
  const name=document.getElementById('cust-name').value;
  const email=document.getElementById('cust-email').value;
  const phone=document.getElementById('cust-phone').value;
  state.customer={name,email,phone};
  const res=await fetch(`${API}/projects/${state.currentProjectId}`);
  const {project}=await res.json();
  await fetch(`${API}/projects/${state.currentProjectId}`,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name:project.name,
      template:project.template,
      room_width:project.room_width,
      room_depth:project.room_depth,
      room_height:project.room_height,
      customer_name:name,
      customer_email:email,
      customer_phone:phone
    })
  });
  showToast('✅ Ügyfél adatok mentve');
}

// --- PDF EXPORT (HTML -> új ablak) ---
function openOfferView(){
  if(!state.currentProjectId){ showToast('Előbb nyiss meg egy projektet'); return; }
  const url=`${API}/projects/${state.currentProjectId}/offer`;
  window.open(url,'_blank');
}
