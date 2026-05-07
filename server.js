const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

const db = new sqlite3.Database('./kitchen.db');

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS projects(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    room_width INTEGER NOT NULL,
    room_depth INTEGER NOT NULL,
    room_height INTEGER NOT NULL,
    customer_name TEXT DEFAULT '',
    customer_email TEXT DEFAULT '',
    customer_phone TEXT DEFAULT ''
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS cabinets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    x INTEGER NOT NULL,
    z INTEGER NOT NULL,
    w INTEGER NOT NULL,
    h INTEGER NOT NULL,
    d INTEGER NOT NULL,
    corpus_material TEXT NOT NULL,
    front_material TEXT NOT NULL,
    shelves INTEGER NOT NULL,
    label TEXT NOT NULL,
    rotation INTEGER DEFAULT 0,
    door_open INTEGER DEFAULT 0,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`);
});

// --- API ---
app.get('/api/projects',(req,res)=>{
  db.all('SELECT * FROM projects ORDER BY id DESC',(err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

app.post('/api/projects',(req,res)=>{
  const {name,template,room_width,room_depth,room_height,customer_name,customer_email,customer_phone} = req.body;
  db.run(`INSERT INTO projects(name,template,room_width,room_depth,room_height,customer_name,customer_email,customer_phone)
          VALUES(?,?,?,?,?,?,?,?)`,
    [name,template,room_width,room_depth,room_height,customer_name||'',customer_email||'',customer_phone||''],
    function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({id:this.lastID});
    }
  );
});

app.get('/api/projects/:id',(req,res)=>{
  const id=req.params.id;
  db.get('SELECT * FROM projects WHERE id=?',[id],(err,project)=>{
    if(err||!project) return res.status(404).json({error:'Not found'});
    db.all('SELECT * FROM cabinets WHERE project_id=? ORDER BY id',[id],(err2,cabinets)=>{
      if(err2) return res.status(500).json({error:err2.message});
      res.json({project,cabinets});
    });
  });
});

app.put('/api/projects/:id',(req,res)=>{
  const id=req.params.id;
  const {name,template,room_width,room_depth,room_height,customer_name,customer_email,customer_phone} = req.body;
  db.run(`UPDATE projects SET name=?,template=?,room_width=?,room_depth=?,room_height=?,customer_name=?,customer_email=?,customer_phone=? WHERE id=?`,
    [name,template,room_width,room_depth,room_height,customer_name||'',customer_email||'',customer_phone||'',id],
    function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({updated:this.changes});
    }
  );
});

app.delete('/api/projects/:id',(req,res)=>{
  const id=req.params.id;
  db.run('DELETE FROM cabinets WHERE project_id=?',[id],()=>{
    db.run('DELETE FROM projects WHERE id=?',[id],function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({deleted:this.changes});
    });
  });
});

app.post('/api/cabinets',(req,res)=>{
  const {project_id,type,x,z,w,h,d,corpus_material,front_material,shelves,label,rotation} = req.body;
  db.run(`INSERT INTO cabinets(project_id,type,x,z,w,h,d,corpus_material,front_material,shelves,label,rotation,door_open)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [project_id,type,x,z,w,h,d,corpus_material,front_material,shelves,label,rotation||0],
    function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({id:this.lastID});
    }
  );
});

app.put('/api/cabinets/:id',(req,res)=>{
  const id=req.params.id;
  const {type,x,z,w,h,d,corpus_material,front_material,shelves,label,rotation,door_open} = req.body;
  db.run(`UPDATE cabinets SET type=?,x=?,z=?,w=?,h=?,d=?,corpus_material=?,front_material=?,shelves=?,label=?,rotation=?,door_open=? WHERE id=?`,
    [type,x,z,w,h,d,corpus_material,front_material,shelves,label,rotation||0,door_open?1:0,id],
    function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({updated:this.changes});
    }
  );
});

app.delete('/api/cabinets/:id',(req,res)=>{
  const id=req.params.id;
  db.run('DELETE FROM cabinets WHERE id=?',[id],function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({deleted:this.changes});
  });
});

