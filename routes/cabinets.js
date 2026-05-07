const express = require('express');
const router = express.Router();
const { load, save } = require('../data/db');
const { v4: uuidv4 } = require('uuid');

// Szekrény hozzáadása
router.post('/', (req, res) => {
  const data = load();
  const { project_id, type, x, z, w, h, d, corpus_material, front_material, shelves, label } = req.body;
  const cabinet = {
    id: uuidv4(),
    project_id,
    type: type || 'base',
    x: x || 0,
    z: z || 0,
    w: w || 600,
    h: h || 720,
    d: d || 560,
    corpus_material: corpus_material || 'white',
    front_material: front_material || 'anthracite',
    shelves: shelves !== undefined ? shelves : 1,
    door_open: 0,
    label: label || 'Szekrény'
  };
  data.cabinets.push(cabinet);
  save(data);
  res.json({ id: cabinet.id });
});

// Szekrény frissítése
router.put('/:id', (req, res) => {
  const data = load();
  const idx = data.cabinets.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nem található' });
  data.cabinets[idx] = { ...data.cabinets[idx], ...req.body };
  save(data);
  res.json({ ok: true });
});

// Szekrény törlése
router.delete('/:id', (req, res) => {
  const data = load();
  data.cabinets = data.cabinets.filter(c => c.id !== req.params.id);
  save(data);
  res.json({ ok: true });
});

module.exports = router;
