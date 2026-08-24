/**
 * Generates the "New Block-Man 2 Levels" campaign.
 *
 * Hand-designing these is unreliable - it is very easy to draw a room that
 * cannot actually be solved. So instead: generate candidates from a seeded
 * PRNG, run the real rule functions through a breadth-first solver, keep only
 * chambers that are provably escapable, and band them by difficulty. Every
 * level that ships has been solved by machine before being emitted.
 *
 * Terrain is a skyline: each column carries a stack of bricks, and Block-Man
 * walks along the top of it. That is what makes the puzzle, because the step
 * between neighbouring columns decides everything - a rise of one he climbs
 * unaided, a rise of two or more needs a block carried over and dropped.
 *
 * Difficulty is the number of block lifts in the OPTIMAL solution, not the
 * move count. Move count only measures how far he walks; lifts measure how
 * much of the puzzle is actually puzzle.
 *
 *   npx vite-node tools/gen-bm2.ts > src/levels/blockman2.ts
 */
import { cloneState, loadLevel } from '../src/core/level';
import { grabOrDrop, move } from '../src/core/rules';
import { Tile, type GameState, type LevelDef } from '../src/core/types';

// --- seeded PRNG ------------------------------------------------------------

let seed = 0x2545f491;
function rnd(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 0x100000000;
}
const range = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

// --- solver -----------------------------------------------------------------

type Action = 'left' | 'right' | 'grab';
const ACTIONS: Action[] = ['left', 'right', 'grab'];

function key(s: GameState): string {
  let blocks = '';
  let gems = '';
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === Tile.Block) blocks += i.toString(36) + ',';
    else if (s.tiles[i] === Tile.Gem) gems += i.toString(36) + ',';
  }
  return `${s.x}|${s.y}|${s.facing[0]}|${s.carrying ? 1 : 0}|${blocks}|${gems}`;
}

interface Solved {
  moves: number;
  lifts: number;
  states: number;
}

/** Breadth-first over the real rules. null means unsolvable, or too big. */
function solve(def: LevelDef, cap = 200_000): Solved | null {
  const start = loadLevel(def);
  const seen = new Set([key(start)]);
  let frontier = [{ s: start, lifts: 0 }];
  let states = 0;

  while (frontier.length && states < cap) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      if (++states >= cap) return null;
      for (const a of ACTIONS) {
        const child = cloneState(node.s);
        const r = a === 'grab' ? grabOrDrop(child) : move(child, a);
        if (r.kind === 'none') continue;
        const k = key(child);
        if (seen.has(k)) continue;
        seen.add(k);
        const lifts = node.lifts + (r.kind === 'pickup' ? 1 : 0);
        if (child.won) return { moves: child.moves, lifts, states };
        next.push({ s: child, lifts });
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Weighted A* toward the door, jewels first. Finds *a* route rather than the
 * shortest one, which is the only tractable option once a chamber has six or
 * more barriers - breadth-first explodes combinatorially there.
 */
function solveFast(def: LevelDef, cap = 400_000): Solved | null {
  const start = loadLevel(def);
  const w = start.width;
  const far = start.width + start.height;

  // Wall-aware distance to the door, jewels weighted far above the walk home.
  const doorIdx = start.tiles.indexOf(Tile.Door);
  const dist = new Int32Array(start.width * start.height).fill(-1);
  if (doorIdx >= 0) {
    dist[doorIdx] = 0;
    const q = [doorIdx];
    for (let h = 0; h < q.length; h++) {
      const cur = q[h];
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= start.height) continue;
        const ni = ny * w + nx;
        if (dist[ni] !== -1 || start.tiles[ni] === Tile.Wall) continue;
        dist[ni] = dist[cur] + 1;
        q.push(ni);
      }
    }
  }
  const h = (s: GameState) => {
    const dd = dist[s.y * w + s.x];
    return (dd < 0 ? far : dd) + s.gemsLeft * far;
  };

  const seen = new Set([key(start)]);
  const heap: { s: GameState; g: number; lifts: number; f: number }[] = [];
  const push = (n: (typeof heap)[0]) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  push({ s: start, g: 0, lifts: 0, f: 4 * h(start) });
  let states = 0;
  while (heap.length && states < cap) {
    const node = pop();
    states++;
    for (const a of ACTIONS) {
      const child = cloneState(node.s);
      const r = a === 'grab' ? grabOrDrop(child) : move(child, a);
      if (r.kind === 'none') continue;
      const k = key(child);
      if (seen.has(k)) continue;
      seen.add(k);
      const lifts = node.lifts + (r.kind === 'pickup' ? 1 : 0);
      if (child.won) return { moves: child.moves, lifts, states };
      const g = node.g + 1;
      push({ s: child, g, lifts, f: g + 4 * h(child) });
    }
  }
  return null;
}

