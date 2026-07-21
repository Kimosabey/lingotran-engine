#!/usr/bin/env python
"""Rasterize source PDFs into per-page PNGs for vision transcription.

Fills the one gap the French pipeline never had (it assumed page images already
existed). Uses PyMuPDF (fitz) — the only PDF rasterizer installed — so there is
no poppler/pdftoppm dependency.

Reads collections.json and, for each PDF-backed collection, renders
    german/pdf/.../<file>.pdf  ->  german/extracted/<slug>/images/page-NNN.png
at 300 DPI (matching the French convention), zero-padded to 3 digits.

Usage:
    python _tools/pdf_to_images.py --all            # every collection
    python _tools/pdf_to_images.py <slug> [<slug>…]  # specific collections
    python _tools/pdf_to_images.py --dpi 200 --all   # override DPI
"""
import json
import os
import sys

import fitz  # PyMuPDF

TOOLS = os.path.dirname(os.path.abspath(__file__))
EXTRACTED = os.path.dirname(TOOLS)          # german/extracted/
GERMAN = os.path.dirname(EXTRACTED)         # german/
CONFIG = os.path.join(TOOLS, 'collections.json')


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


def render(pdf_path, out_dir, dpi=300):
    """Render every page of pdf_path to out_dir/page-NNN.png at the given DPI."""
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    n = doc.page_count
    for i in range(n):
        pix = doc.load_page(i).get_pixmap(dpi=dpi)
        pix.save(os.path.join(out_dir, 'page-%03d.png' % (i + 1)))
    doc.close()
    return n


def main(argv):
    dpi = 300
    if '--dpi' in argv:
        k = argv.index('--dpi')
        dpi = int(argv[k + 1])
        del argv[k:k + 2]

    cols = load_collections()
    if '--all' in argv:
        targets = cols
    else:
        wanted = set(argv)
        targets = [c for c in cols if c['slug'] in wanted]
        if not targets:
            print('No matching collections. Use --all or a slug from collections.json.')
            return

    for c in targets:
        if not c.get('pdf'):
            continue
        pdf_path = os.path.join(GERMAN, c['pdf'])
        out_dir = os.path.join(EXTRACTED, c['slug'], 'images')
        if not os.path.exists(pdf_path):
            print('MISSING pdf, skipping %s: %s' % (c['slug'], pdf_path))
            continue
        n = render(pdf_path, out_dir, dpi)
        print('%-32s %3d pages @ %d DPI -> %s' % (c['slug'], n, dpi, out_dir))


if __name__ == '__main__':
    main(sys.argv[1:])
