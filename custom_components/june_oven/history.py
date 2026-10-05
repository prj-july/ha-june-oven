"""Cook history: each finished cook, kept in Home Assistant's storage.

The client summarizes a cook when it ends (cooklog.py). This keeps the newest
MAX_RECORDS per oven, optionally with the oven's last camera picture saved in
the media folder, fires EVENT_COOK_FINISHED, and answers the card's websocket
commands. Pictures are served to the card at PICTURE_URL by signed path.
"""

from __future__ import annotations

import logging
import re
from http import HTTPStatus
from pathlib import Path
from typing import TYPE_CHECKING, Any

import voluptuous as vol
from aiohttp import web
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store

from .const import (
    CONF_DEVICE_NAME,
    CONF_HISTORY,
    CONF_HISTORY_PICTURES,
    CONF_OVEN_ID,
    DOMAIN,
    EVENT_COOK_FINISHED,
)

if TYPE_CHECKING:
    from .api import JuneClient

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
MAX_RECORDS = 200
PICTURE_URL = "/api/june_oven/cook_picture/{entry_id}/{record_id}"
_SAFE = re.compile(r"[^a-z0-9]+")


def _slug(value: str) -> str:
    return _SAFE.sub("_", value.lower()).strip("_") or "oven"


class CookHistory:
    """The cook history of one oven (one config entry)."""

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, client: JuneClient
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.client = client
        config = {**entry.data, **entry.options}
        self.enabled = bool(config.get(CONF_HISTORY, True))
        self.pictures = self.enabled and bool(config.get(CONF_HISTORY_PICTURES, True))
        self.records: list[dict[str, Any]] = []
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}.cook_history.{entry.entry_id}"
        )
        media = hass.config.media_dirs.get("local") or hass.config.path("media")
        name = str(config.get(CONF_DEVICE_NAME) or entry.title or "oven")
        self.folder = Path(media) / DOMAIN / f"{_slug(name)}_{entry.entry_id[-6:]}"

    async def async_load(self) -> None:
        """Load saved records and start recording, if turned on."""
        data = await self._store.async_load()
        if isinstance(data, dict) and isinstance(data.get("records"), list):
            self.records = [r for r in data["records"] if isinstance(r, dict)]
        if self.enabled:
            self.client.cook_callback = self._cook_finished

    @callback
    def _cook_finished(self, record: dict[str, Any]) -> None:
        self.entry.async_create_task(
            self.hass, self._async_add(record), "june_oven cook history"
        )

    async def _async_add(self, record: dict[str, Any]) -> None:
        if self.pictures:
            record["picture"] = await self._async_save_picture(record)
        self.records.insert(0, record)
        dropped = self.records[MAX_RECORDS:]
        del self.records[MAX_RECORDS:]
        await self._async_save(dropped)
        self.hass.bus.async_fire(EVENT_COOK_FINISHED, self._event_data(record))

    async def _async_save_picture(self, record: dict[str, Any]) -> str | None:
        try:
            # The cook's last still: no wake, which would light the oven.
            image = await self.client.async_fetch_camera_image(wake=False)
        except Exception as err:  # a missing picture is not an error
            _LOGGER.debug("No picture for the cook history: %s", err)
            return None
        if not image or not image.startswith(b"\xff\xd8"):
            return None
        stamp = record["started"][:19].replace(":", "").replace("T", "_")
        filename = f"{stamp}_{_slug(str(record.get('name') or 'cook'))}.jpg"
        path = self.folder / filename

        def write() -> None:
            self.folder.mkdir(parents=True, exist_ok=True)
            path.write_bytes(image)

        try:
            await self.hass.async_add_executor_job(write)
        except OSError as err:
            _LOGGER.warning("Could not save the cook picture %s: %s", path, err)
            return None
        return filename

    async def async_delete(self, record_id: str | None) -> None:
        """Delete one record, or every record when record_id is None."""
        if record_id is None:
            dropped, self.records = self.records, []
        else:
            dropped = [r for r in self.records if r.get("id") == record_id]
            self.records = [r for r in self.records if r.get("id") != record_id]
        await self._async_save(dropped)

    async def _async_save(self, dropped: list[dict[str, Any]]) -> None:
        await self._store.async_save({"records": self.records})
        files = [self.picture_path(r) for r in dropped]
        files = [f for f in files if f is not None]
        if files:
            await self.hass.async_add_executor_job(_remove, files)

    def picture_path(self, record: dict[str, Any]) -> Path | None:
        """Return the record's picture file, if it has one."""
        name = record.get("picture")
        if not isinstance(name, str) or not name or "/" in name or "\\" in name:
            return None
        return self.folder / name

    def _event_data(self, record: dict[str, Any]) -> dict[str, Any]:
        data = {k: v for k, v in record.items() if k != "samples"}
        data["config_entry_id"] = self.entry.entry_id
        device = dr.async_get(self.hass).async_get_device(
            identifiers={(DOMAIN, str(self.entry.data.get(CONF_OVEN_ID, "")))}
        )
        data["device_id"] = device.id if device else None
        path = self.picture_path(record)
        data["picture_path"] = str(path) if path else None
        return data


