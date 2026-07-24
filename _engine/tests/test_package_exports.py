#!/usr/bin/env python
"""P0-1: package_exports.py used to shutil.rmtree() the existing _exports/
before rebuilding it, non-atomically, file by file. A crash anywhere during
the rebuild left a partially-populated or EMPTY _exports/ -- the previously
good, already-delivered tree was simply gone. Fixed to stage-then-swap: build
into a sibling _exports.tmp, then atomically swap it over the real _exports/.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import package_exports


def _make_fixture(root):
    os.makedirs(os.path.join(root, '_tools'))
    os.makedirs(os.path.join(root, 'book-one'))
    json.dump(
        {'language': 'Testlang', 'language_code': 'tl',
         'collections': [{'slug': 'book-one', 'title': 'Book One', 'level': 'A1', 'level_mode': 'fixed'}]},
        open(os.path.join(root, '_tools', 'collections.json'), 'w', encoding='utf-8'))
    open(os.path.join(root, 'book-one', 'book-one.md'), 'w', encoding='utf-8').write('hello world')
    open(os.path.join(root, 'testlang-catalog-all.csv'), 'w', encoding='utf-8-sig').write('col1,col2\na,b\n')


class StageThenSwapTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        _make_fixture(self.root)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_two_consecutive_runs_both_succeed(self):
        package_exports.main(['--root', self.root])
        out = os.path.join(self.root, '_exports')
        self.assertTrue(os.path.exists(os.path.join(out, 'README.md')))
        self.assertTrue(os.path.exists(os.path.join(out, 'book-one.md')))
        # a second run must swap cleanly over the first, not error or duplicate
        package_exports.main(['--root', self.root])
        self.assertTrue(os.path.exists(os.path.join(out, 'README.md')))
        self.assertFalse(os.path.exists(out + '.old'), 'the .old staging dir must be cleaned up after a successful swap')
        self.assertFalse(os.path.exists(out + '.tmp'), 'the .tmp staging dir must be cleaned up after a successful swap')

    def test_crash_mid_build_leaves_previous_good_exports_untouched(self):
        package_exports.main(['--root', self.root])  # first, good build
        out = os.path.join(self.root, '_exports')
        before = open(os.path.join(out, 'README.md'), encoding='utf-8').read()

        orig_copy2 = shutil.copy2
        call_count = [0]

        def exploding_copy2(*a, **kw):
            call_count[0] += 1
            if call_count[0] == 1:
                raise RuntimeError('simulated crash mid-build')
            return orig_copy2(*a, **kw)

        shutil.copy2 = exploding_copy2
        try:
            with self.assertRaises(RuntimeError):
                package_exports.main(['--root', self.root])
        finally:
            shutil.copy2 = orig_copy2

        after = open(os.path.join(out, 'README.md'), encoding='utf-8').read()
        self.assertEqual(before, after, 'a crash mid-build must leave the previous _exports/ byte-for-byte unchanged')
        self.assertFalse(os.path.exists(out + '.old'), 'a crash before the swap must never leave a half-swapped .old dir')


if __name__ == '__main__':
    unittest.main()
