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
import io
import os
import sys

import fitz  # PyMuPDF
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import parse_root, lang_dir, load_collection_list, atomic_save_image


def _miscoloured_full_page_image(doc, page):
    """Return the embedded image dict when a page is one full-page image whose
    JPEG channel count contradicts the PDF-declared /ColorSpace, else None.

    Some scanned PDFs embed a 1-channel grayscale JPEG but declare the XObject
    /DeviceRGB. MuPDF trusts the declaration and reads 3 bytes per pixel out of
    1-byte-per-pixel data, so the page renders as dark garbage while the
    embedded scan itself is perfectly legible. Found on tricolore-2-5th-edition
    pages 2, 4, 178 and 179 -- page 178 (Acknowledgements) had been written off
    as a permanent transcription gap purely because of this. Decoding the
    embedded image directly sidesteps MuPDF's colour handling entirely.

    Deliberately narrow: only single-image pages, and only when the channel
    count genuinely disagrees. Anything else renders normally.
    """
    images = page.get_images(full=True)
    if len(images) != 1:
        return None
    xref = images[0][0]
    declared = str(doc.xref_get_key(xref, 'ColorSpace')[1])
    if 'RGB' in declared:
        expected = 3
    elif 'Gray' in declared:
        expected = 1
    else:
        return None
    try:
        info = doc.extract_image(xref)
        with Image.open(io.BytesIO(info['image'])) as probe:
            actual = len(probe.getbands())
    except Exception:
        return None
    return info if actual != expected else None


def render(pdf_path, out_dir, dpi=300):
    """Render every page of pdf_path to out_dir/page-NNN.png at the given DPI."""
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    n = doc.page_count
    repaired = []
    for i in range(n):
        page = doc.load_page(i)
        out_path = os.path.join(out_dir, 'page-%03d.png' % (i + 1))
        # atomic_save_image works with any object exposing .save(path) --
        # fitz.Pixmap and PIL Image both qualify. A `--dpi` re-run against an
        # already-transcribed collection (a documented, supported usage) must
        # not risk corrupting a page image that a transcription is relying on.
        info = _miscoloured_full_page_image(doc, page)
        if info is None:
            atomic_save_image(page.get_pixmap(dpi=dpi), out_path)
            continue
        # Scale the embedded scan to the same pixel size the page render would
        # have produced, so downstream zoom/crop maths stays DPI-consistent.
        with Image.open(io.BytesIO(info['image'])) as embedded:
            target = (int(page.rect.width * dpi / 72.0), int(page.rect.height * dpi / 72.0))
            atomic_save_image(embedded.convert('RGB').resize(target, Image.LANCZOS), out_path)
        repaired.append(i + 1)
    doc.close()
    return n, repaired


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
        n, repaired = render(pdf_path, out_dir, dpi)
        print('%-32s %3d pages @ %d DPI -> %s' % (c['slug'], n, dpi, out_dir))
        if repaired:
            print('%-32s   %d page(s) decoded from the embedded scan (declared /ColorSpace '
                  'contradicts the JPEG): %s' % ('', len(repaired), repaired))


if __name__ == '__main__':
    main(sys.argv[1:])