// --- generation -------------------------------------------------------------

interface Candidate {
  rows: string[];
  startX: number;
  startY: number;
}

function build(barriers: number): Candidate | null {
  // More barriers need more room to space them out, or they collide.
  const w = barriers >= 5 ? range(24, 30) : range(16, 24);

  // Built right-to-left, because that is the way Block-Man travels: he starts
  // on the right and the doorway is on the left. Terrain rises by at most one
  // per column - which he climbs unaided - except at deliberately placed
  // barriers, which jump two and therefore need a block dropped at their foot.
  const t: number[] = new Array(w).fill(0);
  const barrierAt = new Set<number>();
  const span = Math.floor((w - 6) / Math.max(1, barriers));
  for (let i = 0; i < barriers; i++) {
    const bx = 3 + i * span + range(1, Math.max(1, span - 2));
    if (bx > 2 && bx < w - 3) barrierAt.add(bx);
  }

  let level = 0;
  for (let cx = w - 2; cx >= 1; cx--) {
    if (barrierAt.has(cx)) level += 2;
    else {
      const roll = rnd();
      const d = roll < 0.42 ? 0 : roll < 0.72 ? 1 : -1;
      level += d;
    }
    level = Math.max(0, Math.min(6, level));
    t[cx] = level;
  }

  const peak = Math.max(...t);
  // One spare row above the tallest stack: enough to carry a block over the
  // peak, without leaving a band of dead sky at the top of every chamber.
  const h = peak + 4;
  const floorY = h - 2;

  const g: string[][] = [];
  for (let y = 0; y < h; y++) {
    g.push(
      Array.from({ length: w }, (_, cx) =>
        y === 0 || y === h - 1 || cx === 0 || cx === w - 1 ? '#' : '.',
      ),
    );
  }
  for (let cx = 1; cx < w - 1; cx++) {
    for (let k = 0; k < t[cx]; k++) g[floorY - k][cx] = '#';
  }

  const surface = (cx: number) => floorY - t[cx];
  g[surface(1)][1] = 'D';

  const startX = w - 2;
  const startY = surface(startX);
  if (g[startY][startX] !== '.') return null;

  // One block per barrier, parked on the approach side where it can be reached
  // before the barrier is met.
  const sorted = [...barrierAt].sort((a, b) => a - b);
  for (const bx of sorted) {
    const from = bx + 1;
    const to = Math.min(w - 3, bx + span);
    const options: number[] = [];
    for (let cx = from; cx <= to; cx++) {
      if (cx !== startX && g[surface(cx)][cx] === '.') options.push(cx);
    }
    if (!options.length) return null;
    const cx = options[Math.floor(rnd() * options.length)];
    g[surface(cx)][cx] = 'o';
  }

  // Jewels spread across the whole run, including beyond the barriers.
  const spots: number[] = [];
  for (let cx = 2; cx < w - 2; cx++) {
    if (cx !== startX && g[surface(cx)][cx] === '.') spots.push(cx);
  }
  if (spots.length < 3) return null;
  const gemCount = Math.min(spots.length, range(3, 5));
  for (let i = 0; i < gemCount; i++) {
    const idx = Math.floor(rnd() * spots.length);
    const cx = spots.splice(idx, 1)[0];
    g[surface(cx)][cx] = '*';
  }

  return { rows: g.map((r) => r.join('')), startX, startY };
}

// --- naming -----------------------------------------------------------------

