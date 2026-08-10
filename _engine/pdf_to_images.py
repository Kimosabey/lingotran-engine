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
    python _engine/pdf_to_images.py --root french/extracted --audit --all

Every render is screened for blank/degenerate pages before any vision budget
is spent on them; --audit re-runs that screen alone, without re-rasterizing.
"""
import glob
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


def image_health(path):
    """Classify a rendered page image as 'ok', 'blank' or 'degenerate'.

    Transcription is the single most expensive stage in this engine (~45% of
    spend, and QA re-reading the same image is another ~35%), so dispatching a
    vision agent at a page that carries no recoverable content is pure waste --
    and worse, it comes back as a mysterious "gap" that costs more cycles to
    investigate. Tricolore 2 lost four pages to exactly that: two genuinely
    blank, two rendered black by a colorspace bug, all four investigated by
    hand months later.

    Cheap, deterministic screen, no model involved:
      - blank      : one or two distinct luminance values, or effectively no
                     ink at all (a truly empty scan)
      - degenerate : a large solid-black region swallowing the page

    The discriminator for 'degenerate' is the share of pixels in the darkest
    16 levels, NOT mean brightness. Mean alone cannot tell a broken decode from
    a legitimately dark photographic cover -- measured on this corpus, the
    known-broken renders sit at 66.6% solid black while real covers (which can
    be darker than average overall) sit between 0% and 10.7%. Thresholding on
    mean flagged every cover in the corpus; this separates them cleanly.
    """
    with Image.open(path) as im:
        hist = im.convert('L').histogram()
    total = sum(hist) or 1
    distinct = sum(1 for c in hist if c)
    mean = sum(i * c for i, c in enumerate(hist)) / float(total)
    solid_black = sum(hist[:16]) / float(total)
    ink = sum(c for i, c in enumerate(hist) if i < 200) / float(total)
    # Order matters: a page that is half solid black has only two distinct
    # luminance values, so a "few distinct values => blank" test would claim it
    # is empty. Rule out the broken/black case first, and require blankness to
    # actually be WHITE rather than merely low-variety.
    if solid_black > 0.35:
        return 'degenerate', mean, solid_black
    if (distinct <= 2 and mean > 240) or ink < 0.0005:
        return 'blank', mean, solid_black
    return 'ok', mean, solid_black


def audit_images(out_dir):
    """Screen already-rendered page images; returns {page_number: reason}."""
    flagged = {}
    for fp in sorted(glob.glob(os.path.join(out_dir, 'page-*.png'))):
        try:
            state, mean, solid = image_health(fp)
        except Exception as e:
            flagged[os.path.basename(fp)] = 'unreadable (%s)' % e
            continue
        if state != 'ok':
            flagged[os.path.basename(fp)] = '%s (mean luminance %.0f, %.0f%% solid black)' % (
                state, mean, 100 * solid)
    return flagged


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
    # --audit screens already-rendered images without re-rasterizing, so a
    # book whose images predate this check can still be swept.
    audit_only = '--audit' in argv
    if audit_only:
        argv.remove('--audit')
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
        if audit_only:
            flagged = audit_images(out_dir)
            print('%-32s %3d image(s) screened, %d flagged'
                  % (c['slug'], len(glob.glob(os.path.join(out_dir, 'page-*.png'))), len(flagged)))
            for name, why in sorted(flagged.items()):
                print('%-32s   %s: %s' % ('', name, why))
            continue
        n, repaired = render(pdf_path, out_dir, dpi)
        print('%-32s %3d pages @ %d DPI -> %s' % (c['slug'], n, dpi, out_dir))
        if repaired:
            print('%-32s   %d page(s) decoded from the embedded scan (declared /ColorSpace '
                  'contradicts the JPEG): %s' % ('', len(repaired), repaired))
        # Screen before anyone spends vision budget on these pages.
        flagged = audit_images(out_dir)
        if flagged:
            print('%-32s   %d page(s) look blank or degenerate - review BEFORE dispatching'
                  % ('', len(flagged)))
            print('%-32s   transcription agents at them (see PLAYBOOK.md):' % '')
            for name, why in sorted(flagged.items()):
                print('%-32s     %s: %s' % ('', name, why))


if __name__ == '__main__':
    main(sys.argv[1:])
