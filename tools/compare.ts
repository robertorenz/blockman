/**
 * Are the Block Dude levels actually copies of Block-Man rooms?
 *
 * Padding walls differ between the two sources, so compare the puzzle content
 * instead: take Block-Man's start cell as the origin and compare the relative
 * offsets of every movable block and the door.
 */
import { at, loadLevel } from '../src/core/level';
import { Tile, type LevelDef } from '../src/core/types';
import { BLOCKMAN_LEVELS } from '../src/levels/blockman';
import { LEVELS } from '../src/levels/levels';

function signature(def: LevelDef) {
  const s = loadLevel(def);
  const blocks: string[] = [];
  let door = '';
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const t = at(s, x, y);
      if (t === Tile.Block) blocks.push(`${x - s.x},${y - s.y}`);
      if (t === Tile.Door) door = `${x - s.x},${y - s.y}`;
    }
  }
  return { blocks: blocks.sort().join(' '), door, n: blocks.length };
}

function overlap(a: string, b: string) {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  let hit = 0;
  for (const v of A) if (B.has(v)) hit++;
  return { hit, union: new Set([...A, ...B]).size };
}

for (let i = 0; i < BLOCKMAN_LEVELS.length; i++) {
  const bm = signature(BLOCKMAN_LEVELS[i]);
  const scored = LEVELS.map((l, j) => {
    const bd = signature(l);
    const o = overlap(bm.blocks, bd.blocks);
    return { j, name: l.name, jac: o.union ? o.hit / o.union : 0, doorSame: bd.door === bm.door, bdN: bd.n };
  }).sort((a, b) => b.jac - a.jac);

  console.log(`${BLOCKMAN_LEVELS[i].name} (${bm.n} blocks, door ${bm.door}):`);
  for (const s of scored.slice(0, 3)) {
    console.log(
      `    BD ${String(s.j + 1).padStart(2)} ${s.name.padEnd(18)} blocks match ${(s.jac * 100).toFixed(0)}%` +
        `  door ${s.doorSame ? 'SAME' : 'diff'}  (${s.bdN} blocks)`,
    );
  }
}
