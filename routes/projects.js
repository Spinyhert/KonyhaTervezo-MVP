const express = require("express");
const router = express.Router();
const { getDb } = require("../data/db");
const { v4: uuidv4 } = require("uuid");

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const { name, template, room_width, room_depth, room_height } = req.body;
  db.prepare(`INSERT INTO projects (id,name,template,room_width,room_depth,room_height)
    VALUES (?,?,?,?,?,?)`).run(id, name || "Új projekt", template || "straight",
    room_width || 3600, room_depth || 2800, room_height || 2700);
  res.json({ id });
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id=?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Nem található" });
  const cabinets = db.prepare("SELECT * FROM cabinets WHERE project_id=?").all(req.params.id);
  res.json({ project, cabinets });
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const { name, template, room_width, room_depth, room_height } = req.body;
  db.prepare(`UPDATE projects SET name=?,template=?,room_width=?,room_depth=?,room_height=?,
    updated_at=datetime('now') WHERE id=?`)
    .run(name, template, room_width, room_depth, room_height, req.params.id);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM cabinets WHERE project_id=?").run(req.params.id);
  db.prepare("DELETE FROM projects WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
