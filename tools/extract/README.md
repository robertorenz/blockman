# Original-game extraction

**Solved.** All 17 authentic Block-Man rooms (A–Q) are recovered from the 1993
release and ship in `src/levels/blockman.ts`.

## Source

`Block-Man_1_1994.zip` (96,359 bytes) from the Internet Archive item
`msdos_Block-Man_1_1994`. Contents: `BMAN1.EXE` plus overlays `BMAN1.OV0`–`OV3`.

The game files are **not** committed here — download them yourself.

## What each file holds

| File | Size | Contents |
|---|---|---|
| `BMAN1.EXE` | 60,063 | PKLITE-compressed program **and all 17 rooms** |
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

## The Soleau cipher (solved)

`solsoft.py`. Soleau obfuscated strings with

```
ciphertext[i] = plaintext[i] XOR (KEY[i mod 7] | 0x80)      KEY = "SOLSOFT"
```

CR and LF pass through untouched and **the key index resets at the start of
every line** — miss that and only the first line decodes.

It fell out of a known-plaintext pair hiding in plain sight. The registered
release ships `BMAN1.OV3` encrypted; the shareware release ships the same
document as `BMAN1.OV2` in the clear. The encrypted file opens

```
f3 ef ec f3 ef e6 f4  f3 ef ec f3 ef e6 f4  f3 ef ec f3
```

— a seven-byte cycle over what the plaintext twin shows is a run of spaces, so
each key byte is `cipher XOR 0x20`. That gives `d3 cf cc d3 cf c6 d4`, and
XORing those with `0x80` spells `SOLSOFT`.

Decrypts `BMAN1.OV3` to 2,504 bytes with **zero** non-text bytes. The recovered
document also names two things worth knowing: the registered build "include[s]
solutions for all puzzles", and there was a **Construction Kit** that let owners
"create and save my own puzzle rooms" — so a room file format existed.

### Correction: the executables were never encrypted

An earlier pass here claimed `BMAN1.EXE` used a second, unbroken cipher. That
was wrong, and the real cause was worse: **the decompression was broken.**

PKLITE has an encrypted mode, and `depklite.py` was not using it. The two modes
produce output of *identical length* that *both* terminate cleanly, so nothing
in the obvious scoring could tell them apart. The wrong output looked plausible
— it even contained real-looking structure — but it was garbage. The tell is
that 124 KB of supposed DOS program contained **no `int 21h` at all** and not a
single `push bp; mov bp,sp`.

With `decrypt=True` the same file yields 83 prologues and 38 `int 21h` calls,
entropy falls from 7.39 to 6.82, and every string is in the clear:
`BMAN1.LV`, `bman1.dat`, `WRITE LEVEL`, `Clear this level (Y,N)?`,
`THE GAME ROOM`, `THE LIBRARY`, `SECRET`.

`depklite.py` now scores candidates on whether the output *disassembles*, not
on text density, so it cannot make this mistake again.

## The level table (solved)

`from_exe.py`. In the correctly decompressed shareware executable the rooms sit
in the clear at **`0x1aeb2`**:

```
644 records of 20 bytes = 23 screens x 28 records
each record: length byte 0x13 (= 19), then 19 tile bytes
```

The records are **columns, not rows**. Transposed, each screen is 28 wide by 19
tall — exactly the 556x342 playfield at the game's 20x18 pixel tiles.

| Screens | Contents |
|---|---|
| 0–16 | levels **A–Q**, all 17 |
| 17–22 | the six skits |

```
.  outside      *  wall        T  wall torch (solid)
   open         O  block       $  door
<  Block-Man facing left       >  facing right
```

Note the shareware executable carries **all 17 rooms**, not just the 10 it will
let you play.

**Verification.** Rooms B, C and D were independently recovered from published
screenshots by `from_screenshot.py`. Comparing block and door offsets relative
to Block-Man's start, the two methods — JPEG pixel analysis and binary
extraction — agree *exactly* on all three.

### Still unsolved

**Block-Man 2's level records.** Not SOLSOFT, and not coordinate pairs — the
even and odd byte streams have near-identical distributions. Worth redoing now
that `BMAN2.EXE` decompresses correctly (517 prologues, 92 `int 21h`); the
earlier analysis of it used the broken output.


