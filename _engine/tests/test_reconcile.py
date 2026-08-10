#!/usr/bin/env python
"""P0-3: bool(v.get('ok')) treated the JSON STRING "false" as truthy (any
non-empty string is truthy in Python), so a QA verdict written as the wrong
JSON type would silently pass the completeness gate. Fixed to
`v.get('ok') is True` -- a strict identity check against the real boolean.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import reconcile
from reconcile import _qa_ok, _partition_accepted_gaps


class QaOkBooleanCoercionTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _write(self, obj):
        path = os.path.join(self.tmpdir, 'qa.json')
        json.dump(obj, open(path, 'w', encoding='utf-8'))
        return path

    def test_real_boolean_true_passes(self):
        path = self._write({'ok': True, 'missing_count': 0})
        self.assertTrue(_qa_ok(path))

    def test_real_boolean_false_fails(self):
        path = self._write({'ok': False, 'missing_count': 2})
        self.assertFalse(_qa_ok(path))

    def test_string_false_does_not_pass(self):
        """The exact bug: the JSON string "false" must NOT read as passing."""
        path = self._write({'ok': 'false', 'missing_count': 0})
        self.assertFalse(_qa_ok(path))

    def test_missing_ok_key_fails(self):
        path = self._write({'missing_count': 0})
        self.assertFalse(_qa_ok(path))

    def test_true_with_missing_count_still_fails(self):
        path = self._write({'ok': True, 'missing_count': 1})
        self.assertFalse(_qa_ok(path))


class AcceptedGapPartitionTests(unittest.TestCase):
    """IT2-P1-3: a qa:fail page individually reviewed and listed in
    collections.json's accepted_qa_gaps must still print every run (never
    silent) but must NOT block CLEAN / the exit code. Anything not in that
    list is a real, blocking, new gap."""

    def test_no_accepted_list_everything_is_new(self):
        new, accepted = _partition_accepted_gaps([3, 5, 27], [])
        self.assertEqual(new, [3, 5, 27])
        self.assertEqual(accepted, [])

    def test_all_qa_fail_pages_accepted(self):
        new, accepted = _partition_accepted_gaps([3, 5], [3, 5, 99])
        self.assertEqual(new, [])
        self.assertEqual(accepted, [3, 5])

    def test_mixed_new_and_accepted(self):
        """A newly-introduced qa:fail page must surface as NEW even when
        other pages on the same collection are already accepted -- this is
        the exact case the whole mechanism exists for: a genuinely new gap
        must never be buried under an already-disclosed one."""
        new, accepted = _partition_accepted_gaps([3, 5, 200], [3, 5])
        self.assertEqual(new, [200])
        self.assertEqual(accepted, [3, 5])

    def test_extra_accepted_pages_not_in_qa_fail_are_ignored(self):
        """accepted_qa_gaps may list a page that isn't currently qa:fail
        (e.g. re-transcribed and now passing) -- must not be fabricated
        into either output list."""
        new, accepted = _partition_accepted_gaps([3], [3, 999])
        self.assertEqual(new, [])
        self.assertEqual(accepted, [3])


if __name__ == '__main__':
    unittest.main()


class MetadataCompletenessTests(unittest.TestCase):
    """tricolore-2 reached a shipped deliverable with no book_type, answer_key,
    caveats or accepted_qa_gaps -- so its unified .md had no "Known
    limitations" section and its 11 gaps were disclosed nowhere a recipient
    would look. Delivery-time metadata is exactly what gets forgotten."""

    def _c(self, **kw):
        base = {'slug': 'b', 'book_type': 'student-coursebook',
                'answer_key': {'status': 'separate-guide'},
                'caveats': [], 'accepted_qa_gaps': []}
        base.update(kw)
        return base

    def test_fully_described_book_passes(self):
        self.assertEqual(reconcile.check_metadata(self._c()), [])

    def test_missing_book_type_is_reported(self):
        c = self._c()
        del c['book_type']
        self.assertIn('book_type', reconcile.check_metadata(c))

    def test_missing_answer_key_is_reported(self):
        c = self._c()
        del c['answer_key']
        self.assertTrue(any('answer_key' in m for m in reconcile.check_metadata(c)))

    def test_unknown_answer_key_status_is_reported(self):
        c = self._c(answer_key={'status': 'maybe'})
        self.assertTrue(any('expected printed' in m for m in reconcile.check_metadata(c)))

    def test_empty_lists_are_an_explicit_answer_not_a_gap(self):
        """[] means "reviewed, there are none" -- absent means "never asked"."""
        self.assertEqual(reconcile.check_metadata(self._c(caveats=[], accepted_qa_gaps=[])), [])
        c = self._c()
        del c['caveats']
        self.assertTrue(any('caveats' in m for m in reconcile.check_metadata(c)))
