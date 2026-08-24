"""
Soleau Software's string obfuscation, broken.

    ciphertext[i] = plaintext[i] XOR (KEY[i mod 7] | 0x80)     KEY = "SOLSOFT"

Carriage return and line feed are passed through untouched, and the key index
RESETS at the start of every line. That last detail is what makes it work: with
the index running continuously the first line decodes and everything after it
turns to noise.

How it fell out: `BMAN1.OV3` in the registered release opens with
`f3 ef ec f3 ef e6 f4  f3 ef ec f3 ef e6 f4  f3 ef ec f3` - a seven-byte cycle.
The shareware build ships the same file unencrypted as `BMAN1.OV2`, and it
begins with a run of spaces, so each key byte is just `cipher XOR 0x20`. That
gives d3 cf cc d3 cf c6 d4, and XORing those with 0x80 spells SOLSOFT.

Verified: decrypts BMAN1.OV3 to 2,504 bytes of clean text, 0 non-text bytes.

    python tools/extract/solsoft.py BMAN1.OV3 > form.txt

NOTE: this key does NOT unlock everything. The obfuscated strings inside
BMAN1.EXE use a different, high-bit-clear scheme (both their plaintext and
ciphertext are printable ASCII, which a `| 0x80` key cannot produce), and the
Block-Man 2 level records are not covered by it either.
"""
import sys

KEY = bytes(ord(ch) | 0x80 for ch in 'SOLSOFT')


def decrypt(data: bytes) -> bytes:
    """Decrypt (or encrypt - it is symmetric) a Soleau-obfuscated blob."""
    out = bytearray()
    k = 0
    for b in data:
        if b in (0x0D, 0x0A):
            out.append(b)
            k = 0  # the key restarts on every line
            continue
        out.append(b ^ KEY[k])
        k = (k + 1) % len(KEY)
    return bytes(out)


def looks_like_text(data: bytes) -> float:
    """Fraction of bytes that are printable, tab, newline or DOS EOF."""
    if not data:
        return 0.0
    ok = sum(1 for b in data if 32 <= b < 127 or b in (9, 10, 13, 26))
    return ok / len(data)


if __name__ == '__main__':
    for path in sys.argv[1:]:
        raw = open(path, 'rb').read()
        out = decrypt(raw)
        score = looks_like_text(out)
        sys.stderr.write(f'{path}: {len(raw)} bytes, {score:.1%} text after decryption\n')
        sys.stdout.write(out.decode('latin1'))
