import { at } from '../core/level';
import { Tile, type GameState } from '../core/types';
import { PALETTE as P } from './palette';

/** Logical pixels per tile before the integer upscale. */
const TILE = 24;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;

  /** Eased display position, so movement reads as motion rather than teleport. */
  private dispX = 0;
  private dispY = 0;
  private primed = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
    this.ctx = ctx;
  }

  /** Size the backing store to the grid at the largest scale that fits. */
  resize(s: GameState, availW: number, availH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = Math.min(availW / (s.width * TILE), availH / (s.height * TILE));
    this.scale = Math.max(1, Math.floor(fit * dpr * 2) / 2);

    this.canvas.width = Math.round(s.width * TILE * this.scale);
    this.canvas.height = Math.round(s.height * TILE * this.scale);
    this.canvas.style.width = (this.canvas.width / dpr).toFixed(1) + 'px';
    this.canvas.style.height = (this.canvas.height / dpr).toFixed(1) + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Snap the eased position - used on level load, reset and undo. */
  snapTo(s: GameState): void {
    this.dispX = s.x;
    this.dispY = s.y;
    this.primed = true;
  }

  draw(s: GameState, timeMs: number): void {
    if (!this.primed) this.snapTo(s);

    // Fast enough to feel responsive, slow enough that a six-cell fall
    // actually reads as a fall.
    const k = 0.35;
    this.dispX += (s.x - this.dispX) * k;
    this.dispY += (s.y - this.dispY) * k;
    if (Math.abs(s.x - this.dispX) < 0.01) this.dispX = s.x;
    if (Math.abs(s.y - this.dispY) < 0.01) this.dispY = s.y;

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    this.drawBackground(s);

    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const t = at(s, x, y);
        if (t === Tile.Wall) this.drawWall(s, x, y);
        else if (t === Tile.Block) this.drawBlock(x * TILE, y * TILE);
        else if (t === Tile.Door) this.drawDoor(x, y, timeMs);
      }
    }

    this.drawPlayer(s);
    ctx.restore();
  }

  private drawBackground(s: GameState): void {
    const ctx = this.ctx;
    const w = s.width * TILE;
    const h = s.height * TILE;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.voidTop);
    g.addColorStop(1, P.voidBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < s.width; x++) {
      ctx.moveTo(x * TILE + 0.5, 0);
      ctx.lineTo(x * TILE + 0.5, h);
    }
    for (let y = 1; y < s.height; y++) {
      ctx.moveTo(0, y * TILE + 0.5);
      ctx.lineTo(w, y * TILE + 0.5);
    }
    ctx.stroke();
  }

  /** Walls interlock, so only edges facing open space get a bevel. */
  private drawWall(s: GameState, gx: number, gy: number): void {
    const ctx = this.ctx;
    const x = gx * TILE;
    const y = gy * TILE;
    const isWall = (dx: number, dy: number) => at(s, gx + dx, gy + dy) === Tile.Wall;

    ctx.fillStyle = P.wallFace;
    ctx.fillRect(x, y, TILE, TILE);

    // Brick courses, offset on alternate rows.
    ctx.fillStyle = P.wallMortar;
    ctx.fillRect(x, y + TILE / 2 - 1, TILE, 1);
    const upperSeam = gy % 2 === 0 ? x + TILE / 2 : x;
    const lowerSeam = gy % 2 === 0 ? x : x + TILE / 2;
    ctx.fillRect(upperSeam, y, 1, TILE / 2 - 1);
    ctx.fillRect(lowerSeam, y + TILE / 2, 1, TILE / 2);

    ctx.fillStyle = P.wallLight;
    if (!isWall(0, -1)) ctx.fillRect(x, y, TILE, 2);
    if (!isWall(-1, 0)) ctx.fillRect(x, y, 2, TILE);

    ctx.fillStyle = P.wallDark;
    if (!isWall(0, 1)) ctx.fillRect(x, y + TILE - 2, TILE, 2);
    if (!isWall(1, 0)) ctx.fillRect(x + TILE - 2, y, 2, TILE);
  }

  /** Shared by grid blocks and the one held overhead. */
  private drawBlock(x: number, y: number, inset = 1): void {
    const ctx = this.ctx;
    const s = TILE - inset * 2;
    const px = x + inset;
    const py = y + inset;

    ctx.fillStyle = P.blockDark;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = P.blockFace;
    ctx.fillRect(px + 1, py + 1, s - 2, s - 2);

    ctx.fillStyle = P.blockLight;
    ctx.fillRect(px + 1, py + 1, s - 2, 2);
    ctx.fillRect(px + 1, py + 1, 2, s - 2);

    ctx.fillStyle = P.blockDark;
    ctx.fillRect(px + 1, py + s - 3, s - 2, 2);
    ctx.fillRect(px + s - 3, py + 1, 2, s - 2);

    // Cross bracing reads as a crate at a glance, even at small scale.
    ctx.strokeStyle = P.blockBand;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 4);
    ctx.lineTo(px + s - 4, py + s - 4);
    ctx.moveTo(px + s - 4, py + 4);
    ctx.lineTo(px + 4, py + s - 4);
    ctx.stroke();
  }

  private drawDoor(gx: number, gy: number, timeMs: number): void {
    const ctx = this.ctx;
    const x = gx * TILE;
    const y = gy * TILE;
    const pulse = 0.55 + 0.45 * Math.sin(timeMs / 520);

    ctx.save();
    ctx.shadowColor = P.doorGlow;
    ctx.shadowBlur = 10 + 8 * pulse;

    ctx.fillStyle = P.doorInner;
    ctx.fillRect(x + 3, y + 2, TILE - 6, TILE - 2);

    ctx.strokeStyle = P.doorFrame;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 3, TILE - 8, TILE - 3);
    ctx.restore();

    ctx.globalAlpha = 0.35 + 0.4 * pulse;
    ctx.fillStyle = P.doorGlow;
    ctx.fillRect(x + 6, y + 5, TILE - 12, TILE - 6);
    ctx.globalAlpha = 1;

    // Arch keystone
    ctx.fillStyle = P.doorFrame;
    ctx.fillRect(x + TILE / 2 - 2, y + 1, 4, 3);
  }

  private drawPlayer(s: GameState): void {
    const ctx = this.ctx;
    const x = this.dispX * TILE;
    const y = this.dispY * TILE;
    const flip = s.facing === 'left' ? -1 : 1;

    if (s.carrying) this.drawBlock(x, y - TILE, 3);

    ctx.save();
    ctx.translate(x + TILE / 2, y);
    ctx.scale(flip, 1);

    // Legs
    ctx.fillStyle = P.boots;
    ctx.fillRect(-5, TILE - 5, 4, 5);
    ctx.fillRect(1, TILE - 5, 4, 5);

    // Tunic
    ctx.fillStyle = P.tunicDark;
    ctx.fillRect(-6, TILE - 14, 12, 10);
    ctx.fillStyle = P.tunic;
    ctx.fillRect(-6, TILE - 14, 9, 10);

    // Belt
    ctx.fillStyle = P.belt;
    ctx.fillRect(-6, TILE - 8, 12, 2);

    // Head
    ctx.fillStyle = P.skin;
    ctx.fillRect(-5, TILE - 21, 10, 8);

    // Eye - the clearest facing cue at this size
    ctx.fillStyle = P.outline;
    ctx.fillRect(1, TILE - 18, 2, 2);

    // Arms up when carrying, down otherwise
    ctx.fillStyle = P.skin;
    if (s.carrying) {
      ctx.fillRect(-7, TILE - 22, 3, 8);
      ctx.fillRect(4, TILE - 22, 3, 8);
    } else {
      ctx.fillRect(-8, TILE - 14, 3, 7);
      ctx.fillRect(5, TILE - 14, 3, 7);
    }

    ctx.restore();
  }
}
