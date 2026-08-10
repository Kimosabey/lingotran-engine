#!/usr/bin/env python
"""IT2-P1-1: render() wrote every rasterized page via a raw pix.save(...) --
the same non-atomic overwrite-in-place risk P0-2 already fixed once for
rotate.py, in a sibling call site that was missed. A `--dpi` re-run against
an already-transcribed collection is documented, supported usage, so a
crash mid-render must never leave a corrupted/truncated page image
overwriting the only copy of that page.
"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fitz
from PIL import Image
from pdf_to_images import render


class RenderCrashSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.pdf_path = os.path.join(self.tmpdir, 'src.pdf')
        doc = fitz.open()
        doc.new_page()
        doc.new_page()
        doc.save(self.pdf_path)
        doc.close()
        self.out_dir = os.path.join(self.tmpdir, 'images')

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_renders_every_page(self):
        n, repaired = render(self.pdf_path, self.out_dir, dpi=72)
        self.assertEqual(n, 2)
        self.assertEqual(repaired, [])
        self.assertTrue(os.path.exists(os.path.join(self.out_dir, 'page-001.png')))
        self.assertTrue(os.path.exists(os.path.join(self.out_dir, 'page-002.png')))

    def test_rerun_atomically_replaces_existing_page(self):
        """The documented --dpi re-run scenario: page-001.png already
        exists from a prior run and must be fully replaced, never
        corrupted, by a second render() call."""
        render(self.pdf_path, self.out_dir, dpi=72)
        first_bytes = open(os.path.join(self.out_dir, 'page-001.png'), 'rb').read()
        self.assertTrue(len(first_bytes) > 0)

        render(self.pdf_path, self.out_dir, dpi=150)
        second_bytes = open(os.path.join(self.out_dir, 'page-001.png'), 'rb').read()
        self.assertTrue(len(second_bytes) > 0)
        # Higher DPI must produce a larger, genuinely-different file -- proof
        # the second run's pixels actually landed, not a stale/half-written one.
        self.assertNotEqual(first_bytes, second_bytes)

    def test_no_temp_file_left_behind(self):
        """atomic_save_image writes through a temp file then os.replace --
        confirm no .tmp leftover remains after a normal, successful run."""
        render(self.pdf_path, self.out_dir, dpi=72)
        leftovers = [f for f in os.listdir(self.out_dir) if '.tmp' in f]
        self.assertEqual(leftovers, [])


class MiscolouredEmbeddedImageTests(unittest.TestCase):
    """A page embedding a 1-channel grayscale JPEG while declaring /DeviceRGB
    renders as dark garbage under MuPDF even though the scan is legible.
    render() must notice the contradiction and decode the embedded image
    instead. Regression cover for tricolore-2-5th-edition pages 2/4/178/179 --
    page 178 was written off as a permanent transcription gap because of it.
    """

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.out_dir = os.path.join(self.tmpdir, 'images')
        self.pdf_path = os.path.join(self.tmpdir, 'gray.pdf')

        # A mostly-white grayscale JPEG with a dark band -- stands in for a
        # scanned text page (light overall, some ink).
        img = Image.new('L', (120, 160), color=255)
        img.paste(0, (10, 20, 110, 40))
        jpeg_path = os.path.join(self.tmpdir, 'scan.jpg')
        img.save(jpeg_path, 'JPEG', quality=90)

        doc = fitz.open()
        page = doc.new_page(width=120, height=160)
        page.insert_image(page.rect, filename=jpeg_path)
        doc.save(self.pdf_path)
        doc.close()

        # Force the malformed condition: relabel the 1-channel JPEG /DeviceRGB.
        doc = fitz.open(self.pdf_path)
        xref = doc[0].get_images(full=True)[0][0]
        doc.xref_set_key(xref, 'ColorSpace', '/DeviceRGB')
        doc.save(os.path.join(self.tmpdir, 'gray2.pdf'))
        doc.close()
        self.pdf_path = os.path.join(self.tmpdir, 'gray2.pdf')

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_reports_and_repairs_the_mismatched_page(self):
        n, repaired = render(self.pdf_path, self.out_dir, dpi=72)
        self.assertEqual(n, 1)
        self.assertEqual(repaired, [1], 'the mismatched page should be repaired and reported')

    def test_repaired_page_keeps_the_scan_legible(self):
        """The whole point: the output must look like the light scan it is,
        not the dark garbage MuPDF produces from the bad declaration."""
        render(self.pdf_path, self.out_dir, dpi=72)
        with Image.open(os.path.join(self.out_dir, 'page-001.png')) as out:
            mean = sum(out.convert('L').getdata()) / float(out.width * out.height)
        self.assertGreater(mean, 170, 'repaired page should stay light, like the source scan')

    def test_repaired_page_matches_requested_dpi_dimensions(self):
        """Downstream zoom/crop maths assumes page pixel size tracks DPI, so
        the embedded scan must be scaled to the same size a render would be."""
        render(self.pdf_path, self.out_dir, dpi=144)
        with Image.open(os.path.join(self.out_dir, 'page-001.png')) as out:
            self.assertEqual(out.size, (240, 320))


if __name__ == '__main__':
    unittest.main()