const NAMES: Record<'medium' | 'hard' | 'extreme', string[]> = {
  medium: [
    'The Antechamber', 'Two Steps Up', 'The Cistern', "Mason's Folly",
    'The Broken Stair', 'Quarry Row', 'The Low Arch', 'Pillars of Salt',
    'The Dry Well', 'The Narrow Shelf', 'Crossbeam', 'The Empty Vault',
    "Stonecutter's Yard", 'The Long Landing', 'The Sunken Court',
    'Buttress', 'The Sallyport', 'Kiln Row',
  ],
  extreme: [
    'The Impossible Stair', "Triangulos' Last Word", 'The Black Vault',
    'Nine Masons', 'The Sunless Keep', 'Ordeal of Bentangle',
    'The Cruel Ascent', 'Chamber of Thorns', 'The Final Reckoning',
    "The Princess's Gauntlet", 'The Long Fall', 'Endgame',
  ],
  hard: [
    "The King's Puzzle", 'Triangulos Ascending', 'The Deep Cellar',
    'Labyrinth of Steps', 'The Hanging Garden', 'Keystone',
    'Seven Pillars', 'The Oubliette', 'The Clockwork Court',
    'Bentangle Deep', 'The Last Ascent', 'The Iron Shelf',
    "Pentagwin's Riddle", 'The Highest Chamber', "The Mason's Revenge",
    'Vault of Echoes', 'The Final Stair', 'The Cardinal Trap',
  ],
};

// --- hand-authored easy tier ------------------------------------------------

const EASY: { name: string; rows: string[] }[] = [
  { name: 'A Handful of Jewels', rows: ['#############', '#...........#', '#...........#', '#D..*....*.@#', '#############'] },
  { name: 'Up on the Ledge', rows: ['##############', '#......*.....#', '#....####....#', '#D.......o.@.#', '##############'] },
  { name: 'Over the Step', rows: ['##############', '#............#', '#............#', '#.....*......#', '#D..o.##...@.#', '##############'] },
  { name: 'The Split Shelf', rows: ['################', '#..............#', '#....*....*....#', '#D..###..###.@.#', '################'] },
  { name: 'Carry It Over', rows: ['###############', '#.............#', '#.....*.......#', '#.....#.......#', '#D....#...o@..#', '###############'] },
  { name: 'The Long Gallery', rows: ['##################', '#................#', '#.....*..........#', '#.....#.......*..#', '#D....#...o.@.#..#', '##################'] },
];

// --- drive ------------------------------------------------------------------

interface Chosen {
  name: string;
  tier: 'easy' | 'medium' | 'hard' | 'extreme';
  rows: string[];
  start: { x: number; y: number };
  moves: number;
  lifts: number;
}

const chosen: Chosen[] = [];
const seenSig = new Set<string>();

for (const e of EASY) {
  const rows = e.rows.map((r) => r.replace('@', '.'));
  let sx = 0;
  let sy = 0;
  e.rows.forEach((r, y) => {
    const cx = r.indexOf('@');
    if (cx >= 0) {
      sx = cx;
      sy = y;
    }
  });
  const def: LevelDef = { name: e.name, start: { x: sx, y: sy, facing: 'left' }, rows };
  const res = solve(def);
  if (!res) throw new Error(`hand-authored easy level unsolvable: ${e.name}`);
  chosen.push({ name: e.name, tier: 'easy', rows, start: { x: sx, y: sy }, moves: res.moves, lifts: res.lifts });
  seenSig.add(rows.join('|'));
}

const WANT = { medium: 15, hard: 15, extreme: 10 };
const got = { medium: 0, hard: 0, extreme: 0 };
let attempts = 0;

