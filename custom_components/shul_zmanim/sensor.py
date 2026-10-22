"""Sensor platform for the Shul Zmanim integration."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
import homeassistant.util.dt as dt_util

from .const import CONF_PRUNE_AFTER_WEEKS, DEFAULT_PRUNE_AFTER_WEEKS, DOMAIN
from .coordinator import ShulZmanimCoordinator
from .helpers import find_prunable_keys

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: ShulZmanimCoordinator = hass.data[DOMAIN][entry.entry_id]

    # The master sensor (all zmanim in one `days` attribute) - unchanged.
    async_add_entities([ShulZmanimSensor(coordinator, entry)])

    # Per-item sensors are created dynamically for every keyed row, and new
    # keys that appear in later weeks are picked up automatically.
    created: set[str] = set()

    @callback
    def _async_prune_item_sensors() -> None:
        """Remove sensors whose Key hasn't been in the sheet for N weeks."""
        weeks = entry.options.get(CONF_PRUNE_AFTER_WEEKS, DEFAULT_PRUNE_AFTER_WEEKS)
        if weeks <= 0 or not coordinator.data:
            return
        registry = er.async_get(hass)
        prefix = f"{entry.entry_id}_item_"
        registered = {
            reg.unique_id[len(prefix):]: reg.entity_id
            for reg in er.async_entries_for_config_entry(registry, entry.entry_id)
            if reg.domain == "sensor" and reg.unique_id.startswith(prefix)
        }
        to_prune, to_seed = find_prunable_keys(
            registered,
            coordinator.data.get("items", {}),
            coordinator.last_seen,
            dt_util.now().date(),
            weeks * 7,
        )
        if not (to_prune or to_seed):
            return
        today = dt_util.now().date().isoformat()
        for key in to_seed:
            # Sensors that predate tracking (or have no usable date) start
            # their grace period now rather than being deleted immediately.
            coordinator.last_seen[key] = today
        for key in to_prune:
            _LOGGER.info(
                "Removing sensor %s: Key '%s' not in the sheet since %s",
                registered[key],
                key,
                coordinator.last_seen.get(key),
            )
            registry.async_remove(registered[key])
            created.discard(key)
            coordinator.last_seen.pop(key, None)
        coordinator.async_save_last_seen()

    @callback
    def _async_add_item_sensors() -> None:
        items = (coordinator.data or {}).get("items", {})
        new = [k for k in items if k not in created]
        if new:
            created.update(new)
            async_add_entities(
                ShulZmanimItemSensor(coordinator, entry, key) for key in new
            )
        _async_prune_item_sensors()

    _async_add_item_sensors()
    entry.async_on_unload(coordinator.async_add_listener(_async_add_item_sensors))


class ShulZmanimSensor(CoordinatorEntity[ShulZmanimCoordinator], SensorEntity):
    """Sensor exposing this week's zmanim, grouped by day, as an attribute."""

    _attr_has_entity_name = True
    _attr_name = None
    _attr_icon = "mdi:calendar-clock"

    def __init__(self, coordinator: ShulZmanimCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_zmanim"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Shul Zmanim",
        )

    @property
    def available(self) -> bool:
        """Stay available with last-known-good data through transient fetch failures."""
        return self.coordinator.data is not None

    @property
    def native_value(self) -> str | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("week_title") or "Zmanim"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        if not self.coordinator.data:
            return {}
        return {
            "days": self.coordinator.data.get("days", []),
            "row_count": self.coordinator.data.get("row_count", 0),
            "removed_count": self.coordinator.data.get("removed_count", 0),
            "next_removal": (
                expiry.isoformat()
                if (expiry := self.coordinator.data.get("next_expiry"))
                else None
            ),
            "last_updated": self.coordinator.data.get("last_updated"),
        }


class ShulZmanimItemSensor(CoordinatorEntity[ShulZmanimCoordinator], SensorEntity):
    """One zman addressed by its stable `Key`, e.g. sensor.shul_zmanim_shacharis.

    State is the zman's name; the time, notes, day, and icon are attributes.
    The entity id comes from the Key (not the Hebrew name) so it stays stable
    across weekly edits, and the entity persists (as unavailable) on weeks the
    item isn't posted so cards referencing it don't break.
    """

    _attr_has_entity_name = False

    def __init__(
        self, coordinator: ShulZmanimCoordinator, entry: ConfigEntry, key: str
    ) -> None:
        super().__init__(coordinator)
        self._key = key
        self._attr_unique_id = f"{entry.entry_id}_item_{key}"
        # Anchor the entity id to the (Latin) Key, not the Hebrew name.
        self.entity_id = f"sensor.{DOMAIN}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Shul Zmanim",
        )

    @property
    def _item(self) -> dict[str, Any] | None:
        if not self.coordinator.data:
            return None
        return self.coordinator.data.get("items", {}).get(self._key)

    @property
    def available(self) -> bool:
        return self._item is not None

    @property
    def name(self) -> str:
        item = self._item
        # Fall back to the key so the entity still has a sensible name on weeks
        # the item isn't posted.
        return (item or {}).get("name") or self._key

    @property
    def native_value(self) -> str | None:
        item = self._item
        return item.get("name") if item else None

    @property
    def icon(self) -> str:
        item = self._item
        return (item or {}).get("icon") or "mdi:clock-outline"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        item = self._item
        if not item:
            return {"key": self._key}
        return {
            "key": self._key,
            "time": item.get("time", ""),
            "notes": item.get("notes", ""),
            "day": item.get("day_label", ""),
            "icon": item.get("icon", ""),
        }
