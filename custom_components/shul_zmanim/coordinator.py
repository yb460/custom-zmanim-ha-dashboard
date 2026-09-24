"""Data update coordinator for the Shul Zmanim integration."""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta
from typing import Any

import aiohttp
import homeassistant.util.dt as dt_util
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import slugify

from .const import ATTR_SIZE_WARNING_BYTES, DOMAIN, REMOVE_BY_HEADER, REQUIRED_COLUMNS
from .helpers import normalize_header, parse_remove_by

_LOGGER = logging.getLogger(__name__)


def _local_tz():
    """Home Assistant's configured time zone (API name differs across versions)."""
    getter = getattr(dt_util, "get_default_time_zone", None)
    return getter() if getter else dt_util.DEFAULT_TIME_ZONE


def parse_zmanim_csv(csv_text: str, now: datetime | None = None) -> dict[str, Any]:
    """Parse the sheet's CSV export into a day-grouped structure.

    Day and zman order both follow the order rows appear in the sheet -
    no separate numeric order columns needed. Individual malformed rows
    are skipped (and logged) rather than failing the whole parse, so a
    single typo doesn't blank the dashboard.

    Rows whose optional "Remove By" date/time has passed are dropped, and the
    earliest still-upcoming one is returned as `next_expiry` so the
    coordinator can refresh exactly when it passes.
    """
    reader = csv.DictReader(io.StringIO(csv_text))

    if not reader.fieldnames:
        raise ValueError("empty_sheet")

    missing = [c for c in REQUIRED_COLUMNS if c not in reader.fieldnames]
    if missing:
        raise ValueError(f"missing_columns: {', '.join(missing)}")

    tz = _local_tz()
    now = now or dt_util.now()
    remove_by_col = next(
        (f for f in reader.fieldnames if normalize_header(f) == REMOVE_BY_HEADER), None
    )
    next_expiry: datetime | None = None
    removed_count = 0

    days: dict[str, dict[str, Any]] = {}
    # Flat map of individually-addressable zmanim, keyed by the optional `Key`
    # column (slugified). Powers the per-item `sensor.shul_zmanim_<key>` sensors.
    items: dict[str, dict[str, Any]] = {}
    week_title = ""
    row_count = 0

    for index, row in enumerate(reader):
        day_label = (row.get("Day") or "").strip()
        zman_name = (row.get("Zman") or "").strip()
        if not day_label or not zman_name:
            _LOGGER.warning("Skipping row %s: missing Day or Zman", index)
            continue

        remove_by = None
        if remove_by_col:
            raw_remove_by = (row.get(remove_by_col) or "").strip()
            remove_by = parse_remove_by(raw_remove_by, tz)
            if raw_remove_by and remove_by is None:
                _LOGGER.warning(
                    "Row %s: could not read Remove By value '%s'; keeping the row",
                    index,
                    raw_remove_by,
                )
            if remove_by is not None and remove_by <= now:
                removed_count += 1
                continue
            if remove_by is not None and (next_expiry is None or remove_by < next_expiry):
                next_expiry = remove_by

        # Only rows still showing may supply the title, so an expired week's
        # title disappears together with its rows.
        week_title_cell = (row.get("WeekTitle") or "").strip()
        if week_title_cell and not week_title:
            week_title = week_title_cell

        # Optional stable key -> its own sensor. Slugified so it is a valid
        # entity-id suffix; a Hebrew/empty key slugifies away and is ignored.
        key = slugify((row.get("Key") or "").strip())

        zman = {
            "name": zman_name,
            "time": (row.get("Time") or "").strip(),
            "notes": (row.get("Notes") or "").strip(),
            # Optional per-row icon override (an mdi name like "mdi:candle").
            # Blank is fine - the card auto-picks an icon from the name.
            "icon": (row.get("Icon") or "").strip(),
            "key": key,
            "remove_by": remove_by.isoformat() if remove_by else "",
        }

        day = days.setdefault(
            day_label,
            {
                "day_order": index,
                "day_label": day_label,
                "zmanim": [],
            },
        )
        day["zmanim"].append(zman)
        row_count += 1

        if key:
            if key in items:
                _LOGGER.warning("Skipping duplicate Key '%s' on row %s", key, index)
            else:
                items[key] = {**zman, "day_label": day_label}

    sorted_days = sorted(days.values(), key=lambda d: d["day_order"])

    return {
        "week_title": week_title,
        "days": sorted_days,
        "items": items,
        "row_count": row_count,
        "removed_count": removed_count,
        "next_expiry": next_expiry,
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
        self._unsub_expiry: CALLBACK_TYPE | None = None

    def _schedule_expiry_refresh(self, when: datetime | None) -> None:
        """Re-parse the sheet the moment the next "Remove By" time passes."""
        if self._unsub_expiry:
            self._unsub_expiry()
            self._unsub_expiry = None
        if when is None:
            return

        async def _expired(_now: datetime) -> None:
            self._unsub_expiry = None
            await self.async_request_refresh()

        self._unsub_expiry = async_track_point_in_time(self.hass, _expired, when)

    async def async_shutdown(self) -> None:
        """Cancel the pending expiry refresh when the entry unloads."""
        self._schedule_expiry_refresh(None)
        await super().async_shutdown()

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
            data = parse_zmanim_csv(text)
        except ValueError as err:
            raise UpdateFailed(f"Error parsing zmanim sheet: {err}") from err

        self._schedule_expiry_refresh(data["next_expiry"])
        return data
