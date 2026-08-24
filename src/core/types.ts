/** Tile kinds as stored in the grid. */
export const enum Tile {
  Empty = 0,
  Wall = 1,
  Block = 2,
  Door = 3,
  /** Block-Man 2's jewels: collect every one before the door will open. */
  Gem = 4,
}

export type Facing = 'left' | 'right';

export type Tier = 'easy' | 'medium' | 'hard';

/** A level as authored: ASCII rows plus a spawn point. */
export interface LevelDef {
  name: string;
  start: { x: number; y: number; facing: Facing };
  rows: string[];
  /** Difficulty band, on campaigns that are banded. */
  tier?: Tier;
  /** Optimal move count, where a solver has proved one. */
  par?: number;
  /** Block lifts in that optimal solution. */
  lifts?: number;
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
  /** Jewels still to collect. The door stays shut until this reaches zero. */
  gemsLeft: number;
  /** Jewels the level started with; zero for the Block-Man 1 rules. */
  gemsTotal: number;
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
  | 'gem'
  | 'exit';

export interface StepResult {
  kind: StepKind;
  /** Cells fallen at the end of the step (0 if none). */
  fell: number;
}
