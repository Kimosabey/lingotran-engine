#!/usr/bin/env python
"""Rotate a PNG CLOCKWISE by N degrees (90/180/270), overwriting it, expanding canvas.
Usage: python _tools/rotate.py <image.png> <90|180|270>"""
import sys
from PIL import Image

path, deg = sys.argv[1], int(sys.argv[2])
# PIL .rotate is counter-clockwise for positive angles; negate to rotate clockwise.
Image.open(path).rotate(-deg, expand=True).save(path)
print('rotated %s clockwise %d deg' % (path, deg))
