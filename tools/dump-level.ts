import { at, loadLevel } from '../src/core/level';
import { Tile } from '../src/core/types';
import { CAMPAIGNS } from '../src/levels';

const c = CAMPAIGNS.find((x) => x.id === process.argv[2])!;
const i = Number(process.argv[3] ?? 0);
const s = loadLevel(c.levels[i]);
console.log(`${c.name} / ${c.levels[i].name}  ${s.width}x${s.height}  start=(${s.x},${s.y}) ${s.facing}  gems=${s.gemsTotal}`);
for (let y = 0; y < s.height; y++) {
  let row = '';
  for (let x = 0; x < s.width; x++) {
    if (x === s.x && y === s.y) { row += '@'; continue; }
    const t = at(s, x, y);
    row += t === Tile.Wall ? '#' : t === Tile.Block ? 'o' : t === Tile.Gem ? '*' : t === Tile.Door ? 'D' : '.';
  }
  console.log(`  ${String(y).padStart(2)} ${row}`);
}
