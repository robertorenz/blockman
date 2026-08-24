import fs from 'node:fs';

const src = fs.readFileSync('level.c', 'utf8');

// Grab every `uint8_t map_N[] = { ... };`
const maps = {};
for (const m of src.matchAll(/uint8_t\s+map_(\d+)\[\]\s*=\s*\{([\s\S]*?)\};/g)) {
  maps[m[1]] = m[2].split(',').map(s => s.trim()).filter(s => s.length).map(Number);
}

// Grab every `struct level level_N = { w, h, x, y, map_N };`
const metas = {};
for (const m of src.matchAll(/struct\s+level\s+level_(\d+)\s*=\s*\{([\s\S]*?)\};/g)) {
  const parts = m[2].split(',').map(s => s.trim()).filter(s => s.length);
  metas[m[1]] = { w: +parts[0], h: +parts[1], sx: +parts[2], sy: +parts[3] };
}

const CH = { 0: '.', 1: '#', 2: 'o', 3: 'D' };
const out = [];

for (const id of Object.keys(metas).sort((a, b) => +a - +b)) {
  const { w, h, sx, sy } = metas[id];
  const data = maps[id];
  const expected = w * h;
  const status = data.length === expected ? 'OK' : `MISMATCH have=${data.length} want=${expected}`;

  const rows = [];
  for (let y = 0; y < h; y++) {
    rows.push(Array.from({ length: w }, (_, x) => CH[data[y * w + x] ?? 0] ?? '.').join(''));
  }

  // locate door + sanity-check the start cell
  let door = null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] === 'D') door = { x, y };
  const startTile = rows[sy]?.[sx];

  out.push({ id: +id, w, h, sx, sy, startTile, door, status, rows });
}

for (const L of out) {
  console.log(`--- level ${L.id}  ${L.w}x${L.h}  start=(${L.sx},${L.sy}) tile='${L.startTile}'  door=${L.door ? `(${L.door.x},${L.door.y})` : 'NONE'}  ${L.status}`);
  L.rows.forEach((r, i) => console.log(String(i).padStart(2) + ' ' + r));
}

fs.writeFileSync('parsed.json', JSON.stringify(out, null, 2));
