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
