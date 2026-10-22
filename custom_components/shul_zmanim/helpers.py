"""URL helpers for the Shul Zmanim integration."""
from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from datetime import date, datetime, tzinfo

_SHEET_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")
_GID_RE = re.compile(r"[#&?]gid=(\d+)")


def normalize_sheet_url(raw_url: str) -> str | None:
    """Normalize a Google Sheets share/edit/export URL to a CSV export URL.

    Accepts a plain share URL (.../edit#gid=123), an already-built export
    URL, or anything else containing a recognizable sheet ID. Returns None
    if no sheet ID can be found in the input.
    """
    raw_url = raw_url.strip()
    match = _SHEET_ID_RE.search(raw_url)
    if not match:
        return None

    sheet_id = match.group(1)
    gid_match = _GID_RE.search(raw_url)
    gid = gid_match.group(1) if gid_match else "0"

    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


# Formats a Google Sheets CSV export commonly renders a date/date-time cell in.
# Date-only formats are listed separately: a bare date means "gone by the start
# of that day".
_DATETIME_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y %I:%M:%S %p",
    "%m/%d/%Y %I:%M %p",
    "%m/%d/%y %H:%M",
    "%m/%d/%y %I:%M %p",
    "%b %d, %Y %I:%M %p",
    "%B %d, %Y %I:%M %p",
)
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%d %b %Y",
    "%d %B %Y",
)


def parse_remove_by(value: str, tz: tzinfo) -> datetime | None:
    """Parse a "Remove By" cell into an aware datetime in `tz`.

    A date-only value means the row is removed at the start (midnight) of that
    date. Returns None for a blank or unrecognised value, so the row is kept.
    """
    text = " ".join((value or "").split())
    if not text:
        return None
    for fmt in _DATETIME_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=tz)
        except ValueError:
            continue
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=tz)
        except ValueError:
            continue
    return None


def normalize_header(name: str) -> str:
    """Header key used to match optional columns loosely ("Remove By" == "remove_by")."""
    return re.sub(r"[\s_\-]", "", (name or "")).lower()


def find_prunable_keys(
    registered: Iterable[str],
    current: Iterable[str],
    last_seen: Mapping[str, str],
    today: date,
    max_age_days: int,
) -> tuple[set[str], set[str]]:
    """Decide which per-item sensors to remove.

    `registered` are the Keys that have an entity in the registry, `current`
    the Keys in the sheet right now, and `last_seen` maps a Key to the ISO date
    it was last in the sheet. Returns `(to_prune, to_seed)`:

    - to_prune: Keys absent from the sheet whose last-seen date is at least
      `max_age_days` old.
    - to_seed: absent Keys with no usable last-seen date (for example sensors
      that predate tracking). The caller records today for them, so they get a
      full grace period instead of being deleted on the first run.

    Keys in the sheet are never returned. `max_age_days <= 0` disables pruning.
    """
    if max_age_days <= 0:
        return set(), set()
    current = set(current)
    to_prune: set[str] = set()
    to_seed: set[str] = set()
    for key in set(registered) - current:
        try:
            seen = date.fromisoformat(last_seen[key])
        except (KeyError, TypeError, ValueError):
            to_seed.add(key)
            continue
        if (today - seen).days >= max_age_days:
            to_prune.add(key)
    return to_prune, to_seed
