// Pure JavaScript adattárolás - JSON fájlba ment, semmi fordítás nem kell!
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'konyhatervezo.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const empty = { projects: [], cabinets: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch(e) {
    return { projects: [], cabinets: [] };
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function init() {
  load(); // létrehozza a fájlt ha nincs
  console.log('✅ Adatbázis kész:', DB_PATH);
}

module.exports = { load, save, init };