def _remove(files: list[Path]) -> None:
    for file in files:
        try:
            file.unlink(missing_ok=True)
        except OSError as err:
            _LOGGER.debug("Could not remove %s: %s", file, err)


@callback
def _history_for(hass: HomeAssistant, entity_id: str) -> CookHistory | None:
    entity = er.async_get(hass).async_get(entity_id)
    if entity is None or entity.platform != DOMAIN or not entity.config_entry_id:
        return None
    entry = hass.config_entries.async_get_entry(entity.config_entry_id)
    if entry is None or entry.state is not ConfigEntryState.LOADED:
        return None
    return getattr(entry.runtime_data, "history", None)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "june_oven/cook_history",
        vol.Required("entity_id"): str,
        vol.Optional("record_id"): str,
    }
)
@callback
def ws_cook_history(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return an oven's cook history, newest first, without temperature curves;
    with record_id, that one cook in full."""
    history = _history_for(hass, msg["entity_id"])
    if history is None:
        connection.send_error(msg["id"], "not_found", "No June oven with that entity")
        return
    if "record_id" in msg:
        record = next(
            (r for r in history.records if r.get("id") == msg["record_id"]), None
        )
        if record is None:
            connection.send_error(msg["id"], "not_found", "No cook with that id")
        else:
            connection.send_result(msg["id"], {"record": record})
        return
    connection.send_result(
        msg["id"],
        {
            "entry_id": history.entry.entry_id,
            "enabled": history.enabled,
            "pictures": history.pictures,
            "records": [
                {k: v for k, v in r.items() if k != "samples"} for r in history.records
            ],
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "june_oven/cook_history/delete",
        vol.Required("entity_id"): str,
        vol.Optional("record_id"): str,
    }
)
@websocket_api.async_response
async def ws_cook_history_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Delete one cook (record_id) or the whole history of an oven."""
    history = _history_for(hass, msg["entity_id"])
    if history is None:
        connection.send_error(msg["id"], "not_found", "No June oven with that entity")
        return
    await history.async_delete(msg.get("record_id"))
    connection.send_result(msg["id"], {"records": len(history.records)})


class CookPictureView(HomeAssistantView):
    """Serve a cook's picture to signed-in users (the card signs the path)."""

    url = PICTURE_URL
    name = "api:june_oven:cook_picture"
    requires_auth = True

    async def get(
        self, request: web.Request, entry_id: str, record_id: str
    ) -> web.StreamResponse:
        """Return the picture of one cook."""
        hass: HomeAssistant = request.app["hass"]
        entry = hass.config_entries.async_get_entry(entry_id)
        history = getattr(getattr(entry, "runtime_data", None), "history", None)
        record = next(
            (r for r in getattr(history, "records", []) if r.get("id") == record_id),
            None,
        )
        path = history.picture_path(record) if history and record else None
        if path is None or not await hass.async_add_executor_job(path.is_file):
            return web.Response(status=HTTPStatus.NOT_FOUND)
        return web.FileResponse(
            path, headers={"Cache-Control": "private, max-age=86400"}
        )


@callback
def async_setup_history(hass: HomeAssistant) -> None:
    """Register the cook history's websocket commands and picture view."""
    websocket_api.async_register_command(hass, ws_cook_history)
    websocket_api.async_register_command(hass, ws_cook_history_delete)
    if hass.http is not None:
        hass.http.register_view(CookPictureView())
