#!/usr/bin/env python
"""Rasterize source PDFs into per-page PNGs for vision transcription.

Shared across every language via --root <path/to/lang/extracted>. Reads
<root>/_tools/collections.json and, for each PDF-backed collection, renders
    <lang>/pdf/.../<file>.pdf  ->  <root>/<slug>/images/page-NNN.png
at 300 DPI, zero-padded to 3 digits. Uses PyMuPDF (fitz) — no poppler/
pdftoppm dependency.

A collection with "images_preexisting": true in collections.json is always
skipped, even under --all — for books whose images were produced by an
earlier, different process and must never be silently re-rasterized over.

Usage:
    python _engine/pdf_to_images.py --root french/extracted --all
    python _engine/pdf_to_images.py --root french/extracted <slug> [<slug>...]
    python _engine/pdf_to_images.py --root french/extracted --dpi 200 --all
"""
import os
import sys

import fitz  # PyMuPDF

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, lang_dir, load_collection_list, atomic_save_image


def render(pdf_path, out_dir, dpi=300):
    """Render every page of pdf_path to out_dir/page-NNN.png at the given DPI."""
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    n = doc.page_count
    for i in range(n):
        pix = doc.load_page(i).get_pixmap(dpi=dpi)
        # atomic_save_image works with any object exposing .save(path) --
        # fitz.Pixmap qualifies the same way a PIL Image does. A `--dpi`
        # re-run against an already-transcribed collection (a documented,
        # supported usage) must not risk corrupting a page image that a
        # transcription is already relying on.
        atomic_save_image(pix, os.path.join(out_dir, 'page-%03d.png' % (i + 1)))
    doc.close()
    return n


def main(argv):
    root = parse_root(argv)
    dpi = 300
    if '--dpi' in argv:
        k = argv.index('--dpi')
        dpi = int(argv[k + 1])
        del argv[k:k + 2]

    cols = load_collection_list(root)
    if '--all' in argv:
        targets = cols
    else:
        wanted = set(argv)
        targets = [c for c in cols if c['slug'] in wanted]
        if not targets:
            print('No matching collections. Use --all or a slug from collections.json.')
            return

    lang = lang_dir(root)
    for c in targets:
        if c.get('images_preexisting'):
            print('%-32s images pre-existing - skipped (images_preexisting: true)' % c['slug'])
            continue
        if not c.get('pdf'):
            continue
        pdf_path = os.path.join(lang, c['pdf'])
        out_dir = os.path.join(root, c['slug'], 'images')
        if not os.path.exists(pdf_path):
            print('MISSING pdf, skipping %s: %s' % (c['slug'], pdf_path))
            continue
        n = render(pdf_path, out_dir, dpi)
        print('%-32s %3d pages @ %d DPI -> %s' % (c['slug'], n, dpi, out_dir))


if __name__ == '__main__':
    main(sys.argv[1:])
