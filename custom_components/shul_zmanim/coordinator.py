"""Data update coordinator for the Shul Zmanim integration."""
from __future__ import annotations

import csv
import io
import logging
from datetime import timedelta
from typing import Any

import aiohttp
import homeassistant.util.dt as dt_util
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import ATTR_SIZE_WARNING_BYTES, DOMAIN, REQUIRED_COLUMNS

_LOGGER = logging.getLogger(__name__)


def parse_zmanim_csv(csv_text: str) -> dict[str, Any]:
    """Parse the sheet's CSV export into a day-grouped structure.

    Day and zman order both follow the order rows appear in the sheet -
    no separate numeric order columns needed. Individual malformed rows
    are skipped (and logged) rather than failing the whole parse, so a
    single typo doesn't blank the dashboard.
    """
    reader = csv.DictReader(io.StringIO(csv_text))

    if not reader.fieldnames:
        raise ValueError("empty_sheet")

    missing = [c for c in REQUIRED_COLUMNS if c not in reader.fieldnames]
    if missing:
        raise ValueError(f"missing_columns: {', '.join(missing)}")

    days: dict[str, dict[str, Any]] = {}
    week_title = ""
    row_count = 0

    for index, row in enumerate(reader):
        week_title_cell = (row.get("WeekTitle") or "").strip()
        if week_title_cell and not week_title:
            week_title = week_title_cell

        day_label = (row.get("Day") or "").strip()
        zman_name = (row.get("Zman") or "").strip()
        if not day_label or not zman_name:
            _LOGGER.warning("Skipping row %s: missing Day or Zman", index)
            continue

        day = days.setdefault(
            day_label,
            {
                "day_order": index,
                "day_label": day_label,
                "zmanim": [],
            },
        )

        day["zmanim"].append(
            {
                "name": zman_name,
                "time": (row.get("Time") or "").strip(),
                "notes": (row.get("Notes") or "").strip(),
            }
        )
        row_count += 1

    sorted_days = sorted(days.values(), key=lambda d: d["day_order"])

    return {
        "week_title": week_title,
        "days": sorted_days,
        "row_count": row_count,
        "last_updated": dt_util.utcnow().isoformat(),
    }


class ShulZmanimCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Fetches and parses the zmanim Google Sheet on a schedule."""

    def __init__(self, hass: HomeAssistant, csv_url: str, update_interval_minutes: int) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=update_interval_minutes),
        )
        self._csv_url = csv_url

    async def _async_update_data(self) -> dict[str, Any]:
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                self._csv_url, timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                response.raise_for_status()
                text = await response.text()
        except (aiohttp.ClientError, TimeoutError) as err:
            raise UpdateFailed(f"Error fetching zmanim sheet: {err}") from err

        if len(text.encode("utf-8")) > ATTR_SIZE_WARNING_BYTES:
            _LOGGER.warning(
                "Zmanim sheet response is larger than expected (%d bytes)",
                len(text.encode("utf-8")),
            )

        try:
            return parse_zmanim_csv(text)
        except ValueError as err:
            raise UpdateFailed(f"Error parsing zmanim sheet: {err}") from err
