#!/usr/bin/env python3
# Usage: python3 scripts/render-tray-icon.py src-tauri/icons/tray-template.png 44
# Renders the FileHop arrow (from icons/source.svg) as a monochrome template PNG.
import math, struct, sys, zlib
size, ss = int(sys.argv[2]), 4
segments = [((153, 359), (359, 153)), ((185, 153), (359, 153)), ((359, 153), (359, 327))]
lo, hi = 130, 382
pad = size * 0.14
scale = (size - 2 * pad) / (hi - lo)
width = 46 * scale  # stroke, slightly bolder than the app icon for the menu bar
def m(p): return ((p[0] - lo) * scale + pad, (p[1] - lo) * scale + pad)
segs = [(m(a), m(b)) for a, b in segments]
def dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
rows = []
for y in range(size):
    row = bytearray([0])
    for x in range(size):
        hits = 0
        for sy in range(ss):
            for sx in range(ss):
                px, py = x + (sx + 0.5) / ss, y + (sy + 0.5) / ss
                if min(dist(px, py, a, b) for a, b in segs) <= width / 2:
                    hits += 1
        row += bytes([0, 0, 0, round(255 * hits / (ss * ss))])
    rows.append(bytes(row))
def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
open(sys.argv[1], "wb").write(png)
