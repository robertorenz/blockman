import { at, isSolid, set, settle } from './level';
import { Tile, type Facing, type GameState, type StepResult } from './types';

const NONE: StepResult = { kind: 'none', fell: 0 };

function dx(facing: Facing): number {
  return facing === 'left' ? -1 : 1;
}

/** True once Block-Man is standing in the doorway. */
function checkWin(s: GameState): boolean {
  if (at(s, s.x, s.y) === Tile.Door) s.won = true;
  return s.won;
}

/**
 * Walk one cell in `dir`.
 *
 * Faithful to the original: pressing a direction you are not already facing
 * turns you on the spot and costs a move. Pressing it again walks. If the
 * cell ahead is blocked but the cell above it is clear, Block-Man steps up
 * exactly one — never two. After any horizontal move he falls until he lands.
 */
export function move(s: GameState, dir: Facing): StepResult {
  if (s.won) return NONE;

  // Turning is free, exactly as in the original: the move counter only ever
  // advances when Block-Man actually changes cell.
  if (s.facing !== dir) {
    s.facing = dir;
    return { kind: 'turn', fell: 0 };
  }

  const d = dx(dir);
  const ahead = { x: s.x + d, y: s.y };

  if (!isSolid(s, ahead.x, ahead.y)) {
    // Carrying a block means the cell above the destination must be clear too.
    if (s.carrying && isSolid(s, ahead.x, ahead.y - 1)) return NONE;
    s.x = ahead.x;
    s.moves++;
    const fell = settle(s);
    checkWin(s);
    return { kind: fell > 0 ? 'fall' : 'walk', fell };
  }

  // Blocked ahead — try to climb the single step.
  const bodyClear = !isSolid(s, ahead.x, s.y - 1);
  const headClear = !isSolid(s, s.x, s.y - 1);

  if (s.carrying) {
    // Only the destination is tested. The carried block is allowed to sweep
    // past whatever sits above his current cell - a quirk of the original that
    // several chambers depend on, so it is deliberately preserved here.
    if (!bodyClear || isSolid(s, ahead.x, s.y - 2)) return NONE;
  } else if (!bodyClear || !headClear) {
    return NONE;
  }

  s.x = ahead.x;
  s.y = s.y - 1;
  s.moves++;
  const fell = settle(s);
  checkWin(s);
  return { kind: fell > 0 ? 'fall' : 'climb', fell };
}

/**
 * Pick up the block Block-Man is facing, or drop the one he is holding.
 * A single key does both in the original, so this mirrors that.
 */
export function grabOrDrop(s: GameState): StepResult {
  if (s.won) return NONE;
  return s.carrying ? drop(s) : pickUp(s);
}

/**
 * Lift the block directly ahead. Refused if the block has anything stacked
 * on it, or if there is no headroom to hold it.
 */
export function pickUp(s: GameState): StepResult {
  if (s.won || s.carrying) return NONE;

  const d = dx(s.facing);
  const bx = s.x + d;

  if (at(s, bx, s.y) !== Tile.Block) return NONE;
  if (isSolid(s, bx, s.y - 1)) return NONE; // something is stacked on it
  if (isSolid(s, s.x, s.y - 1)) return NONE; // no room above his head

  set(s, bx, s.y, Tile.Empty);
  s.carrying = true;
  return { kind: 'pickup', fell: 0 };
}

/**
 * Release the carried block into the column ahead. It enters at head height
 * and falls until it lands.
 */
export function drop(s: GameState): StepResult {
  if (s.won || !s.carrying) return NONE;

  const d = dx(s.facing);
  const bx = s.x + d;
  let by = s.y - 1;

  if (isSolid(s, bx, by)) return NONE; // nowhere to release it

  while (!isSolid(s, bx, by + 1)) {
    by++;
    if (by > s.height) break;
  }

  set(s, bx, by, Tile.Block);
  s.carrying = false;
  return { kind: 'drop', fell: 0 };
}
