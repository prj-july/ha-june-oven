"""Climate entity for June Oven."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components.climate import (
    ATTR_TEMPERATURE,
    ClimateEntity,
    ClimateEntityFeature,
    HVACAction,
    HVACMode,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_platform
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .api import JuneError
from .const import (
    CONF_DEFAULT_MODE,
    CONF_DEFAULT_TEMP_F,
    DEFAULT_MODES,
    DEFAULT_TEMP_F,
    FIXED_MODE_TEMPS_F,
    GRILL_HEAT_F,
    MAX_TEMP_F,
    MIN_TEMP_F,
    MODE_TEMP_RANGES_F,
    normalize_mode,
)
from .coordinator import JuneDataUpdateCoordinator
from .entity import JuneEntity
from .protocol import celsius_to_fahrenheit

SERVICE_ADD_COOK_TIME = "add_cook_time"
SERVICE_SET_TIMER = "set_timer"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the June climate entity."""
    coordinator: JuneDataUpdateCoordinator = entry.runtime_data
    async_add_entities([JuneOvenClimate(coordinator, entry)])
    entity_platform.async_get_current_platform().async_register_entity_service(
        SERVICE_ADD_COOK_TIME,
        {vol.Required("minutes"): vol.All(vol.Coerce(float), vol.Range(min=1, max=60))},
        "async_add_cook_time",
    )
    entity_platform.async_get_current_platform().async_register_entity_service(
        SERVICE_SET_TIMER,
        {vol.Required("minutes"): vol.All(vol.Coerce(float), vol.Range(min=1, max=720))},
        "async_set_timer",
    )


class JuneOvenClimate(JuneEntity, ClimateEntity):
    """Control a June oven as a heating-only climate entity."""

    _attr_name = None
    _attr_translation_key = "oven"
    _attr_hvac_modes = [HVACMode.OFF, HVACMode.HEAT]
    _attr_supported_features = (
        ClimateEntityFeature.TARGET_TEMPERATURE
        | ClimateEntityFeature.PRESET_MODE
        | ClimateEntityFeature.TURN_ON
        | ClimateEntityFeature.TURN_OFF
    )
    _attr_temperature_unit = UnitOfTemperature.FAHRENHEIT
    _attr_target_temperature_step = 5

    def __init__(
        self,
        coordinator: JuneDataUpdateCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator, "climate")
        values = {**entry.data, **entry.options}
        self._default_mode = normalize_mode(values.get(CONF_DEFAULT_MODE))
        self._default_temp_f = float(values.get(CONF_DEFAULT_TEMP_F, DEFAULT_TEMP_F))

    @property
    def min_temp(self) -> float:
        """Lowest valid target for the selected mode."""
        rng = MODE_TEMP_RANGES_F.get(self.preset_mode)
        return float(rng[0]) if rng else MIN_TEMP_F

    @property
    def max_temp(self) -> float:
        """Highest valid target for the selected mode."""
        rng = MODE_TEMP_RANGES_F.get(self.preset_mode)
        return float(rng[1]) if rng else MAX_TEMP_F

    @property
    def current_temperature(self) -> float | None:
        """Return the cavity temperature."""
        value = self.coordinator.data.current_temp_c
        return celsius_to_fahrenheit(value) if value is not None else None

    @property
    def target_temperature(self) -> float:
        """Return the target temperature."""
        value = self.coordinator.data.target_temp_c
        return (
            celsius_to_fahrenheit(value) if value is not None else self._default_temp_f
        )

    @property
    def hvac_mode(self) -> HVACMode:
        """Return the current mode."""
        return HVACMode.HEAT if self.coordinator.data.active else HVACMode.OFF

    @property
    def hvac_action(self) -> HVACAction:
        """Return the current action."""
        return HVACAction.HEATING if self.coordinator.data.active else HVACAction.OFF

    @property
    def preset_modes(self) -> list[str]:
        """Return startable modes plus any program running on the oven."""
        modes = list(DEFAULT_MODES)
        if self.preset_mode not in modes:
            modes.append(self.preset_mode)
        return modes

    @property
    def preset_mode(self) -> str:
        """Return the running program, such as "proof", or the selected mode."""
        return self.coordinator.data.cook_mode or self._default_mode

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        """Turn cooking on or off."""
        if hvac_mode == HVACMode.OFF:
            await self.async_turn_off()
            return
        if hvac_mode == HVACMode.HEAT:
            await self.async_turn_on()
            return
        raise HomeAssistantError(f"Unsupported HVAC mode: {hvac_mode}")

    async def async_turn_on(self) -> None:
        """Start the selected cook mode."""
        mode = self.preset_mode
        if mode not in DEFAULT_MODES:
            mode = self._default_mode
        plan_index = None
        if mode == "toast":
            plan_index = self.coordinator.toast_level - 1
        elif mode == "grill":
            plan_index = self.coordinator.grill_heat
        temperature = FIXED_MODE_TEMPS_F.get(mode, self.target_temperature)
        if mode == "grill":
            temperature = GRILL_HEAT_F.get(self.coordinator.grill_heat, 450)
        await self._run(
            self.coordinator.client.async_preheat(mode, temperature, plan_index)
        )

    async def async_turn_off(self) -> None:
        """Cancel cooking."""
        await self._run(self.coordinator.client.async_cancel())

    async def async_set_temperature(self, **kwargs: Any) -> None:
        """Set target temperature, restarting an active cook if needed."""
        temperature = kwargs.get(ATTR_TEMPERATURE)
        if temperature is None:
            return
        fixed = FIXED_MODE_TEMPS_F.get(self.preset_mode)
        rng = MODE_TEMP_RANGES_F.get(self.preset_mode)
        if fixed is not None:
            # Fixed-temperature modes ignore the cavity temperature; keep the
            # entity on the plan value instead of a user override.
            value = fixed
        else:
            value = float(temperature)
            lo = rng[0] if rng else MIN_TEMP_F
            hi = rng[1] if rng else MAX_TEMP_F
            if value < lo or value > hi:
                raise HomeAssistantError(
                    f"Temperature must be between {lo} and {hi} °F"
                )
        await self._run(
            self.coordinator.client.async_set_target_f(value, self.preset_mode)
        )

    async def async_set_preset_mode(self, preset_mode: str) -> None:
        """Select a June cook primitive."""
        if preset_mode == self.preset_mode:
            return
        if preset_mode not in DEFAULT_MODES:
            raise HomeAssistantError(f"Unsupported June cook mode: {preset_mode}")
        temperature = FIXED_MODE_TEMPS_F.get(preset_mode, self.target_temperature)
        rng = MODE_TEMP_RANGES_F.get(preset_mode)
        if rng and not (rng[0] <= temperature <= rng[1]):
            temperature = rng[2]
        await self._run(self.coordinator.client.async_set_mode(preset_mode, temperature))

    async def async_add_cook_time(self, minutes: float) -> None:
        """Extend the running timer (the card's +1 / +5 / +10)."""
        await self._run(self.coordinator.client.async_add_cook_time(minutes))

    async def async_set_timer(self, minutes: float) -> None:
        """Set the oven's native timer to a duration (timed cooks)."""
        await self._run(self.coordinator.client.async_set_timer(minutes))

    @staticmethod
    async def _run(operation: Any) -> None:
        try:
            await operation
        except JuneError as err:
            raise HomeAssistantError(str(err)) from err
