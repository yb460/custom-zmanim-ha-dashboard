"""Sensor platform for the Shul Zmanim integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ShulZmanimCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: ShulZmanimCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([ShulZmanimSensor(coordinator, entry)])


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
            "last_updated": self.coordinator.data.get("last_updated"),
        }
