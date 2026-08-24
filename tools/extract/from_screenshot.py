"""
Recover Block-Man rooms from 640x350 EGA gameplay screenshots.

The playfield is a grid of 20x18 pixel tiles with origin (0, 4). Both were
confirmed by measuring the blue block sprites: they are drawn 19x17 and always
land on x = 0 (mod 20), y = 4 (mod 18). The sidebar starts at x = 556.

Colours are matched by RGB, not palette index - each screenshot carries its own
palette, so indices are not comparable between files.

    black             outside the cavern
    grey              the open interior
    red               brick wall
    blue              movable block
    yellow + green    the exit doorway (a two-tone triangle)
    green alone       Block-Man

Green appears in both Block-Man and the doorway, so they are told apart by
position: the doorway's green half sits on the doorway's own cell.

    python tools/extract/from_screenshot.py shot.png [...]
"""
import sys

from PIL import Image

TW, TH = 20, 18
OX, OY = 0, 4
PLAY_W = 556

EGA = {
    'black': [(0, 0, 0)],
    'grey': [(85, 85, 85), (171, 171, 171)],
    'brick': [(171, 0, 0), (255, 85, 85)],
    'block': [(0, 0, 171), (85, 85, 255)],
    'yellow': [(255, 255, 85), (171, 85, 0)],
    'green': [(0, 171, 0), (85, 255, 85)],
}
LOOKUP = {rgb: name for name, rgbs in EGA.items() for rgb in rgbs}

# Some uploads were re-encoded and carry slightly off-palette shades (one has
# green as (21,188,21)), so fall back to the nearest EGA colour within range.
_CACHE = dict(LOOKUP)


def classify(rgb):
    hit = _CACHE.get(rgb)
    if hit is not None:
        return hit
    best, bestd = None, 60 ** 2
    for name, rgbs in EGA.items():
        for ref in rgbs:
            dist = sum((a - b) ** 2 for a, b in zip(rgb, ref))
            if dist < bestd:
                best, bestd = name, dist
    _CACHE[rgb] = best
    return best


def load(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    return im.load(), min(w, PLAY_W), h


def kind(px, x, y):
    return classify(px[x, y])


def components(px, w, h, name):
    """4-connected blobs of one colour class, as (x, y, w, h, area)."""
    seen = set()
    out = []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or kind(px, x, y) != name:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                        if kind(px, nx, ny) == name:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            xs = [c[0] for c in cells]
            ys = [c[1] for c in cells]
            out.append((min(xs), min(ys), max(xs) - min(xs) + 1,
                        max(ys) - min(ys) + 1, len(cells)))
    return out


def cell_of(x, y):
    return (x - OX) // TW, (y - OY) // TH


def extract(path):
    px, w, h = load(path)
    cols, rws = (PLAY_W - OX) // TW, (h - OY) // TH

    grid = [['X'] * cols for _ in range(rws)]
    for r in range(rws):
        for c in range(cols):
            tally = {}
            for dy in range(2, TH - 2):
                for dx in range(2, TW - 2):
                    x, y = OX + c * TW + dx, OY + r * TH + dy
                    if x < w and y < h:
                        k = kind(px, x, y)
                        if k:
                            tally[k] = tally.get(k, 0) + 1
            block = tally.get('block', 0)
            brick = tally.get('brick', 0)
            grey = tally.get('grey', 0)
            if block > 60:
                grid[r][c] = 'o'
            elif brick > 20 and brick >= grey:
                grid[r][c] = '#'
            elif grey > 20:
                grid[r][c] = '.'

    door = player = None
    yellows = sorted(components(px, w, h, 'yellow'), key=lambda b: -b[4])
    if yellows:
        b = yellows[0]
        door = cell_of(b[0] + b[2] // 2, b[1] + b[3] // 2)

    for b in sorted(components(px, w, h, 'green'), key=lambda b: -b[4]):
        c, r = cell_of(b[0] + b[2] // 2, b[1] + b[3] // 2)
        if door and abs(c - door[0]) <= 1 and abs(r - door[1]) <= 1:
            continue  # the doorway's own green half
        player = (c, r)
        break

    for pos, ch in ((door, 'D'), (player, '@')):
        if pos and 0 <= pos[1] < rws and 0 <= pos[0] < cols:
            grid[pos[1]][pos[0]] = ch

    keep_r = [r for r in range(rws) if any(ch != 'X' for ch in grid[r])]
    if not keep_r:
        return None
    r0, r1 = keep_r[0], keep_r[-1]
    keep_c = [c for c in range(cols) if any(grid[r][c] != 'X' for r in range(r0, r1 + 1))]
    c0, c1 = keep_c[0], keep_c[-1]

    # Outside the cavern becomes solid wall so Block-Man cannot walk off.
    rows = [''.join(grid[r][c0:c1 + 1]).replace('X', '#') for r in range(r0, r1 + 1)]
    shift = lambda p: None if p is None else (p[0] - c0, p[1] - r0)
    return rows, shift(door), shift(player)


if __name__ == '__main__':
    for path in sys.argv[1:]:
        res = extract(path)
        if not res:
            print(f"{path}: no room found")
            continue
        rows, door, player = res
        print(f"=== {path}  {len(rows[0])}x{len(rows)}  door={door}  player={player}")
        for r in rows:
            print("   " + r)
        print()