while (
  (got.medium < WANT.medium || got.hard < WANT.hard || got.extreme < WANT.extreme) &&
  attempts < 300_000
) {
  attempts++;
  // Aim at whichever tier still needs filling.
  const cand = build(
    got.extreme < WANT.extreme ? range(6, 8)
      : got.hard < WANT.hard ? range(3, 4)
      : range(1, 2),
  );
  if (!cand) continue;
  const sig = cand.rows.join('|');
  if (seenSig.has(sig)) continue;

  const def: LevelDef = {
    name: 'tmp',
    start: { x: cand.startX, y: cand.startY, facing: 'left' },
    rows: cand.rows,
  };
  const state = loadLevel(def);
  if (state.gemsTotal < 2) continue;

  // A cheap pass first. Capping out is not a rejection - the hardest chambers
  // are exactly the ones with the biggest state spaces, so those get a deep
  // second pass rather than being thrown away.
  // Always breadth-first, so every chamber that ships carries a PROVEN OPTIMAL
  // par and lift count. A directed search finds a route but not the shortest
  // one, and tiering on it silently overstates difficulty - an earlier version
  // of this file did exactly that and mis-tiered most of the campaign. If BFS
  // cannot close a candidate within budget, the candidate is simply dropped.
  const res = solve(def, 600_000);
  if (!res) continue;

  // One lift is a step; three or more is a genuine construction problem.
  // Bands are the OPTIMAL number of block lifts. Measured over thousands of
  // solved candidates, five is about the practical ceiling: blocks get reused,
  // so extra barriers do not force proportionally more carrying.
  let tier: 'medium' | 'hard' | 'extreme' | null = null;
  if (res.lifts >= 5 && res.moves >= 30 && state.gemsTotal >= 3) tier = 'extreme';
  else if (res.lifts >= 3 && res.lifts <= 4 && res.moves >= 24 && state.gemsTotal >= 3) tier = 'hard';
  else if (res.lifts === 2 && res.moves >= 18) tier = 'medium';
  if (!tier || got[tier] >= WANT[tier]) continue;

  seenSig.add(sig);
  chosen.push({
    name: NAMES[tier][got[tier] % NAMES[tier].length],
    tier,
    rows: cand.rows,
    start: { x: cand.startX, y: cand.startY },
    moves: res.moves,
    lifts: res.lifts,
  });
  got[tier]++;
}

const order = { easy: 0, medium: 1, hard: 2, extreme: 3 } as const;
chosen.sort((a, b) => order[a.tier] - order[b.tier] || a.lifts - b.lifts || a.moves - b.moves);

const out: string[] = [];
out.push('// AUTO-GENERATED by tools/gen-bm2.ts - do not edit by hand.');
out.push('//');
out.push('// NEW levels for the Block-Man 2 rules: collect every jewel, then leave.');
out.push("// These are ORIGINAL, not Soleau layouts. Block-Man 2's own rooms are");
out.push('// obfuscated inside its executable and scroll beyond one screen, so they');
out.push('// cannot be recovered. See tools/extract/README.md.');
out.push('//');
out.push('// Every chamber was solved by breadth-first search over the real rule');
out.push('// functions before being emitted, so all of them are provably escapable');
out.push('// and every par below is a PROVEN OPTIMUM, not a found route.');
out.push('// The tier is how many block lifts the OPTIMAL solution needs:');
out.push('//   easy 0-1   medium 2   hard 3-4   extreme 5 or more');
out.push('//');
out.push('// Legend:  # wall   o block   * jewel   D exit door   . empty');
out.push('');
out.push("import type { LevelDef } from '../core/types';");
out.push('');
out.push('export const BLOCKMAN2_LEVELS: LevelDef[] = [');
for (const c of chosen) {
  out.push('  {');
  out.push(`    name: ${JSON.stringify(c.name)},`);
  out.push(`    tier: '${c.tier}',`);
  out.push(`    par: ${c.moves},`);
  out.push(`    lifts: ${c.lifts},`);
  out.push(`    start: { x: ${c.start.x}, y: ${c.start.y}, facing: 'left' },`);
  out.push('    rows: [');
  for (const r of c.rows) out.push(`      ${JSON.stringify(r)},`);
  out.push('    ],');
  out.push('  },');
}
out.push('];');
out.push('');

process.stdout.write(out.join('\n'));
console.error(
  `easy ${chosen.filter((c) => c.tier === 'easy').length}, ` +
    `medium ${got.medium}, hard ${got.hard}, extreme ${got.extreme}  ` +
    `(${attempts} candidates tried)`,
);
