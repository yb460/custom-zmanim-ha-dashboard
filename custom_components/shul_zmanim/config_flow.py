"""Config flow for the Shul Zmanim integration."""
from __future__ import annotations

import hashlib
import logging
from typing import Any

import aiohttp
import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_NAME,
    CONF_SCAN_INTERVAL,
    CONF_SHEET_URL,
    DEFAULT_NAME,
    DEFAULT_SCAN_INTERVAL_MINUTES,
    DOMAIN,
    MIN_SCAN_INTERVAL_MINUTES,
)
from .coordinator import parse_zmanim_csv
from .helpers import normalize_sheet_url

_LOGGER = logging.getLogger(__name__)


async def _validate_csv_url(hass, csv_url: str) -> None:
    """Fetch and parse the sheet once to confirm it's reachable and well-formed."""
    session = async_get_clientsession(hass)
    async with session.get(csv_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
        response.raise_for_status()
        text = await response.text()
    parse_zmanim_csv(text)


class ShulZmanimConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Shul Zmanim."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> Any:
        errors: dict[str, str] = {}

        if user_input is not None:
            csv_url = normalize_sheet_url(user_input[CONF_SHEET_URL])

            if csv_url is None:
                errors["base"] = "invalid_url"
            else:
                try:
                    await _validate_csv_url(self.hass, csv_url)
                except aiohttp.ClientError:
                    errors["base"] = "cannot_connect"
                except ValueError:
                    errors["base"] = "missing_columns"

                if not errors:
                    unique_id = hashlib.sha256(csv_url.encode()).hexdigest()
                    await self.async_set_unique_id(unique_id)
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(
                        title=user_input.get(CONF_NAME) or DEFAULT_NAME,
                        data={"csv_url": csv_url},
                    )

        schema = vol.Schema(
            {
                vol.Required(CONF_SHEET_URL): str,
                vol.Optional(CONF_NAME, default=DEFAULT_NAME): str,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return ShulZmanimOptionsFlow(config_entry)


class ShulZmanimOptionsFlow(OptionsFlow):
    """Handle options (poll interval) for an existing entry."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> Any:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_SCAN_INTERVAL,
                    default=self.config_entry.options.get(
                        CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL_MINUTES
                    ),
                ): vol.All(int, vol.Range(min=MIN_SCAN_INTERVAL_MINUTES)),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
