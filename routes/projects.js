const express = require('express');
const router = express.Router();
const { load, save } = require('../data/db');
const { v4: uuidv4 } = require('uuid');

// Összes projekt
router.get('/', (req, res) => {
  const data = load();
  const sorted = [...data.projects].sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  res.json(sorted);
});

// Új projekt
router.post('/', (req, res) => {
  const data = load();
  const { name, template, room_width, room_depth, room_height } = req.body;
  const now = new Date().toISOString();
  const project = {
    id: uuidv4(),
    name: name || 'Új projekt',
    template: template || 'straight',
    room_width: room_width || 3600,
    room_depth: room_depth || 2800,
    room_height: room_height || 2700,
    created_at: now,
    updated_at: now
  };
  data.projects.push(project);
  save(data);
  res.json({ id: project.id });
});

// Projekt betöltése
router.get('/:id', (req, res) => {
  const data = load();
  const project = data.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Nem található' });
  const cabinets = data.cabinets.filter(c => c.project_id === req.params.id);
  res.json({ project, cabinets });
});

// Projekt frissítése
router.put('/:id', (req, res) => {
  const data = load();
  const idx = data.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nem található' });
  data.projects[idx] = { ...data.projects[idx], ...req.body, updated_at: new Date().toISOString() };
  save(data);
  res.json({ ok: true });
});

// Projekt törlése
router.delete('/:id', (req, res) => {
  const data = load();
  data.projects = data.projects.filter(p => p.id !== req.params.id);
  data.cabinets = data.cabinets.filter(c => c.project_id !== req.params.id);
  save(data);
  res.json({ ok: true });
});

module.exports = router;
