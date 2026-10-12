"""Interior camera for June Oven."""

from __future__ import annotations

from homeassistant.components.camera import Camera
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_platform
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .coordinator import JuneDataUpdateCoordinator
from .entity import JuneEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the June interior camera."""
    coordinator: JuneDataUpdateCoordinator = entry.runtime_data
    async_add_entities([JuneOvenCamera(coordinator)])
    entity_platform.async_get_current_platform().async_register_entity_service(
        "wake_camera",
        {},
        "async_wake_camera",
    )


class JuneOvenCamera(JuneEntity, Camera):
    """Expose the latest native June interior still."""

    _attr_translation_key = "interior"
    _attr_brand = "June"
    _attr_model = "June Oven"
    _attr_frame_interval = 1.0

    def __init__(self, coordinator: JuneDataUpdateCoordinator) -> None:
        super().__init__(coordinator, "camera")
        Camera.__init__(self)

    @property
    def is_on(self) -> bool:
        """Return whether Home Assistant may request a picture.

        Home Assistant refuses camera-proxy requests with HTTP 503 while
        is_on is False, before the integration image method runs. The
        interior camera can be woken on demand for a short viewing window,
        so the entity advertises itself as on; the oven still powers the
        camera only while it cooks or for that window.
        """
        return True

    async def async_camera_image(
        self, width: int | None = None, height: int | None = None
    ) -> bytes | None:
        """Return the latest oven image without waking the camera."""
        return await self.coordinator.client.async_fetch_camera_image()

    async def async_wake_camera(self) -> None:
        """Wake the interior camera for one viewing window."""
        await self.coordinator.client.async_wake_camera()
