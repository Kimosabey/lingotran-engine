#!/usr/bin/env python
"""Crop a sub-region of a PNG (fractional coords 0..1) and upscale 2x for legible reading.
Usage: python _tools/zoom.py <image.png> <x0> <y0> <x1> <y1> <out.png>
Example (top-right quadrant): python _tools/zoom.py page-010.png 0.5 0 1 0.5 /tmp/z.png"""
import sys
from PIL import Image

p = sys.argv[1]
x0, y0, x1, y1 = (float(v) for v in sys.argv[2:6])
out = sys.argv[6]
im = Image.open(p)
W, H = im.size
c = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
c = c.resize((max(1, c.width * 2), max(1, c.height * 2)))
c.save(out)
print('zoom saved', out, c.size)
