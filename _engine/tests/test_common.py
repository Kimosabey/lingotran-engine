#!/usr/bin/env python
"""Fixture tests for the specific bugs found by the docs/ e2e review, not a
general coverage mandate -- each test maps directly to one finding. Plain
stdlib unittest, no new dependency.

Usage: python -m unittest discover -s _engine/tests -v
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _common import atomic_open, atomic_write_text, atomic_save_image


class AtomicWriteTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.path = os.path.join(self.tmpdir, 'target.txt')

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_success_path_writes_file(self):
        atomic_write_text(self.path, 'hello')
        self.assertEqual(open(self.path, encoding='utf-8').read(), 'hello')

    def test_failure_leaves_no_file(self):
        with self.assertRaises(RuntimeError):
            with atomic_open(self.path, 'w', encoding='utf-8') as f:
                f.write('partial')
                raise RuntimeError('simulated crash mid-write')
        self.assertFalse(os.path.exists(self.path))
        leftover_tmp = [n for n in os.listdir(self.tmpdir) if n.startswith('.tmp-atomic-')]
        self.assertEqual(leftover_tmp, [], 'a failed write must not leave a temp file behind either')

    def test_overwrite_failure_preserves_existing_good_file(self):
        """The critical case: a crash mid-REWRITE of an already-good file
        must leave that good file exactly as it was, not truncated."""
        atomic_write_text(self.path, 'GOOD CONTENT')
        with self.assertRaises(RuntimeError):
            with atomic_open(self.path, 'w', encoding='utf-8') as f:
                f.write('half-written garbage')
                raise RuntimeError('simulated crash mid-overwrite')
        self.assertEqual(open(self.path, encoding='utf-8').read(), 'GOOD CONTENT')

    def test_works_with_json_dump(self):
        with atomic_open(self.path, 'w', encoding='utf-8') as f:
            json.dump({'a': 1}, f)
        self.assertEqual(json.load(open(self.path, encoding='utf-8')), {'a': 1})


class AtomicSaveImageTests(unittest.TestCase):
    """P0-2: rotate.py used to overwrite its source image non-atomically."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.path = os.path.join(self.tmpdir, 'page.png')

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_atomic_save_image_overwrite_survives_a_crash(self):
        from PIL import Image
        Image.new('RGB', (10, 10), 'white').save(self.path)
        original_bytes = open(self.path, 'rb').read()

        class ExplodingImage:
            def save(self, path):
                raise RuntimeError('simulated crash mid-save')

        with self.assertRaises(RuntimeError):
            atomic_save_image(ExplodingImage(), self.path)
        self.assertEqual(open(self.path, 'rb').read(), original_bytes,
                         'a crash mid-save must leave the previous good PNG untouched')


if __name__ == '__main__':
    unittest.main()
