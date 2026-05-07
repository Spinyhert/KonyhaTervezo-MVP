const express = require("express");
const router = express.Router();
const { getDb } = require("../data/db");
const { v4: uuidv4 } = require("uuid");

router.post("/", (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const { project_id, type, x, z, w, h, d, corpus_material, front_material, shelves, label } = req.body;
  db.prepare(`INSERT INTO cabinets (id,project_id,type,x,z,w,h,d,corpus_material,front_material,shelves,label)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, project_id, type||"base", x||0, z||0, w||600, h||720, d||560,
      corpus_material||"white", front_material||"anthracite", shelves||1, label||"Szekrény");
  res.json({ id });
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const { x, z, w, h, d, corpus_material, front_material, shelves, door_open, label } = req.body;
  db.prepare(`UPDATE cabinets SET x=?,z=?,w=?,h=?,d=?,corpus_material=?,front_material=?,
    shelves=?,door_open=?,label=? WHERE id=?`)
    .run(x, z, w, h, d, corpus_material, front_material, shelves, door_open ? 1 : 0, label, req.params.id);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM cabinets WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
