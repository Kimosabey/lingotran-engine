#!/usr/bin/env python
"""Screening page images before transcription.

Vision transcription plus its QA re-read is ~80% of this engine's spend, so
dispatching an agent at a page that carries nothing is the most expensive kind
of waste -- and it comes back as a "gap" that costs more cycles to diagnose.
Tricolore 2 lost four pages that way.

The subtle part is not detecting a black page; it is NOT flagging a book cover,
which is legitimately dark. These tests pin that distinction.
"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
from pdf_to_images import image_health, audit_images


class ImageHealthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def save(self, img, name='page-001.png'):
        p = os.path.join(self.tmp, name)
        img.save(p)
        return p

    def test_uniform_white_page_is_blank(self):
        state, _, _ = image_health(self.save(Image.new('L', (200, 280), 255)))
        self.assertEqual(state, 'blank')

    def test_page_with_a_few_specks_is_still_blank(self):
        img = Image.new('L', (400, 560), 255)
        for x in range(3):
            img.putpixel((x, 0), 0)
        state, _, _ = image_health(self.save(img))
        self.assertEqual(state, 'blank')

    def test_mostly_black_page_is_degenerate(self):
        """The broken-colorspace renders sat at ~67% solid black."""
        img = Image.new('L', (200, 280), 255)
        img.paste(0, (0, 90, 200, 280))
        state, _, solid = image_health(self.save(img))
        self.assertEqual(state, 'degenerate')
        self.assertGreater(solid, 0.35)

    def test_dark_photographic_cover_is_not_flagged(self):
        """The false positive that matters: a real cover is dark on average but
        has little SOLID black, so mean brightness alone cannot be the test."""
        img = Image.new('L', (200, 280))
        for y in range(280):
            for x in range(200):
                img.putpixel((x, y), 40 + ((x * 3 + y * 5) % 170))
        state, mean, solid = image_health(self.save(img))
        self.assertEqual(state, 'ok', 'mean=%.0f solid=%.2f' % (mean, solid))

    def test_ordinary_text_page_is_ok(self):
        img = Image.new('L', (400, 560), 255)
        for row in range(20, 500, 24):
            img.paste(30, (40, row, 360, row + 8))
        self.assertEqual(image_health(self.save(img))[0], 'ok')

    def test_audit_reports_only_the_bad_pages(self):
        self.save(Image.new('L', (200, 280), 255), 'page-001.png')          # blank
        good = Image.new('L', (200, 280), 255)
        for row in range(10, 260, 12):
            good.paste(30, (20, row, 180, row + 4))
        self.save(good, 'page-002.png')                                      # ok
        flagged = audit_images(self.tmp)
        self.assertIn('page-001.png', flagged)
        self.assertNotIn('page-002.png', flagged)


if __name__ == '__main__':
    unittest.main()
