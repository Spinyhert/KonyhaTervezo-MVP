const API='http://localhost:3000/api';
let state={ projects:[], currentProjectId:null, cabinets:[], selectedCabinetId:null, template:'straight' };

document.addEventListener('DOMContentLoaded',async()=>{
  init3D();
  await loadProjects();
});

async function loadProjects(){
  const res=await fetch(`${API}/projects`);
  state.projects=await res.json();
  renderProjectList();
}

function renderProjectList(){
  const ul=document.getElementById('project-list');
  ul.innerHTML=state.projects.length===0
    ?'<li class="empty-hint">Még nincs projekt.</li>'
    :state.projects.map(p=>`
      <li class="project-item ${p.id===state.currentProjectId?'active':''}" onclick="openProject('${p.id}')">
        <span class="proj-name">${p.name}</span>
        <button class="btn-icon danger" onclick="deleteProject(event,'${p.id}')">&#x1F5D1;</button>
      </li>`).join('');
}

async function createProject(){
  const tpl=state.template;
  const tplData=KitchenTemplates[tpl];
  const name=prompt('Projekt neve:',`Új konyha - ${tplData.label}`);
  if(!name) return;
  const res=await fetch(`${API}/projects`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,template:tpl,room_width:tplData.room.w,room_depth:tplData.room.d,room_height:tplData.room.h})
  });
  const {id}=await res.json();
  await loadProjects();
  await openProject(id);
}

async function openProject(id){
  const res=await fetch(`${API}/projects/${id}`);
  const {project,cabinets}=await res.json();
  state.currentProjectId=id;
  state.cabinets=cabinets;
  state.template=project.template;
  Object.keys(cabinetMeshes).forEach(cid=>removeCabinetMesh(cid));
  const tpl=KitchenTemplates[project.template]||KitchenTemplates.straight;
  drawRoomWalls({h:project.room_height},tpl.walls);
  cabinets.forEach(cab=>addOrUpdateCabinetMesh(cab));
  renderCabinetList();
  renderBomPanel(cabinets);
  renderProjectList();
  document.getElementById('project-title').textContent=project.name;
}

async function deleteProject(event,id){
  event.stopPropagation();
  if(!confirm('Törlöd a projektet?')) return;
  await fetch(`${API}/projects/${id}`,{method:'DELETE'});
  if(state.currentProjectId===id){
    state.currentProjectId=null; state.cabinets=[];
    Object.keys(cabinetMeshes).forEach(cid=>removeCabinetMesh(cid));
    document.getElementById('project-title').textContent='—';
    document.getElementById('cabinet-list').innerHTML='';
    document.getElementById('props-panel').innerHTML='<p class="empty-hint">Kattints egy szekrényre.</p>';
  }
  await loadProjects();
}

async function addCabinet(type){
  if(!state.currentProjectId){alert('Előbb nyiss meg egy projektet!');return;}
  const def=CabinetDefaults[type];
  const zOffset=state.cabinets.length*(def.w+20);
  const res=await fetch(`${API}/cabinets`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({project_id:state.currentProjectId,type,x:0,z:zOffset,
      w:def.w,h:def.h,d:def.d,corpus_material:'white',front_material:'anthracite',
      shelves:def.shelves,label:CabinetTypeLabel[type]})
  });
  const {id}=await res.json();
  await reloadCabinets();
}

async function reloadCabinets(){
  const res=await fetch(`${API}/projects/${state.currentProjectId}`);
  const {cabinets}=await res.json();
  state.cabinets=cabinets;
  cabinets.forEach(cab=>addOrUpdateCabinetMesh(cab));
  renderCabinetList();
  renderBomPanel(cabinets);
}

function renderCabinetList(){
  const ul=document.getElementById('cabinet-list');
  ul.innerHTML=state.cabinets.length===0
    ?'<li class="empty-hint">Adj hozzá szekrényt!</li>'
    :state.cabinets.map(c=>`
      <li class="cabinet-item ${c.id===state.selectedCabinetId?'selected':''}" onclick="selectCabinet('${c.id}')">
        <span>${getCabIcon(c.type)}</span>
        <span class="cab-label">${c.label}</span>
        <span class="cab-size">${c.w}×${c.h}</span>
        <button class="btn-icon danger" onclick="deleteCabinet(event,'${c.id}')">&#x1F5D1;</button>
      </li>`).join('');
}

