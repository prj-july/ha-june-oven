"""Number entities for June Oven."""

from __future__ import annotations

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .coordinator import JuneDataUpdateCoordinator
from .entity import JuneEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the June number entities."""
    coordinator: JuneDataUpdateCoordinator = entry.runtime_data
    async_add_entities([JuneToastLevel(coordinator)])


class JuneToastLevel(JuneEntity, NumberEntity):
    """Toast level 1-9; the wire plan_index is level - 1."""

    _attr_translation_key = "toast_level"
    _attr_native_min_value = 1
    _attr_native_max_value = 9
    _attr_native_step = 1
    _attr_mode = NumberMode.BOX
    _attr_icon = "mdi:toaster"

    def __init__(self, coordinator: JuneDataUpdateCoordinator) -> None:
        """Initialize the toast level control."""
        super().__init__(coordinator, "toast_level")

    @property
    def native_value(self) -> int:
        """Return the selected toast level."""
        return self.coordinator.toast_level

    async def async_set_native_value(self, value: float) -> None:
        """Select the toast level used by the next toast start."""
        self.coordinator.toast_level = int(value)
        self.async_write_ha_state()