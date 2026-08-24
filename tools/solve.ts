/**
 * Proves every shipped chamber is escapable under our rule implementation,
 * and derives a par move count where it can.
 *
 * Block-Man is PSPACE-complete in general, so this is a bounded search, not a
 * decision procedure. Two passes per chamber:
 *
 *   1. Breadth-first, which yields a provably OPTIMAL move count.
 *   2. If BFS hits its cap, weighted A* guided by wall-aware distance to the
 *      door, which finds *a* solution far more cheaply but claims nothing
 *      about optimality.
 *
 * UNPROVEN never means "unsolvable" - only that neither pass finished.
 *
 *   npx vite-node tools/solve.ts [bfsCap] [astarCap] [weight]
 */
import { at, cloneState, loadLevel } from '../src/core/level';
import { grabOrDrop, move } from '../src/core/rules';
import { Tile, type GameState } from '../src/core/types';
import { CAMPAIGNS } from '../src/levels';

const CAMPAIGN = CAMPAIGNS.find((c) => c.id === (process.argv[5] ?? 'blockman')) ?? CAMPAIGNS[0];
const LEVELS = CAMPAIGN.levels;

const BFS_CAP = Number(process.argv[2] ?? 400_000);
const ASTAR_CAP = Number(process.argv[3] ?? 4_000_000);
const WEIGHTS = (process.argv[4] ?? '4,1000').split(',').map(Number);

type Action = 'left' | 'right' | 'grab';
const ACTIONS: Action[] = ['left', 'right', 'grab'];

function step(s: GameState, a: Action): boolean {
  return (a === 'grab' ? grabOrDrop(s) : move(s, a)).kind !== 'none';
}

/** Only block cells can change, so the grid contributes just their indices. */
function key(s: GameState): string {
  let blocks = '';
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i] === Tile.Block) blocks += i.toString(36) + ',';
  }
  return `${s.x}|${s.y}|${s.facing[0]}|${s.carrying ? 1 : 0}|${blocks}`;
}

/**
 * Distance from every cell to the door through non-wall space, ignoring
 * gravity and treating blocks as removable. A relaxation of the real problem,
 * so it never over-estimates by much, and unlike Manhattan it routes around
 * the masonry instead of straight through it.
 */
function doorDistanceField(s: GameState): Int32Array {
  const n = s.width * s.height;
  const dist = new Int32Array(n).fill(-1);
  const doorIdx = s.tiles.indexOf(Tile.Door);
  if (doorIdx < 0) return dist;

  const queue = [doorIdx];
  dist[doorIdx] = 0;

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % s.width;
    const cy = (cur / s.width) | 0;
    const d = dist[cur] + 1;

    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
      const ni = ny * s.width + nx;
      if (dist[ni] !== -1) continue;
      if (at(s, nx, ny) === Tile.Wall) continue;
      dist[ni] = d;
      queue.push(ni);
    }
  }
  return dist;
}

// --- priority queue --------------------------------------------------------

interface Node {
  state: GameState;
  g: number;
  f: number;
}

class Heap {
  private a: Node[] = [];

  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): Node | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }

  get size(): number {
    return this.a.length;
  }
}

// --- searches --------------------------------------------------------------

interface Outcome {
  status: 'OPTIMAL' | 'SOLVED' | 'UNPROVEN';
  moves?: number;
  expanded: number;
  ms: number;
}

/** Optimal, but memory-hungry. Reports the game's own move count. */
function bfs(index: number): Outcome {
  const start = loadLevel(LEVELS[index]);
  const t0 = Date.now();
  const seen = new Set([key(start)]);
  let frontier = [start];
  let expanded = 0;

  while (frontier.length && expanded < BFS_CAP) {
    const next: GameState[] = [];
    for (const node of frontier) {
      if (++expanded >= BFS_CAP) break;
      for (const a of ACTIONS) {
        const child = cloneState(node);
        if (!step(child, a)) continue;
        const k = key(child);
        if (seen.has(k)) continue;
        seen.add(k);
        if (child.won) {
          return { status: 'OPTIMAL', moves: child.moves, expanded, ms: Date.now() - t0 };
        }
        next.push(child);
      }
    }
    frontier = next;
  }
  return { status: 'UNPROVEN', expanded, ms: Date.now() - t0 };
}

/**
 * Finds a solution, not the shortest one. The weight matters more than it
 * looks: a low weight behaves like BFS and cracks wide-open chambers, a high
 * one behaves like pure greedy and cracks deep corridor chambers. Neither
 * setting dominates, so the driver runs both.
 */
function astar(index: number, weight: number): Outcome {
  const start = loadLevel(LEVELS[index]);
  const field = doorDistanceField(start);
  const t0 = Date.now();
  const far = start.width + start.height;

  const h = (s: GameState) => {
    const d = field[s.y * s.width + s.x];
    return (d < 0 ? far : d) + (s.carrying ? 1 : 0);
  };

  const seen = new Set([key(start)]);
  const heap = new Heap();
  heap.push({ state: start, g: 0, f: weight * h(start) });
  let expanded = 0;

  while (heap.size && expanded < ASTAR_CAP) {
    const node = heap.pop()!;
    expanded++;

    for (const a of ACTIONS) {
      const child = cloneState(node.state);
      if (!step(child, a)) continue;
      const k = key(child);
      if (seen.has(k)) continue;
      seen.add(k);
      if (child.won) {
        return { status: 'SOLVED', moves: child.moves, expanded, ms: Date.now() - t0 };
      }
      const g = node.g + 1;
      heap.push({ state: child, g, f: g + weight * h(child) });
    }
  }
  return { status: 'UNPROVEN', expanded, ms: Date.now() - t0 };
}

// --- report ----------------------------------------------------------------

console.log(
  `Verifying ${CAMPAIGN.name}: ${LEVELS.length} chambers  (bfs cap ${BFS_CAP.toLocaleString()}, ` +
    `A* cap ${ASTAR_CAP.toLocaleString()}, weights ${WEIGHTS.join(' then ')})\n`,
);

let proven = 0;
let optimal = 0;

for (let i = 0; i < LEVELS.length; i++) {
  let out = bfs(i);
  let via = '';
  for (const w of WEIGHTS) {
    if (out.status !== 'UNPROVEN') break;
    const g = astar(i, w);
    via = ` (A* w${w})`;
    out = { ...g, expanded: out.expanded + g.expanded, ms: out.ms + g.ms };
  }

  if (out.status !== 'UNPROVEN') proven++;
  if (out.status === 'OPTIMAL') optimal++;

  const name = `${String(i + 1).padStart(2, '0')}  ${LEVELS[i].name.padEnd(18)}`;
  const verdict =
    out.status === 'OPTIMAL'
      ? `ESCAPABLE  optimal ${String(out.moves).padStart(4)} moves${''.padEnd(12)}`
      : out.status === 'SOLVED'
        ? `ESCAPABLE  found   ${String(out.moves).padStart(4)} moves${via.padEnd(12)}`
        : `UNPROVEN   search exhausted its cap  `;

  console.log(
    `${name} ${verdict}  ${out.expanded.toLocaleString().padStart(10)} states  ${(
      out.ms / 1000
    ).toFixed(1)}s`,
  );
}

console.log(`\n${proven}/${LEVELS.length} chambers proven escapable (${optimal} with optimal par).`);
process.exit(proven === LEVELS.length ? 0 : 1);
