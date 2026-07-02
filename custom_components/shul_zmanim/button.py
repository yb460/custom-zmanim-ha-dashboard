"""Button platform for the Shul Zmanim integration."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import ShulZmanimCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: ShulZmanimCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([ShulZmanimRefreshButton(coordinator, entry)])


class ShulZmanimRefreshButton(ButtonEntity):
    """Button to force an immediate refresh of the zmanim sheet."""

    _attr_has_entity_name = True
    _attr_name = "Refresh Now"
    _attr_icon = "mdi:refresh"

    def __init__(self, coordinator: ShulZmanimCoordinator, entry: ConfigEntry) -> None:
        self._coordinator = coordinator
        self._attr_unique_id = f"{entry.entry_id}_refresh"
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, entry.entry_id)})

    async def async_press(self) -> None:
        await self._coordinator.async_request_refresh()
