"""Tests for the sensor-pruning decision logic.

helpers.py has no Home Assistant imports, so it is loaded by path to let these
run without installing Home Assistant:  python -m unittest discover tests
"""
import importlib.util
import unittest
from datetime import date
from pathlib import Path

_PATH = (
    Path(__file__).parent.parent / "custom_components" / "shul_zmanim" / "helpers.py"
)
_spec = importlib.util.spec_from_file_location("shul_helpers", _PATH)
helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(helpers)
find_prunable_keys = helpers.find_prunable_keys

TODAY = date(2026, 10, 22)
FOUR_WEEKS = 28


class FindPrunableKeysTest(unittest.TestCase):
    def test_prunes_keys_absent_for_full_period(self):
        prune, seed = find_prunable_keys(
            ["old"], [], {"old": "2026-09-24"}, TODAY, FOUR_WEEKS
        )
        self.assertEqual((prune, seed), ({"old"}, set()))

    def test_keeps_keys_absent_for_less_than_period(self):
        prune, seed = find_prunable_keys(
            ["recent"], [], {"recent": "2026-09-25"}, TODAY, FOUR_WEEKS
        )
        self.assertEqual((prune, seed), (set(), set()))

    def test_never_prunes_keys_in_the_sheet(self):
        prune, seed = find_prunable_keys(
            ["shacharis"], ["shacharis"], {"shacharis": "2020-01-01"}, TODAY, FOUR_WEEKS
        )
        self.assertEqual((prune, seed), (set(), set()))

    def test_untracked_keys_are_seeded_not_pruned(self):
        prune, seed = find_prunable_keys(["legacy"], [], {}, TODAY, FOUR_WEEKS)
        self.assertEqual((prune, seed), (set(), {"legacy"}))

    def test_unparsable_date_is_seeded(self):
        prune, seed = find_prunable_keys(
            ["a", "b"], [], {"a": "garbage", "b": None}, TODAY, FOUR_WEEKS
        )
        self.assertEqual((prune, seed), (set(), {"a", "b"}))

    def test_zero_disables_pruning(self):
        prune, seed = find_prunable_keys(
            ["old", "legacy"], [], {"old": "2000-01-01"}, TODAY, 0
        )
        self.assertEqual((prune, seed), (set(), set()))

    def test_mixed(self):
        prune, seed = find_prunable_keys(
            ["live", "old", "recent", "legacy"],
            ["live"],
            {"live": "2026-10-22", "old": "2026-08-01", "recent": "2026-10-15"},
            TODAY,
            FOUR_WEEKS,
        )
        self.assertEqual((prune, seed), ({"old"}, {"legacy"}))


if __name__ == "__main__":
    unittest.main()
