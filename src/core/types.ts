/** Tile kinds as stored in the grid. */
export const enum Tile {
  Empty = 0,
  Wall = 1,
  Block = 2,
  Door = 3,
}

export type Facing = 'left' | 'right';

/** A level as authored: ASCII rows plus a spawn point. */
export interface LevelDef {
  name: string;
  start: { x: number; y: number; facing: Facing };
  rows: string[];
}

/** Full mutable game state for one attempt at one level. */
export interface GameState {
  width: number;
  height: number;
  /** Row-major, length = width * height. */
  tiles: Uint8Array;
  x: number;
  y: number;
  facing: Facing;
  /** True while Block-Man is holding a block above his head. */
  carrying: boolean;
  moves: number;
  won: boolean;
}

/** What a step actually did — the renderer animates from this. */
export type StepKind =
  | 'none'
  | 'turn'
  | 'walk'
  | 'climb'
  | 'fall'
  | 'pickup'
  | 'drop'
  | 'exit';

export interface StepResult {
  kind: StepKind;
  /** Cells fallen at the end of the step (0 if none). */
  fell: number;
}
