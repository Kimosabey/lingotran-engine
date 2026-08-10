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


def _make_fixture(root, second_book=True):
    # lang_slug derives the language from the root PATH
    # (.../<lang>/extracted -> <lang>), so the root must be nested under a
    # 'testlang' dir for the combined-CSV name to line up.
    os.makedirs(os.path.join(root, '_tools'))
    os.makedirs(os.path.join(root, 'book-one'))
    cols = [{'slug': 'book-one', 'title': 'Book One', 'level': 'A1', 'level_mode': 'fixed'}]
    open(os.path.join(root, 'book-one', 'book-one.md'), 'w', encoding='utf-8').write('hello world')
    # per-book CSV (exercises the per-book-folder copy path)
    open(os.path.join(root, 'book-one', 'book-one-catalog.csv'), 'w', encoding='utf-8-sig').write('col1,col2\na,b\n')
    if second_book:
        # _combined/ only earns its place with 2+ books with data (see
        # package_exports.py's _collection_has_data gate) -- a single-book
        # fixture would make _combined/ a duplicate of book-one/, which is
        # exactly the "why do we need this" bug this fixture must catch.
        os.makedirs(os.path.join(root, 'book-two'))
        open(os.path.join(root, 'book-two', 'book-two.md'), 'w', encoding='utf-8').write('second book')
        cols.append({'slug': 'book-two', 'title': 'Book Two', 'level': 'A1', 'level_mode': 'fixed'})
    json.dump(
        {'language': 'Testlang', 'language_code': 'tl', 'collections': cols},
        open(os.path.join(root, '_tools', 'collections.json'), 'w', encoding='utf-8'))
    # combined roll-up (name must match lang_slug == 'testlang')
    open(os.path.join(root, 'testlang-catalog-all.csv'), 'w', encoding='utf-8-sig').write('col1,col2\na,b\n')


class StageThenSwapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, 'testlang', 'extracted')
        os.makedirs(self.root)
        _make_fixture(self.root)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_two_consecutive_runs_both_succeed(self):
        package_exports.main(['--root', self.root])
        out = os.path.join(self.root, '_exports')
        self.assertTrue(os.path.exists(os.path.join(out, 'README.md')))
        # clean layout: the book's .md + CSV live ONLY inside its own folder,
        # never duplicated at the top level; combined CSVs live ONLY in
        # _combined/, never loose at the top.
        self.assertTrue(os.path.exists(os.path.join(out, 'book-one', 'book-one.md')))
        self.assertTrue(os.path.exists(os.path.join(out, 'book-one', 'book-one-catalog.csv')))
        self.assertFalse(os.path.exists(os.path.join(out, 'book-one.md')),
                         'the book .md must NOT be duplicated at the top level')
        self.assertTrue(os.path.exists(os.path.join(out, '_combined', 'testlang-catalog-all.csv')))
        self.assertFalse(os.path.exists(os.path.join(out, 'testlang-catalog-all.csv')),
                         'combined CSVs must live only in _combined/, not loose at the top')
        # Nothing floating. The only loose files at the top are the two
        # orientation docs -- README.md (the column/row-count reference) and
        # START-HERE.md (the content team's entry point, generated for every
        # language). Everything else must be a directory.
        top = sorted(os.listdir(out))
        loose_files = [n for n in top if os.path.isfile(os.path.join(out, n))]
        self.assertEqual(loose_files, ['README.md', 'START-HERE.md'],
                         'only README.md and START-HERE.md may be loose at the top')
        # a second run must swap cleanly over the first, not error or duplicate
        package_exports.main(['--root', self.root])
        self.assertTrue(os.path.exists(os.path.join(out, 'README.md')))
        self.assertFalse(os.path.exists(out + '.old'), 'the .old staging dir must be cleaned up after a successful swap')
        self.assertFalse(os.path.exists(out + '.tmp'), 'the .tmp staging dir must be cleaned up after a successful swap')

    def test_crash_mid_rebuild_never_loses_the_previous_delivery(self):
        """In-place rebuild guarantee: new files are copied in first and stale
        files pruned only last, so a crash mid-run leaves the previous
        delivery intact (never empty, never half-deleted) and self-heals next
        run. Nothing is ever lost because _exports/ is 100% derived from
        source that this tool never touches."""
        package_exports.main(['--root', self.root])  # first, good build
        out = os.path.join(self.root, '_exports')
        before = open(os.path.join(out, 'README.md'), encoding='utf-8').read()

        orig_copy2 = shutil.copy2
        call_count = [0]

        def exploding_copy2(*a, **kw):
            call_count[0] += 1
            if call_count[0] == 1:
                raise RuntimeError('simulated crash mid-rebuild')
            return orig_copy2(*a, **kw)

        shutil.copy2 = exploding_copy2
        try:
            with self.assertRaises(RuntimeError):
                package_exports.main(['--root', self.root])
        finally:
            shutil.copy2 = orig_copy2

        # the crash fires on the first file copy, before the README rewrite
        # and before any stale prune — so the whole previous delivery survives
        after = open(os.path.join(out, 'README.md'), encoding='utf-8').read()
        self.assertEqual(before, after, 'a crash mid-rebuild must leave the previous README unchanged')
        self.assertTrue(os.path.exists(os.path.join(out, 'book-one', 'book-one.md')),
                        'the previous per-book folder must survive a crashed rebuild')
        self.assertTrue(os.path.exists(os.path.join(out, '_combined', 'testlang-catalog-all.csv')),
                        'the previous combined sheet must survive a crashed rebuild')
        self.assertTrue(os.listdir(out), '_exports/ must never be left empty')
        # no floating .part temp files from the aborted atomic copy
        parts = [p for _, _, fs in os.walk(out) for p in fs if p.endswith('.part')]
        self.assertEqual(parts, [], 'no half-written .part temp files may be left behind')

    def test_second_run_prunes_stale_files_no_floating_leftovers(self):
        """A file that existed in a prior run but is no longer produced must be
        pruned, and no stale/floating files or dirs may remain."""
        package_exports.main(['--root', self.root])
        out = os.path.join(self.root, '_exports')
        # plant a stale file + a stale loose file mimicking the OLD flat layout
        open(os.path.join(out, 'book-one', 'zzz-removed.csv'), 'w').write('x\n')
        open(os.path.join(out, 'stale-top-level.csv'), 'w').write('x\n')
        package_exports.main(['--root', self.root])
        self.assertFalse(os.path.exists(os.path.join(out, 'book-one', 'zzz-removed.csv')),
                         'a no-longer-produced file must be pruned')
        self.assertFalse(os.path.exists(os.path.join(out, 'stale-top-level.csv')),
                         'a stale loose top-level file must be pruned')
        # the only loose file left at the top is README.md
        loose = sorted(n for n in os.listdir(out) if os.path.isfile(os.path.join(out, n)))
        self.assertEqual(loose, ['README.md', 'START-HERE.md'])


