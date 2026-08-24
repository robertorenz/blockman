# Original-game extraction

Work in progress: recovering Block-Man's own 10 chambers from the 1993 release,
to replace the Block Dude placeholder levels in `src/levels/levels.ts`.

## Source

`Block-Man_1_1994.zip` (96,359 bytes) from the Internet Archive item
`msdos_Block-Man_1_1994`. Contents: `BMAN1.EXE` plus overlays `BMAN1.OV0`–`OV3`.

The game files are **not** committed here — download them yourself.

## What each file holds

| File | Size | Contents |
|---|---|---|
| `BMAN1.EXE` | 60,063 | PKLITE-compressed program **and level data** |
| `BMAN1.OV0` | 126,080 | EGA sprite bitmaps (planar, `0x00`/`0xff` dominant) |
| `BMAN1.OV1` | 6,547 | Help screen text |
| `BMAN1.OV2` | 2,501 | IQ chart text |
| `BMAN1.OV3` | 14,112 | Not maps — 24 CRLF-delimited chunks, 7-symbol alphabet |

## depklite.py

Pure-Python PKLITE decompressor, ported from
[hackerb9/depklite](https://github.com/hackerb9/depklite) (MIT), which derives
from refkeen and OpenTESArena's `ExeUnpacker`. Format documented by @dozayon.

There is no C compiler in this environment, hence the port. The
compressed-data offset is not recorded in the file, so `find_offset()`
brute-forces it and scores candidates on clean termination, output size and
printable-text density.

```
python tools/extract/depklite.py BMAN1.EXE
# -> best offset 0x0320, 124,192 bytes, clean=True  (BMAN1.EXE.dep)
```

## Where the maps live

Inside the decompressed image, rows are **20 bytes**: one attribute byte
(usually `0x1b`) followed by **19 tile characters**. Spanning roughly
`0x1aeb2`–`0x1e000`, blank (`)`-filled) rows separate **18 blobs**:

- blobs 0–5 — the six skits
- blobs 6–15 — **ten blobs, matching the ten chambers A–J**
- blobs 16–17 — remaining artwork

## Remaining work

The tile alphabet is large (`$ ) . - & / ' " + ( ! # Q Y C D E F G L M A ...`),
because the original draws each cell with a distinct EGA tile including corner
and edge variants. To convert a blob into our four logical types
(empty / wall / block / door) plus Block-Man's start, each character must be
mapped to the sprite it selects.

That mapping is recoverable by rendering the `BMAN1.OV0` sprite sheet and
reading off which glyph is the movable block, the doorway and the player.