// --- Árajánlat HTML nézet ---
app.get('/api/projects/:id/offer',(req,res)=>{
  const id=req.params.id;
  db.get('SELECT * FROM projects WHERE id=?',[id],(err,project)=>{
    if(err||!project) return res.status(404).send('Projekt nem található');
    db.all('SELECT * FROM cabinets WHERE project_id=? ORDER BY id',[id],(err2,cabs)=>{
      if(err2) return res.status(500).send('Hiba a szekrények lekérdezésekor');
      const total = cabs.reduce((s,c)=>s+calcCabinetBom(c).totalPrice,0);
      const rows = cabs.map(c=>{
        const bom=calcCabinetBom(c);
        return `<tr>
          <td>${c.label}</td>
          <td>${c.w}×${c.h}×${c.d}</td>
          <td>${c.type}</td>
          <td>${c.corpus_material}/${c.front_material}</td>
          <td style="text-align:right">${Math.round(bom.totalPrice).toLocaleString('hu-HU')} Ft</td>
        </tr>`;
      }).join('');
      const html=`<!DOCTYPE html><html lang="hu"><head><meta charset="UTF-8" />
        <title>Árajánlat - ${project.name}</title>
        <style>
          body{font-family:Segoe UI,system-ui,sans-serif;background:#f5f5f5;color:#222;margin:0;padding:2rem;}
          h1{margin-top:0;}
          .wrap{max-width:900px;margin:0 auto;background:#fff;padding:1.5rem 2rem;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.08);} 
          table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:0.9rem;}
          th,td{padding:0.4rem 0.5rem;border-bottom:1px solid #e0e0e0;}
          th{text-align:left;background:#fafafa;font-weight:600;}
          .total{margin-top:1rem;font-size:1.1rem;font-weight:700;text-align:right;}
          .meta{font-size:0.85rem;color:#666;margin-top:0.3rem;}
        </style></head><body>
        <div class="wrap">
          <h1>Árajánlat – ${project.name}</h1>
          <div class="meta">Ügyfél: ${project.customer_name||'-'} &nbsp;•&nbsp; Email: ${project.customer_email||'-'} &nbsp;•&nbsp; Telefon: ${project.customer_phone||'-'}</div>
          <div class="meta">Szoba: ${project.room_width} × ${project.room_depth} × ${project.room_height} mm</div>
          <table>
            <thead><tr><th>Elem</th><th>Méret (Sz×M×Mé)</th><th>Típus</th><th>Anyag / front</th><th>Ár</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Végösszeg: ${Math.round(total).toLocaleString('hu-HU')} Ft (áfát nem tartalmaz)</div>
        </div></body></html>`;
      res.send(html);
    });
  });
});

// --- BOM számítás ugyanaz mint client oldalon ---
const PRICE_CORPUS=18000, PRICE_FRONT=12000, PRICE_BACK=4000;
const BOARD_T=0.018, BACK_T=0.008;
function calcCabinetBom(cab){
  const W=cab.w/1000, H=cab.h/1000, D=cab.d/1000, T=BOARD_T;
  const panels=[
    {name:'Bal oldallap', w:D, h:H},
    {name:'Jobb oldallap',w:D, h:H},
    {name:'Tetőlap',      w:W-2*T, h:D},
    {name:'Fenéklap',     w:W-2*T, h:D},
    {name:'Hátfal',       w:W-2*T, h:H-2*T, isBack:true}
  ];
  for(let i=0;i<(cab.shelves||0);i++) panels.push({name:'Polc '+(i+1),w:W-2*T-0.004,h:D-0.02});
  let corpusArea=0, backArea=0;
  panels.forEach(p=>{ if(p.isBack) backArea+=p.w*p.h; else corpusArea+=p.w*p.h; });
  const frontArea=W*H;
  const corpusPrice=corpusArea*PRICE_CORPUS;
  const frontPrice=frontArea*PRICE_FRONT;
  const backPrice=backArea*PRICE_BACK;
  return {totalPrice:corpusPrice+frontPrice+backPrice};
}

const PORT=3000;
app.listen(PORT,()=>console.log('Server running on http://localhost:'+PORT));
