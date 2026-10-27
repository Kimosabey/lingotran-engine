#!/usr/bin/env python
"""qa-apply rewrote delivered books (found 2026-10-05, again 2026-10-26).

It walked every collection rather than the one being worked on, and its
non-greedy strip of the trailing `<!-- QA ISSUES -->` block stopped at the
first `-->` -- which, when an issue quoted an `<!-- illegible ... -->` note,
was inside the block -- so every re-run left the block's tail behind on the
page (Cosmopolite A1 p091). Fixed: qa-apply takes slugs or --all, strips the
block up to the last `-->`, and only writes a page whose text changes.
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import manifest_media

PAGE = '---\nstatus: verified\nqa: pass\n---\nBody text.\n'
ISSUES = ['paragraph unreadable <!-- illegible: best-guess "x" --> or noted as non-decipherable.',
          'second issue']


class QaApplyTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.root, '_tools'))
        json.dump({'collections': [{'slug': 'active'}, {'slug': 'delivered'}]},
                  open(os.path.join(self.root, '_tools', 'collections.json'), 'w'))
        for slug in ('active', 'delivered'):
            os.makedirs(os.path.join(self.root, slug, 'pages', '_qa'))
            self._page(slug, PAGE)
            self._verdict(slug, {'page': 1, 'ok': False, 'missing_count': 1, 'issues': ISSUES})

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def _path(self, slug):
        return os.path.join(self.root, slug, 'pages', 'page-001.md')

    def _page(self, slug, text):
        open(self._path(slug), 'w', encoding='utf-8').write(text)

    def _verdict(self, slug, v):
        json.dump(v, open(os.path.join(self.root, slug, 'pages', '_qa', 'page-001.json'), 'w'))

    def _run(self, slugs):
        with contextlib.redirect_stdout(io.StringIO()):
            manifest_media.qa_apply(self.root, slugs)

    def _read(self, slug):
        return open(self._path(slug), encoding='utf-8').read()

    def test_only_named_collection_is_touched(self):
        self._run(['active'])
        self.assertIn('qa: fail', self._read('active'))
        self.assertEqual(self._read('delivered'), PAGE)

    def test_no_slug_is_refused(self):
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
            manifest_media.qa_apply(self.root, [])
        self.assertEqual(self._read('active'), PAGE)

    def test_unknown_slug_is_refused(self):
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
            manifest_media.qa_apply(self.root, ['activ'])

    def test_rerun_is_idempotent_with_nested_comment(self):
        """The exact bug: issues quoting an `<!-- ... -->` note left a fragment."""
        self._run(['active'])
        once = self._read('active')
        self._run(['active'])
        self._run(['active'])
        self.assertEqual(self._read('active'), once)
        self.assertEqual(once.count('<!-- QA ISSUES:'), 1)

    def test_passing_verdict_removes_the_block(self):
        self._run(['active'])
        self._verdict('active', {'page': 1, 'ok': True, 'missing_count': 0, 'issues': []})
        self._run(['active'])
        self.assertNotIn('QA ISSUES', self._read('active'))
        self.assertIn('qa: pass', self._read('active'))

    def test_all_flag_covers_every_collection(self):
        self._run(['--all'])
        self.assertIn('qa: fail', self._read('delivered'))


if __name__ == '__main__':
    unittest.main()
