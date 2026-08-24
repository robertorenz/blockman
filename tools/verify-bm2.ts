/**
 * Re-verify the Block-Man 2 campaign with breadth-first search and report where
 * the recorded par disagrees with the true optimum.
 *
 * The extreme tier is generated with a directed search, which finds *a* route
 * rather than the shortest, so its recorded par and lift count can overstate
 * the real difficulty. Anything BFS can close should carry the optimal figures.
 */
import { cloneState, loadLevel } from '../src/core/level';
import { grabOrDrop, move } from '../src/core/rules';
import { Tile, type GameState, type LevelDef } from '../src/core/types';
import { BLOCKMAN2_LEVELS } from '../src/levels/blockman2';

const ACTIONS = ['left', 'right', 'grab'] as const;

function key(s: GameState): string {
  let b = '';
  let g = '';
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === Tile.Block) b += i.toString(36) + ',';
    else if (s.tiles[i] === Tile.Gem) g += i.toString(36) + ',';
  }
  return `${s.x}|${s.y}|${s.facing[0]}|${s.carrying ? 1 : 0}|${b}|${g}`;
}

function bfs(def: LevelDef, cap: number) {
  const start = loadLevel(def);
  const seen = new Set([key(start)]);
  let frontier = [{ s: start, lifts: 0 }];
  let states = 0;
  while (frontier.length && states < cap) {
    const next: typeof frontier = [];
    for (const n of frontier) {
      if (++states >= cap) return null;
      for (const a of ACTIONS) {
        const c = cloneState(n.s);
        const r = a === 'grab' ? grabOrDrop(c) : move(c, a);
        if (r.kind === 'none') continue;
        const k = key(c);
        if (seen.has(k)) continue;
        seen.add(k);
        const lifts = n.lifts + (r.kind === 'pickup' ? 1 : 0);
        if (c.won) return { moves: c.moves, lifts };
        next.push({ s: c, lifts });
      }
    }
    frontier = next;
  }
  return null;
}

const CAP = Number(process.argv[2] ?? 1_500_000);
let wrong = 0;
const fixes: string[] = [];
for (const l of BLOCKMAN2_LEVELS) {
  const r = bfs(l, CAP);
  if (!r) {
    console.log(`  ${l.name.padEnd(26)} ${String(l.tier).padEnd(8)} par ${l.par} lifts ${l.lifts}  -> BFS capped, keeping directed-search figures`);
    continue;
  }
  const ok = r.moves === l.par && r.lifts === l.lifts;
  if (!ok) wrong++;
  console.log(
    `  ${l.name.padEnd(26)} ${String(l.tier).padEnd(8)} recorded par ${String(l.par).padStart(3)} lifts ${l.lifts}` +
      `  optimal par ${String(r.moves).padStart(3)} lifts ${r.lifts}  ${ok ? '' : '<-- WRONG'}`,
  );
  if (!ok) fixes.push(`${l.name}\t${r.moves}\t${r.lifts}`);
}
console.log(`\n${wrong} of ${BLOCKMAN2_LEVELS.length} have an incorrect recorded par/lifts`);
if (fixes.length) {
  console.log('\nname\toptimal_par\toptimal_lifts');
  for (const f of fixes) console.log(f);
}
