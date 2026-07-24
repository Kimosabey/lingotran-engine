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
from reconcile import _qa_ok


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


if __name__ == '__main__':
    unittest.main()
