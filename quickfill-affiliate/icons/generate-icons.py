#!/usr/bin/env python3
"""Rasterise icon.svg's design into 16/48/128 px PNGs.

Pure standard library (zlib + struct) so the extension has no build step and no
npm dependencies. Re-run with:  python3 icons/generate-icons.py
"""
import struct
import zlib

SIZES = (16, 48, 128)
SS = 4  # supersampling factor

TOP = (0x22, 0xC5, 0x5E)
BOTTOM = (0x15, 0x80, 0x3D)
WHITE = (0xFF, 0xFF, 0xFF)

# Lightning bolt, in the same 0..128 space as icon.svg.
BOLT = [(71.7, 17.9), (38.4, 70.4), (58.9, 70.4), (53.8, 110.1),
        (89.6, 56.7), (69.1, 56.7)]

RECT = (8.0, 8.0, 120.0, 120.0)  # x0, y0, x1, y1
RADIUS = 28.0


def in_rounded_rect(x, y):
    x0, y0, x1, y1 = RECT
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    for cx, cy in ((x0 + RADIUS, y0 + RADIUS), (x1 - RADIUS, y0 + RADIUS),
                   (x0 + RADIUS, y1 - RADIUS), (x1 - RADIUS, y1 - RADIUS)):
        outside_x = (x < cx) if cx == x0 + RADIUS else (x > cx)
        outside_y = (y < cy) if cy == y0 + RADIUS else (y > cy)
        if outside_x and outside_y:
            return (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2
    return True


def in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[(i - 1) % n]
        if (yi > y) != (yj > y):
            if x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                inside = not inside
    return inside


def sample(x, y):
    """Return (r, g, b, a) for a point in the 128x128 design space."""
    if not in_rounded_rect(x, y):
        return (0, 0, 0, 0)
    if in_polygon(x, y, BOLT):
        return WHITE + (255,)
    t = (y - RECT[1]) / (RECT[3] - RECT[1])
    return tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)


def render(size):
    scale = 128.0 / size
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) * scale
                    y = (py + (sy + 0.5) / SS) * scale
                    sr, sg, sb, sa = sample(x, y)
                    r += sr * sa
                    g += sg * sa
                    b += sb * sa
                    a += sa
            n = SS * SS
            if a:
                row += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for size in SIZES:
        out = os.path.join(here, "icon%d.png" % size)
        write_png(out, size, render(size))
        print("wrote", out)
