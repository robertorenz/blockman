import { cloneState } from './level';
import type { GameState } from './types';

/**
 * Snapshot undo stack. Grids here are at most ~29x19, so copying the whole
 * state per move is cheaper and far less bug-prone than replaying deltas.
 */
export class History {
  private stack: GameState[] = [];

  constructor(private readonly limit = 2000) {}

  push(s: GameState): void {
    this.stack.push(cloneState(s));
    if (this.stack.length > this.limit) this.stack.shift();
  }

  pop(): GameState | null {
    return this.stack.pop() ?? null;
  }

  clear(): void {
    this.stack.length = 0;
  }

  get depth(): number {
    return this.stack.length;
  }
}
