"""The Shul Zmanim integration."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CARD_FILENAME,
    CARD_URL_BASE,
    CONF_SCAN_INTERVAL,
    DEFAULT_SCAN_INTERVAL_MINUTES,
    DOMAIN,
    PLATFORMS,
)
from .coordinator import ShulZmanimCoordinator

_LOGGER = logging.getLogger(__name__)

_FRONTEND_REGISTERED_KEY = f"{DOMAIN}_frontend_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Shul Zmanim from a config entry."""
    scan_interval = entry.options.get(
        CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL_MINUTES
    )
    coordinator = ShulZmanimCoordinator(hass, entry.data["csv_url"], scan_interval)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    if not hass.data.get(_FRONTEND_REGISTERED_KEY):
        await _async_register_frontend(hass)
        hass.data[_FRONTEND_REGISTERED_KEY] = True

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled card JS and auto-load it as a frontend module.

    This is best-effort and deliberately non-fatal: the frontend/http APIs
    have changed across Home Assistant versions, so any failure here must not
    break integration setup. If it fails, the card still works once the user
    adds the Lovelace resource manually (see the README troubleshooting note).
    """
    www_dir = str(Path(__file__).parent / "www")

    try:
        # HA 2024.7+: register via StaticPathConfig list API.
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL_BASE, www_dir, cache_headers=False)]
        )
    except ImportError:
        # Older HA without StaticPathConfig: fall back to the legacy API.
        try:
            hass.http.register_static_path(CARD_URL_BASE, www_dir, cache_headers=False)
        except Exception:  # noqa: BLE001 - never let this break setup
            _LOGGER.warning(
                "Could not serve the Shul Zmanim card automatically; add the "
                "Lovelace resource manually (see README)."
            )
            return
    except Exception:  # noqa: BLE001 - never let this break setup
        _LOGGER.warning(
            "Could not serve the Shul Zmanim card automatically; add the "
            "Lovelace resource manually (see README)."
        )
        return

    try:
        from homeassistant.components.frontend import add_extra_js_url
        from homeassistant.loader import async_get_integration

        integration = await async_get_integration(hass, DOMAIN)
        version = integration.version or "0"
        add_extra_js_url(hass, f"{CARD_URL_BASE}/{CARD_FILENAME}?v={version}")
    except Exception:  # noqa: BLE001 - never let this break setup
        _LOGGER.warning(
            "Could not auto-load the Shul Zmanim card module; add the Lovelace "
            "resource manually (see README)."
        )


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unloaded
