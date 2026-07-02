"""URL helpers for the Shul Zmanim integration."""
from __future__ import annotations

import re

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
