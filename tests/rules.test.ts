import { describe, expect, it } from 'vitest';

import { at, loadLevel } from '../src/core/level';
import { drop, move, pickUp } from '../src/core/rules';
import { Tile, type Facing, type GameState, type LevelDef } from '../src/core/types';
import { CAMPAIGNS } from '../src/levels';
import { LEVELS } from '../src/levels/levels';

/** Build a throwaway level from ASCII. `@` marks the spawn cell. */
function scene(rows: string[], facing: Facing = 'right'): GameState {
  let start = { x: 0, y: 0, facing };
  const cleaned = rows.map((row, y) => {
    const x = row.indexOf('@');
    if (x >= 0) start = { x, y, facing };
    return row.replace('@', '.');
  });
  const def: LevelDef = { name: 'test', start, rows: cleaned };
  return loadLevel(def);
}

describe('movement', () => {
  it('turns in place on the first press of a new direction', () => {
    const s = scene(['....', '.@..', '####'], 'right');
    const r = move(s, 'left');
    expect(r.kind).toBe('turn');
    expect(s.facing).toBe('left');
    expect(s.x).toBe(1);
  });

  it('walks once already facing that way', () => {
    const s = scene(['....', '.@..', '####'], 'right');
    expect(move(s, 'right').kind).toBe('walk');
    expect(s.x).toBe(2);
  });

  it('climbs a single step', () => {
    const s = scene(['.....', '.....', '.@#..', '#####'], 'right');
    const r = move(s, 'right');
    expect(r.kind).toBe('climb');
    expect({ x: s.x, y: s.y }).toEqual({ x: 2, y: 1 });
  });

  it('refuses a two-high step', () => {
    const s = scene(['..#..', '..#..', '.@#..', '#####'], 'right');
    expect(move(s, 'right').kind).toBe('none');
    expect(s.x).toBe(1);
  });

  it('refuses to climb when the ceiling is right above', () => {
    const s = scene(['.##..', '.@#..', '#####'], 'right');
    expect(move(s, 'right').kind).toBe('none');
  });

  it('falls any distance without harm', () => {
    const s = scene(['.@..', '##..', '#...', '#...', '####'], 'right');
    const r = move(s, 'right');
    expect(r.kind).toBe('fall');
    expect(r.fell).toBe(3);
    expect(s.y).toBe(3);
  });

  it('treats the grid edge as solid', () => {
    const s = scene(['@...', '####'], 'left');
    expect(move(s, 'left').kind).toBe('none');
    expect(s.x).toBe(0);
  });
});

describe('carrying', () => {
  it('lifts the block it is facing', () => {
    const s = scene(['....', '.@o.', '####'], 'right');
    expect(pickUp(s).kind).toBe('pickup');
    expect(s.carrying).toBe(true);
    expect(at(s, 2, 1)).toBe(Tile.Empty);
  });

  it('will not lift a block with something stacked on it', () => {
    const s = scene(['..o.', '.@o.', '####'], 'right');
    expect(pickUp(s).kind).toBe('none');
    expect(s.carrying).toBe(false);
  });

  it('will not lift without headroom', () => {
    const s = scene(['.#..', '.@o.', '####'], 'right');
    expect(pickUp(s).kind).toBe('none');
  });

  it('will not lift a wall', () => {
    const s = scene(['....', '.@#.', '####'], 'right');
    expect(pickUp(s).kind).toBe('none');
  });

  it('drops the block into the column ahead, and it falls', () => {
    const s = scene(['......', '.@o...', '####.#', '######'], 'right');
    pickUp(s);
    move(s, 'right'); // into the cell the block vacated
    move(s, 'right'); // now standing at the lip of the pit
    expect({ x: s.x, y: s.y }).toEqual({ x: 3, y: 1 });
    expect(drop(s).kind).toBe('drop');
    // Released at head height, it drops to the floor of the pit.
    expect(at(s, 4, 2)).toBe(Tile.Block);
  });

  it('refuses to drop into a blocked cell', () => {
    const s = scene(['...#..', '.@o...', '######'], 'right');
    pickUp(s);
    move(s, 'right');
    expect(s.carrying).toBe(true);
    expect(drop(s).kind).toBe('none');
    expect(s.carrying).toBe(true);
  });

  it('cannot walk under a low ceiling while carrying', () => {
    const s = scene(['....#.', '.@o...', '######'], 'right');
    pickUp(s);
    move(s, 'right');
    move(s, 'right');
    // Cell (4,1) is open but (4,0) holds the ceiling, so the block will not fit.
    expect(s.x).toBe(3);
    expect(move(s, 'right').kind).toBe('none');
    expect(s.x).toBe(3);
  });

  it('can build a step and climb it', () => {
    const s = scene(['......', '.@o...', '#####.', '######'], 'right');
    pickUp(s);
    move(s, 'right'); // walk into the vacated cell
    expect(s.x).toBe(2);
    drop(s); // block lands at (3,1)
    expect(at(s, 3, 1)).toBe(Tile.Block);
    expect(move(s, 'right').kind).toBe('climb');
    expect(s.y).toBe(0);
  });
});

/**
 * These pin down behaviour taken directly from the original
 * handle_player_movement, where it is easy to "improve" it by accident.
 */
