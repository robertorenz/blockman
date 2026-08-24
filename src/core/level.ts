import { Tile, type GameState, type LevelDef } from './types';

const CHAR_TO_TILE: Record<string, Tile> = {
  '.': Tile.Empty,
  ' ': Tile.Empty,
  '#': Tile.Wall,
  o: Tile.Block,
  D: Tile.Door,
  '*': Tile.Gem,
};

/** Build a fresh GameState from a level definition. */
export function loadLevel(def: LevelDef): GameState {
  const height = def.rows.length;
  const width = Math.max(...def.rows.map((r) => r.length));
  const tiles = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = def.rows[y];
    for (let x = 0; x < width; x++) {
      const tile = CHAR_TO_TILE[row[x] ?? '.'];
      if (tile === undefined) {
        throw new Error(`Unknown tile '${row[x]}' at ${x},${y} in "${def.name}"`);
      }
      tiles[y * width + x] = tile;
    }
  }

  let gems = 0;
  for (const t of tiles) if (t === Tile.Gem) gems++;

  const state: GameState = {
    width,
    height,
    tiles,
    x: def.start.x,
    y: def.start.y,
    facing: def.start.facing,
    carrying: false,
    gemsLeft: gems,
    gemsTotal: gems,
    moves: 0,
    won: false,
  };

  // The authored spawn may float; let gravity seat him before play begins.
  settle(state);
  return state;
}

/** Read a tile, treating everything outside the grid as solid wall. */
export function at(s: GameState, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return Tile.Wall;
  return s.tiles[y * s.width + x] as Tile;
}

export function set(s: GameState, x: number, y: number, t: Tile): void {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return;
  s.tiles[y * s.width + x] = t;
}

/** Walls and blocks block movement; empty and the door do not. */
export function isSolid(s: GameState, x: number, y: number): boolean {
  const t = at(s, x, y);
  return t === Tile.Wall || t === Tile.Block;
}

/** Drop Block-Man straight down until he rests. Returns cells fallen. */
export function settle(s: GameState): number {
  let fell = 0;
  while (!isSolid(s, s.x, s.y + 1)) {
    s.y++;
    fell++;
    // Guard against a malformed level with no floor.
    if (fell > s.height) break;
  }
  return fell;
}

export function cloneState(s: GameState): GameState {
  return { ...s, tiles: new Uint8Array(s.tiles) };
}
