const CabinetType = { BASE:'base', WALL:'wall', TALL:'tall', DRAWER_BASE:'drawer_base', CORNER_BASE:'corner_base' };
const CabinetTypeLabel = { base:'Alsó szekrény', wall:'Felső szekrény', tall:'Magasszekrény', drawer_base:'Fiókos szekrény', corner_base:'Sarokszekrény' };
const CabinetDefaults = {
  base:        { w:600, h:720,  d:560, shelves:1 },
  wall:        { w:600, h:720,  d:350, shelves:2 },
  tall:        { w:600, h:2100, d:560, shelves:3 },
  drawer_base: { w:600, h:720,  d:560, shelves:0 },
  corner_base: { w:900, h:720,  d:900, shelves:1 }
};
const MaterialPresets = [
  { key:'white',      label:'Fehér',      hex:'#F5F5F0' },
  { key:'anthracite', label:'Antracit',   hex:'#3A3A3A' },
  { key:'oak',        label:'Tölgy',      hex:'#B8860B' },
  { key:'walnut',     label:'Dió',        hex:'#5C4033' },
  { key:'grey',       label:'Szürke',     hex:'#8A8A8A' },
  { key:'cream',      label:'Krém',       hex:'#F0E8D0' },
  { key:'navy',       label:'Sötétkék',   hex:'#1B2A4A' },
  { key:'sage',       label:'Zsálya',     hex:'#7C9A7E' },
  { key:'terracotta', label:'Terrakotta', hex:'#C4704F' },
  { key:'concrete',   label:'Beton',      hex:'#A0A0A0' }
];
function getMaterialHex(key) {
  const m = MaterialPresets.find(m => m.key === key);
  return m ? m.hex : '#F5F5F0';
}
const KitchenTemplates = {
  straight: { label:'Egyenes konyha', room:{w:4000,d:2800,h:2700}, walls:[{x1:0,z1:0,x2:4000,z2:0}] },
  l_shape:  { label:'L-alakú konyha',  room:{w:4000,d:3500,h:2700}, walls:[{x1:0,z1:0,x2:4000,z2:0},{x1:0,z1:0,x2:0,z2:3000}] },
  u_shape:  { label:'U-alakú konyha',  room:{w:3600,d:3500,h:2700}, walls:[{x1:0,z1:0,x2:3600,z2:0},{x1:0,z1:0,x2:0,z2:3000},{x1:3600,z1:0,x2:3600,z2:3000}] },
  island:   { label:'Szigetes konyha', room:{w:5000,d:4000,h:2700}, walls:[{x1:0,z1:0,x2:5000,z2:0},{x1:0,z1:0,x2:0,z2:3500}] }
};
const PRICE_CORPUS=18000, PRICE_FRONT=12000, PRICE_BACK=4000;
const BOARD_T=0.018, BACK_T=0.008;
function calcCabinetBom(cab) {
  const W=cab.w/1000, H=cab.h/1000, D=cab.d/1000, T=BOARD_T;
  const panels=[
    {name:'Bal oldallap', w:D, h:H},
    {name:'Jobb oldallap',w:D, h:H},
    {name:'Tétőlap',     w:W-2*T, h:D},
    {name:'Fénéklap',    w:W-2*T, h:D},
    {name:'Hátfal',      w:W-2*T, h:H-2*T, isBack:true}
  ];
  for(let i=0;i<(cab.shelves||0);i++) panels.push({name:'Polc '+(i+1),w:W-2*T-0.004,h:D-0.02});
  let corpusArea=0, backArea=0;
  panels.forEach(p=>{ if(p.isBack) backArea+=p.w*p.h; else corpusArea+=p.w*p.h; });
  const frontArea=W*H;
  const corpusPrice=corpusArea*PRICE_CORPUS, frontPrice=frontArea*PRICE_FRONT, backPrice=backArea*PRICE_BACK;
  return {panels,corpusArea,frontArea,backArea,corpusPrice,frontPrice,backPrice,totalPrice:corpusPrice+frontPrice+backPrice};
}
function calcProjectTotal(cabinets) {
  return cabinets.reduce((s,c)=>s+calcCabinetBom(c).totalPrice,0);
}