class SingleBookNoCombinedTests(unittest.TestCase):
    """With only ONE book, _combined/ would be a byte-for-byte duplicate of
    that book's own folder -- a real "why do we need this?" case hit live on
    Cosmopolite A1. _combined/ must not appear until a 2nd book has data."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, 'testlang', 'extracted')
        os.makedirs(self.root)
        _make_fixture(self.root, second_book=False)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_combined_omitted_with_a_single_book(self):
        package_exports.main(['--root', self.root])
        out = os.path.join(self.root, '_exports')
        self.assertFalse(os.path.exists(os.path.join(out, '_combined')),
                         '_combined/ must not exist with only one book -- it would just duplicate book-one/')
        self.assertTrue(os.path.exists(os.path.join(out, 'book-one', 'book-one.md')))
        readme = open(os.path.join(out, 'README.md'), encoding='utf-8').read()
        # the README MAY explain when _combined/ would appear (helpful for a
        # cloner), but must not claim it exists now or list any sheets in it
        self.assertNotIn('## Combined sheets', readme,
                         'the README must not have a Combined sheets section when _combined/ does not exist')

    def test_combined_appears_once_second_book_added(self):
        package_exports.main(['--root', self.root])  # 1 book -> no _combined/
        out = os.path.join(self.root, '_exports')
        self.assertFalse(os.path.exists(os.path.join(out, '_combined')))
        # add the second book, same repo, re-run
        os.makedirs(os.path.join(self.root, 'book-two'))
        open(os.path.join(self.root, 'book-two', 'book-two.md'), 'w', encoding='utf-8').write('second book')
        cols_path = os.path.join(self.root, '_tools', 'collections.json')
        data = json.load(open(cols_path, encoding='utf-8'))
        data['collections'].append({'slug': 'book-two', 'title': 'Book Two', 'level': 'A1', 'level_mode': 'fixed'})
        json.dump(data, open(cols_path, 'w', encoding='utf-8'))

        package_exports.main(['--root', self.root])
        self.assertTrue(os.path.exists(os.path.join(out, '_combined', 'testlang-catalog-all.csv')),
                        '_combined/ must appear automatically once a 2nd book has data')


if __name__ == '__main__':
    unittest.main()
