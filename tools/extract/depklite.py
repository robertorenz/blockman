"""
Pure-Python PKLITE decompressor.

Ported from hackerb9/depklite (MIT), which derives from refkeen's depklite,
which in turn came from OpenTESArena's ExeUnpacker. Format documented by
@dozayon in OpenTESArena/docs/pklite_specification.md.

The compressed-data offset is not recorded anywhere in the file, so
find_offset() brute-forces it and scores each candidate.
"""

# --- bit trees, transcribed from depklite.c ------------------------------
# Each node is (left, right, value); left/right are RELATIVE indices, and a
# node with left == right == 0 is a leaf.

def ST(l, r): return (l, r, -1)
def LF(v):    return (0, 0, v)

# Section 4.3.1 "Number of bytes"
BIT_TREE_1 = [
    ST(4, 1),
    ST(1, 2), LF(2), LF(3),
    ST(1, 6), ST(1, 2), LF(4), ST(1, 2), LF(5), LF(6),
    ST(1, 6), ST(1, 2), LF(7), ST(1, 2), LF(8), LF(9),
    ST(1, 6), ST(1, 2), LF(10), ST(1, 2), LF(11), LF(12),
    ST(1, 6), ST(1, 2), LF(25), ST(1, 2), LF(13), LF(14),
    ST(1, 6), ST(1, 2), LF(15), ST(1, 2), LF(16), LF(17),
    ST(1, 6), ST(1, 2), LF(18), ST(1, 2), LF(19), LF(20),
    ST(1, 4), ST(1, 2), LF(21), LF(22),
    ST(1, 2), LF(23),
    LF(24),
]

# Section 4.3.2 "Offset"
BIT_TREE_2 = [
    ST(2, 1),
    LF(0),
    ST(1, 12),
        ST(1, 4), ST(1, 2), LF(1), LF(2),
        ST(1, 4), ST(1, 2), LF(3), LF(4),
        ST(1, 2), LF(5),
        LF(6),
    ST(1, 18),
        ST(1, 8),
            ST(1, 4), ST(1, 2), LF(7), LF(8),
            ST(1, 2), LF(9),
            LF(10),
        ST(1, 4), ST(1, 2), LF(11), LF(12),
        ST(1, 2), LF(13),
        ST(1, 2), LF(14),
        LF(15),
    ST(1, 16),
        ST(1, 8),
            ST(1, 4), ST(1, 2), LF(16), LF(17),
            ST(1, 2), LF(18),
            LF(19),
        ST(1, 4), ST(1, 2), LF(20), LF(21),
        ST(1, 2), LF(22),
        LF(23),
    ST(1, 8),
        ST(1, 4), ST(1, 2), LF(24), LF(25),
        ST(1, 2), LF(26),
        LF(27),
    ST(1, 4), ST(1, 2), LF(28), LF(29),
    ST(1, 2), LF(30),
    LF(31),
]


class Bits:
    """The theoretical bit stream: 16-bit little-endian arrays, LSB first."""

    def __init__(self, data, start):
        self.d = data
        self.i = start + 2
        self.bit_array = data[start] | (data[start + 1] << 8)
        self.bits_read = 0

    def next_byte(self):
        b = self.d[self.i]
        self.i += 1
        return b

    def next_bit(self):
        bit = (self.bit_array & (1 << self.bits_read)) != 0
        self.bits_read += 1
        if self.bits_read == 16:
            self.bits_read = 0
            b1 = self.next_byte()
            b2 = self.next_byte()
            self.bit_array = b1 | (b2 << 8)
        return bit

    def tree(self, t):
        n = 0
        while True:
            left, right, _ = t[n]
            n += right if self.next_bit() else left
            if t[n][0] == 0 and t[n][1] == 0:
                return t[n][2]


def unpack(data, offset, decrypt=False, max_out=1 << 21):
    """Decompress starting at `offset`. Returns (bytes, clean_end)."""
    bits = Bits(data, offset)
    out = bytearray()

    while True:
        if bits.next_bit():
            # Duplication mode.
            copy = bits.tree(BIT_TREE_1)
            if copy == 25:
                b = bits.next_byte()
                if b == 0xFE:
                    continue
                if b == 0xFF:
                    return bytes(out), True
                count = b + 25
            else:
                count = copy

            msb = 0 if count == 2 else bits.tree(BIT_TREE_2)
            lsb = bits.next_byte()
            dist = lsb | (msb << 8)

            if dist == 0 or dist > len(out):
                return bytes(out), False
            start = len(out) - dist
            for k in range(count):
                out.append(out[start + k])
        else:
            b = bits.next_byte()
            if decrypt:
                b ^= (16 - bits.bits_read) & 0xFF
            out.append(b)

        if len(out) >= max_out:
            return bytes(out), False


def estimate_length(data):
    """dozayon's slight over-estimate of the decompressed size."""
    value = int.from_bytes(data[0x61:0x63], 'little')
    return value * 0x10 - 0x450


def score(out, clean):
    """Prefer clean termination, plenty of output, and real text inside."""
    if not out:
        return -1
    printable = sum(1 for b in out if 32 <= b < 127 or b in (9, 10, 13))
    return (1_000_000 if clean else 0) + len(out) + int(printable / len(out) * 100_000)


def find_offset(data, lo=0x60, hi=0x800, decrypt=False, verbose=False):
    """Brute-force the compressed-data offset; return (offset, out, clean)."""
    best = (None, b'', False, -1)
    for off in range(lo, min(hi, len(data) - 4)):
        try:
            out, clean = unpack(data, off, decrypt)
        except (IndexError, ValueError):
            continue
        s = score(out, clean)
        if s > best[3]:
            best = (off, out, clean, s)
            if verbose:
                print(f"  offset 0x{off:04x}: {len(out):7d} bytes clean={clean} score={s}")
    return best[0], best[1], best[2]


if __name__ == '__main__':
    import sys
    path = sys.argv[1]
    data = open(path, 'rb').read()
    print(f"{path}: {len(data)} bytes, estimated decompressed ~{estimate_length(data)}")
    for dec in (False, True):
        off, out, clean = find_offset(data, decrypt=dec, verbose=True)
        print(f"decrypt={dec}: best offset 0x{off:04x} -> {len(out)} bytes, clean={clean}")
        if out:
            open(path + ('.dec' if dec else '.dep'), 'wb').write(out)
