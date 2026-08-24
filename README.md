# Block-Man

A browser remake of **Block-Man**, the 1993 Soleau Software puzzle game by
Doug and Larry Murk — the game that TI-83 *Block Dude* was cloned from.

Block-Man is a commoner in the kingdom of Bentangle who loves the princess.
King Triangulos, who loves blocks, built a series of chambers that take real
cleverness to escape. Get out of every one and you win her hand.

**[Play it here](https://robertorenz.github.io/blockman/)** — or run it locally:

```
npm install
npm run dev      # http://localhost:5173
```

## The rules

| | |
|---|---|
| **Turn, then walk** | The first press of a direction turns Block-Man to face it. The next press walks him one square. |
| **Climb exactly one** | He steps up a single square unaided. Two is a wall. |
| **Fall any distance** | Gravity is instant and harmless. |
| **Carry one block** | Lift the block you are facing; it rides above your head. |
| **Drop builds stairs** | The block is released in front of you and falls until it lands. |
| **Jewels** *(Block-Man 2 only)* | The doorway stays dark until every jewel is collected. Falling past one picks it up, and a dropped block rests on a jewel rather than burying it. |

Nothing is ever pushed. In Block-Man reaching the glowing doorway is the entire
win condition; Block-Man 2 adds the jewels.

### Controls

| Key | Action |
|---|---|
| <kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd> | Turn and walk |
| <kbd>↑</kbd> / <kbd>Space</kbd> / <kbd>W</kbd> | Pick up or drop a block |
| <kbd>U</kbd> / <kbd>Z</kbd> | Undo |
| <kbd>R</kbd> | Restart chamber |
| <kbd>L</kbd> | Chamber select |
| <kbd>C</kbd> | Change campaign |
| <kbd>M</kbd> | Mute |
| <kbd>?</kbd> | Rules |

Touch controls appear automatically on small or coarse-pointer devices.

## Stack

TypeScript, Canvas 2D, Vite. **No game engine and no asset files** — the
sprites are drawn procedurally and the sound effects are square waves from the
Web Audio API. The production bundle is about **7 kB gzipped** in total.

A grid puzzle needs none of what an engine provides: gravity is a `while` loop,
collision is an array lookup, and the whole world is a `Uint8Array`. Adding
Phaser or Godot would have meant hundreds of kilobytes to manage things this
game does not have.

```
src/
  core/          pure logic, zero DOM, fully unit-tested
    types.ts     tile enum, GameState, StepResult
    level.ts     ASCII parsing, tile access, gravity
    rules.ts     move / climb / pickUp / drop
    history.ts   snapshot undo stack
  render/
    renderer.ts  canvas blitter, integer-scaled, eased motion
    palette.ts   all colour lives here
    audio.ts     PC-speaker style blips
  ui/
    modal.ts     <dialog>-based modals (never window.alert)
    screens.ts   rules, chamber select, localStorage progress
  levels/
    index.ts     the two campaigns
    levels.ts    Block Dude — generated, see tools/
    blockman.ts  Block-Man — generated, see tools/extract/
    blockman2.ts Block-Man 2 — generated, see tools/bm2-levels.mjs
```

Keeping `core/` DOM-free is the decision that pays off: the rules are directly
testable, and the same functions drive the automated solver.

## Three campaigns

The game opens with a campaign picker.

| Campaign | Chambers | Rules | Source |
|---|---|---|---|
| **Block-Man** | 3 | Reach the door | Recovered pixel-by-pixel from EGA screenshots of the original 1993 release |
| **Block-Man 2** | 6 | Collect every jewel, *then* the door opens | **Original levels** in the style of the 1995 sequel — not Soleau layouts |
| **Block Dude** | 11 | Reach the door | Brandon Sterner's TI-83 clone, via the [Block Dude CE](https://github.com/merthsoft/blockdudece) port |

Progress, unlocks and best scores are tracked per campaign.

### Block-Man 2

Its sprite and sound names — `BMRW`/`BMLW` (walk), `BMRC`/`BMLC` (climb),
`BMRG`/`BMLG` (grab), `BMRD`/`BMLD` (drop), and `SGEM`, `SBOAT`, `SSWITCH`,
`STELE`, `RAIL` — confirm a jewel-collecting game with boats, switches and
rails on top of Block-Man's carrying rules. `BMAN2.OV1` turned out to be a
Genus Microprogramming resource archive of 47 PCX/VOC/SNG/GFT files, which
`tools/extract/` can list; it holds no level data.

Its rooms live in the executable as 100 Pascal-string records of 256 bytes at
`0x2fcf2` of the decompressed image — exactly 25,600 bytes — but the contents
are obfuscated, and its levels scroll beyond one screen so screenshots only
ever show a fragment. **The six Block-Man 2 chambers here are therefore
original, written in its style, not recovered.** Only the jewel rule is
reproduced; boats, switches and rails are not implemented.

### Where the levels came from

Block-Man ships **17 rooms, lettered A–Q** (the in-game help and IQ chart both
confirm it; the shareware `BMAN1.DOC` describes only its 10-room free subset).
Its room data is not stored as a plain grid in any shipped file — see
`tools/extract/` for how far that went. Only three rooms were ever published as
screenshots, so only those three are reproduced.

**Block Dude's levels are partly copies of Block-Man's rooms.** Comparing
puzzle content — the offsets of every block and the door relative to
Block-Man's start, which ignores decorative padding — gives an exact match:

| Block-Man room | Block Dude level | Blocks match |
|---|---|---|
| Room C | 3, "Descent" | **100%** |
| Room D | 4, "Cathedral" | **100%** |
| Room B | 2, best candidate | 13% |

So Sterner copied rooms across, renumbering by position (level *N* = room *N*),
but replaced others — Room B has no counterpart. Run `npx vite-node
tools/compare.ts` to reproduce this. It also cross-validates the extractor: two
independent sources, a C source port and a JPEG screenshot, yield the identical
puzzle.

```
#  wall      o  block      D  exit door      .  empty
```

## Verification

Correctness here rests on two independent legs.

**1. Rules checked line-by-line against the original.** The reference C
implementation (`handle_player_movement` and `game_update` in Block Dude CE)
was read directly and compared against `src/core/rules.ts`. That comparison
caught two real deviations in the first draft:

- The carrying climb was **too strict** — it required headroom above the
  block's *current* cell. The original tests only the *destination* column, so
  a carried block may sweep past an overhang. Several chambers rely on this.
- **Move counting.** The original increments only when the player actually
  changes cell (`player_x != old_x || player_y != old_y`). Turning, lifting and
  dropping are all free. Scores are therefore comparable with the original.

Both behaviours are pinned by tests in the *fidelity to the original* block.

**2. Automated solving.** `tools/solve.ts` searches for an escape route using
the real rule functions:

```
npx vite-node tools/solve.ts 400000 2000000 4,1000 blockman
npx vite-node tools/solve.ts 400000 2000000 4,1000 blockman2
npx vite-node tools/solve.ts 400000 2000000 4,1000 blockdude
```

It distinguishes **UNSOLVABLE** (the whole reachable state space was explored
and no escape exists) from **UNPROVEN** (the search ran out of budget). The
state key must include jewel positions as well as block positions — omitting
them collapses genuinely different states together and reports solvable levels
as unsolvable.

Breadth-first gives a provably optimal par; weighted A* guided by a wall-aware
distance-to-door field finds *a* route when BFS runs out of room.

| Campaign | Result | Chambers |
|---|---|---|
| Block-Man | Escapable, optimal par known | B *(22)*, C *(76)* |
| Block-Man | Unproven — search ran out of budget | D |
| Block-Man 2 | Escapable, optimal par known | all 6 *(10, 10, 10, 12, 10, 15)* |
| Block Dude | Escapable, optimal par known | 1 *(15)*, 2 *(61)*, 3 *(76)*, 6 *(62)* |
| Block Dude | Escapable, route found | 5 *(105)*, 9 *(185)* |
| Block Dude | Unproven — search hit its cap | 4, 7, 8, 10, 11 |

Block-Man is **PSPACE-complete** ([Ani et al., 2024](https://arxiv.org/html/2412.20079v1)),
so exhaustive search is not expected to close the last five. *Unproven means
the search ran out of budget, not that the chamber is unsolvable* — these
layouts ship in a working game, and the rules they run on are the ones verified
above.

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck then bundle to `dist/` |
| `npm test` | 43 unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `node tools/make-artifact.mjs` | Flatten `dist/` into one self-contained HTML page |

## Credits

Original **Block-Man** (1993) by Doug and Larry Murk, published by Soleau
Software. **Block Dude** by Brandon Sterner; its levels reached here through
the Block Dude CE port. This is an independent fan remake, not affiliated with
or endorsed by Soleau Software.
