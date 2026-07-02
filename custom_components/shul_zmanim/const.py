"""Constants for the Shul Zmanim integration."""
from __future__ import annotations

from homeassistant.const import Platform

DOMAIN = "shul_zmanim"

CONF_SHEET_URL = "sheet_url"
CONF_NAME = "name"
CONF_SCAN_INTERVAL = "scan_interval"

DEFAULT_NAME = "Shul Zmanim"
DEFAULT_SCAN_INTERVAL_MINUTES = 60
MIN_SCAN_INTERVAL_MINUTES = 5

REQUIRED_COLUMNS = ("Day", "Zman", "Time")

PLATFORMS = [Platform.SENSOR, Platform.BUTTON]

CARD_URL_BASE = f"/{DOMAIN}/frontend"
CARD_FILENAME = "shul-zmanim-card.js"

ATTR_SIZE_WARNING_BYTES = 8192
