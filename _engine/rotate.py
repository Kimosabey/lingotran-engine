#!/usr/bin/env python
"""Rotate a PNG CLOCKWISE by N degrees (90/180/270), overwriting it, expanding canvas.
Shared across every language — no --root needed, takes an image path directly.
Usage: python _engine/rotate.py <image.png> <90|180|270>"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import atomic_save_image

path, deg = sys.argv[1], int(sys.argv[2])
# PIL .rotate is counter-clockwise for positive angles; negate to rotate clockwise.
# Open in a `with` block so the source file handle is closed before we try to
# os.replace() over it below -- on Windows a still-open handle would make the
# replace fail with a file-in-use error.
with Image.open(path) as src:
    img = src.rotate(-deg, expand=True)
atomic_save_image(img, path)
print('rotated %s clockwise %d deg' % (path, deg))