describe('fidelity to the original', () => {
  it('counts a move only when Block-Man actually changes cell', () => {
    const s = scene(['......', '.@o...', '######'], 'right');
    move(s, 'left'); // turn only
    expect(s.moves).toBe(0);

    pickUp(s); // lifting is free
    expect(s.moves).toBe(0);

    move(s, 'right'); // turn back, still free
    expect(s.moves).toBe(0);

    move(s, 'right'); // an actual step
    expect(s.moves).toBe(1);

    drop(s); // dropping is free
    expect(s.moves).toBe(1);
  });

  it('lets a carried block sweep past an overhang while climbing', () => {
    // (1,0) is walled, so there is a ceiling right above the held block. The
    // original only tests the destination column, so this climb is legal.
    const s = scene(['.#....', '......', '.@#...', '######'], 'right');
    s.carrying = true;
    expect(move(s, 'right').kind).toBe('climb');
    expect({ x: s.x, y: s.y }).toEqual({ x: 2, y: 1 });
  });

  it('still refuses the climb when the destination has no room for the block', () => {
    const s = scene(['..#...', '......', '.@#...', '######'], 'right');
    s.carrying = true;
    expect(move(s, 'right').kind).toBe('none');
  });

  it('treats the doorway as passable, not solid', () => {
    const s = scene(['......', '.@D...', '######'], 'right');
    expect(move(s, 'right').kind).toBe('walk');
    expect(s.won).toBe(true);
  });
});

describe('jewels (Block-Man 2)', () => {
  it('keeps the door shut until every jewel is taken', () => {
    const s = scene(['......', 'D@.*..', '######'], 'left');
    expect(s.gemsTotal).toBe(1);
    move(s, 'left'); // already facing left, so this steps onto the door
    expect(s.x).toBe(0);
    expect(s.won).toBe(false); // standing in the doorway, but a jewel remains
  });

  it('opens the door once the last jewel is taken', () => {
    const s = scene(['......', 'D@*...', '######'], 'left');
    move(s, 'right'); // turn
    expect(move(s, 'right').kind).toBe('gem');
    expect(s.gemsLeft).toBe(0);
    move(s, 'left'); // turn
    move(s, 'left');
    move(s, 'left');
    expect(s.won).toBe(true);
  });

  it('sweeps up jewels passed through while falling', () => {
    // He starts on solid ground and steps into a shaft with two jewels in it.
    const s = scene(['.@..', '##*.', '#.*.', '#...', '####'], 'right');
    expect(s.gemsTotal).toBe(2);
    const r = move(s, 'right');
    expect(r.kind).toBe('gem');
    expect(s.gemsLeft).toBe(0);
    expect(s.y).toBe(3);
  });

  it('never lets a dropped block destroy a jewel', () => {
    const s = scene(['......', '.@o...', '###.##', '###*##', '######'], 'right');
    pickUp(s);
    move(s, 'right'); // into the cell the block vacated
    expect(drop(s).kind).toBe('drop');
    // The block rests on the jewel rather than replacing it.
    expect(at(s, 3, 2)).toBe(Tile.Block);
    expect(at(s, 3, 3)).toBe(Tile.Gem);
    expect(s.gemsLeft).toBe(1);
  });

  it('leaves jewel-free levels behaving exactly as before', () => {
    const s = scene(['....', 'D@..', '####'], 'left');
    expect(s.gemsTotal).toBe(0);
    move(s, 'left');
    expect(s.won).toBe(true);
  });
});

describe('winning', () => {
  it('wins on reaching the doorway', () => {
    const s = scene(['....', 'D@..', '####'], 'left');
    move(s, 'left'); // turn
    move(s, 'left'); // step in
    expect(s.won).toBe(true);
  });

  it('ignores input once won', () => {
    const s = scene(['....', 'D@..', '####'], 'left');
    move(s, 'left');
    move(s, 'left');
    const moves = s.moves;
    expect(move(s, 'right').kind).toBe('none');
    expect(s.moves).toBe(moves);
  });
});

describe('shipped levels', () => {
  it.each(LEVELS.map((l, i) => [i, l.name] as const))(
    'level %i "%s" is well formed',
    (i) => {
      const s = loadLevel(LEVELS[i]);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);

      // Exactly one exit.
      const doors = [...s.tiles].filter((t) => t === Tile.Door).length;
      expect(doors).toBe(1);

      // Spawn is inside the grid, on solid ground, and not inside a wall.
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(s.width);
      expect(at(s, s.x, s.y)).not.toBe(Tile.Wall);
      expect(at(s, s.x, s.y)).not.toBe(Tile.Block);
      expect(s.y).toBeLessThan(s.height);
    },
  );

  it('has 11 chambers with unique names', () => {
    expect(LEVELS).toHaveLength(11);
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(11);
  });
});

describe('campaigns', () => {
  it('exposes both level sets with stable ids', () => {
    expect(CAMPAIGNS.map((c) => c.id).sort()).toEqual(['blockdude', 'blockman', 'blockman2']);
    expect(new Set(CAMPAIGNS.map((c) => c.id)).size).toBe(CAMPAIGNS.length);
  });

  it.each(CAMPAIGNS.map((c) => [c.id, c] as const))('%s loads every chamber', (_id, c) => {
    expect(c.levels.length).toBeGreaterThan(0);
    for (const def of c.levels) {
      const s = loadLevel(def);
      expect([...s.tiles].filter((t) => t === Tile.Door)).toHaveLength(1);
      expect(at(s, s.x, s.y)).not.toBe(Tile.Wall);
      expect(at(s, s.x, s.y)).not.toBe(Tile.Block);
    }
  });

  it('names every chamber uniquely within its campaign', () => {
    for (const c of CAMPAIGNS) {
      expect(new Set(c.levels.map((l) => l.name)).size).toBe(c.levels.length);
    }
  });
});
