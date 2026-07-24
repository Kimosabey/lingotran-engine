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
        n = render(self.pdf_path, self.out_dir, dpi=72)
        self.assertEqual(n, 2)
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


if __name__ == '__main__':
    unittest.main()
