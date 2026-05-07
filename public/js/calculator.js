function renderBomPanel(cabinets){
  const div=document.getElementById('bom-panel'); if(!div) return;
  if(!cabinets||cabinets.length===0){ div.innerHTML='<p class="empty-hint">Nincs székrény a projektben.</p>'; return; }
  let html='<h3 style="color:var(--accent);margin-bottom:1rem">📋 Darabjegyzék &amp; Árak</h3>';
  let grand=0;
  cabinets.forEach(cab=>{
    const bom=calcCabinetBom(cab); grand+=bom.totalPrice;
    html+=`<div class="bom-cabinet">
      <div class="bom-cabinet-title">${cab.label} &nbsp;<small style="color:var(--text2)">${cab.w}×${cab.h}×${cab.d} mm</small></div>
      <table class="bom-table"><thead><tr><th>Alkatrész</th><th>Méret (mm)</th></tr></thead><tbody>
      ${bom.panels.map(p=>`<tr><td>${p.name}</td><td>${Math.round(p.w*1000)} × ${Math.round(p.h*1000)}</td></tr>`).join('')}
      </tbody></table>
      <div class="bom-prices">
        <span>Korpusz: <b>${Math.round(bom.corpusPrice).toLocaleString('hu-HU')} Ft</b></span>
        <span>Front: <b>${Math.round(bom.frontPrice).toLocaleString('hu-HU')} Ft</b></span>
        <span>Összesen: <b>${Math.round(bom.totalPrice).toLocaleString('hu-HU')} Ft</b></span>
      </div></div>`;
  });
  html+=`<div class="bom-grand-total">TELJES ÖSSZEG: ${Math.round(grand).toLocaleString('hu-HU')} Ft</div>`;
  div.innerHTML=html;
}
