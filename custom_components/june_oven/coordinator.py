"""Data coordinator for June Oven."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)

from .api import JuneClient, JuneError, JuneState
from .const import DOMAIN, POLL_INTERVAL_SECONDS

if TYPE_CHECKING:
    from .history import CookHistory

_LOGGER = logging.getLogger(__name__)


class JuneDataUpdateCoordinator(DataUpdateCoordinator[JuneState]):
    """Coordinate REST snapshots with live WebSocket pushes."""

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, client: JuneClient
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=timedelta(seconds=POLL_INTERVAL_SECONDS),
        )
        self.client = client
        self.history: CookHistory | None = None
        self.client.set_update_callback(self.async_set_updated_data)

    async def _async_update_data(self) -> JuneState:
        try:
            return await self.client.async_fetch_status()
        except JuneError as err:
            raise UpdateFailed(str(err)) from err

    async def async_shutdown(self) -> None:
        """Stop the underlying client."""
        await self.client.async_stop()