function getCabIcon(t){ return {base:'🟧',wall:'⬜',tall:'📦',drawer_base:'🗄️',corner_base:'📐'}[t]||'📦'; }

function selectCabinet(id){
  state.selectedCabinetId=id;
  highlightCabinet(id);
  renderCabinetList();
  const cab=state.cabinets.find(c=>c.id===id);
  if(cab) renderPropsPanel(cab);
}

async function deleteCabinet(event,id){
  event.stopPropagation();
  await fetch(`${API}/cabinets/${id}`,{method:'DELETE'});
  removeCabinetMesh(id);
  state.cabinets=state.cabinets.filter(c=>c.id!==id);
  if(state.selectedCabinetId===id){
    state.selectedCabinetId=null;
    document.getElementById('props-panel').innerHTML='<p class="empty-hint">Kattints egy szekrényre.</p>';
  }
  renderCabinetList();
  renderBomPanel(state.cabinets);
}

function renderPropsPanel(cab){
  const panel=document.getElementById('props-panel');
  const matOpts=MaterialPresets.map(m=>`<option value="${m.key}" ${m.key===cab.corpus_material?'selected':''}>${m.label}</option>`).join('');
  const frtOpts=MaterialPresets.map(m=>`<option value="${m.key}" ${m.key===cab.front_material?'selected':''}>${m.label}</option>`).join('');
  panel.innerHTML=`
    <h3>✏️ ${cab.label}</h3>
    <div class="prop-group"><label>Megnevezés</label>
      <input type="text" value="${cab.label}" onchange="updateProp('${cab.id}','label',this.value)"/></div>
    <div class="prop-row">
      <div class="prop-group"><label>Szélesség</label>
        <input type="number" min="200" max="1200" step="100" value="${cab.w}" onchange="updateProp('${cab.id}','w',+this.value)"/></div>
      <div class="prop-group"><label>Magasság</label>
        <input type="number" min="300" max="2400" step="100" value="${cab.h}" onchange="updateProp('${cab.id}','h',+this.value)"/></div>
      <div class="prop-group"><label>Mélység</label>
        <input type="number" min="200" max="800" step="50" value="${cab.d}" onchange="updateProp('${cab.id}','d',+this.value)"/></div>
    </div>
    <div class="prop-row">
      <div class="prop-group"><label>X poz. (mm)</label>
        <input type="number" step="50" value="${cab.x}" onchange="updateProp('${cab.id}','x',+this.value)"/></div>
      <div class="prop-group"><label>Z poz. (mm)</label>
        <input type="number" step="50" value="${cab.z}" onchange="updateProp('${cab.id}','z',+this.value)"/></div>
    </div>
    <div class="prop-group"><label>Korpusz anyag</label>
      <select onchange="updateProp('${cab.id}','corpus_material',this.value)">${matOpts}</select></div>
    <div class="prop-group"><label>Front szín</label>
      <select onchange="updateProp('${cab.id}','front_material',this.value)">${frtOpts}</select></div>
    <div class="prop-group"><label>Polcok száma</label>
      <input type="number" min="0" max="6" value="${cab.shelves}" onchange="updateProp('${cab.id}','shelves',+this.value)"/></div>
    <div class="prop-group"><label>Ajtó</label>
      <button class="${cab.door_open?'btn-open':'btn-closed'}" onclick="toggleDoorBtn('${cab.id}',${!cab.door_open})">
        ${cab.door_open?'🚷 Ajtó bezárása':'🚪 Ajtó kinyitása'}</button></div>
    <button class="btn-danger" onclick="deleteCabinet(event,'${cab.id}')">&#x1F5D1; Szekrény törlése</button>
  `;
}

async function updateProp(id,prop,value){
  const cab=state.cabinets.find(c=>c.id===id); if(!cab) return;
  cab[prop]=value;
  await fetch(`${API}/cabinets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cab)});
  addOrUpdateCabinetMesh(cab);
  renderBomPanel(state.cabinets);
  renderCabinetList();
}

async function toggleDoorBtn(id,open){
  const cab=state.cabinets.find(c=>c.id===id); if(!cab) return;
  cab.door_open=open?1:0;
  toggleDoor(id,open);
  await fetch(`${API}/cabinets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cab)});
  renderPropsPanel(cab);
}

function selectTemplate(tpl){
  state.template=tpl;
  document.querySelectorAll('.tpl-card').forEach(el=>el.classList.toggle('active',el.dataset.tpl===tpl));
}
