"""Cook history in Home Assistant: storage, pictures, event and card commands."""

from __future__ import annotations

import inspect
import json
import shutil
import sys
import tempfile
import unittest
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from types import MappingProxyType, SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

from test_config_flow_compatibility import (
    HAS_HOME_ASSISTANT,
    INTEGRATION,
    _forget_custom_components,
)

ENTRY_DATA = {
    "oven_id": "oven1",
    "device_id": "companion",
    "device_name": "Kitchen",
    "password": "",
    "ed25519_seed_hex": "00" * 32,
    "access_token": "",
    "refresh_token": "",
    "endpoint": "",
    "verify_ssl": True,
    "default_mode": "bake",
    "default_temp_f": 350,
}
JPEG = b"\xff\xd8\xff\xe0 a picture"


def _frame(code: int, data: dict[str, Any]) -> str:
    return json.dumps({"message_code": code, "data": data})


class _Connection:
    """Collects what a websocket command sends."""

    def __init__(self) -> None:
        self.results: list[Any] = []
        self.errors: list[str] = []

    def send_result(self, msg_id: int, result: Any) -> None:
        self.results.append(result)

    def send_error(self, msg_id: int, code: str, message: str) -> None:
        self.errors.append(code)


@unittest.skipUnless(HAS_HOME_ASSISTANT, "Home Assistant is not installed")
class CookHistoryTest(unittest.IsolatedAsyncioTestCase):
    """Run a cook through a loaded config entry and read it back."""

    @asynccontextmanager
    async def _hass(self, options: dict[str, Any] | None = None) -> AsyncIterator[Any]:
        from homeassistant.config_entries import ConfigEntries, ConfigEntry
        from homeassistant.core import HomeAssistant
        from homeassistant.helpers import device_registry as dr
        from homeassistant.helpers import entity_registry as er
        from homeassistant.helpers import frame
        from homeassistant.loader import async_setup as async_setup_loader

        with tempfile.TemporaryDirectory() as config_dir:
            custom_components = Path(config_dir) / "custom_components"
            custom_components.mkdir()
            shutil.copytree(INTEGRATION, custom_components / "june_oven")

            _forget_custom_components()
            hass = HomeAssistant(config_dir)
            hass.config.media_dirs = {"local": str(Path(config_dir) / "media")}
            async_setup_loader(hass)
            frame.async_setup(hass)
            # Home Assistant loads these at startup; a bare instance does not.
            await dr.async_load(hass)
            await er.async_load(hass)
            hass.config_entries = ConfigEntries(hass, {})
            await hass.config_entries.async_initialize()
            await hass.async_start()
            try:
                import custom_components.june_oven.api as api

                fields = {
                    "data": ENTRY_DATA,
                    "discovery_keys": MappingProxyType({}),
                    "domain": "june_oven",
                    "minor_version": 1,
                    "options": options or {},
                    "source": "user",
                    "subentries_data": None,
                    "title": "Kitchen",
                    "unique_id": "oven1",
                    "version": 1,
                }
                accepted = inspect.signature(ConfigEntry.__init__).parameters
                entry = ConfigEntry(
                    **{k: v for k, v in fields.items() if k in accepted}
                )
                client = api.JuneClient
                with (
                    # The client's calls are replaced, so it needs no session.
                    patch(
                        "custom_components.june_oven.async_get_clientsession",
                        return_value=None,
                    ),
                    patch.object(client, "async_refresh_token", AsyncMock()),
                    patch.object(client, "async_start_websocket"),
                    patch.object(
                        client,
                        "async_fetch_status",
                        AsyncMock(side_effect=lambda **_: api.JuneState("online")),
                    ),
                    patch.object(
                        client, "async_fetch_camera_image", AsyncMock(return_value=JPEG)
                    ),
                ):
                    await hass.config_entries.async_add(entry)
                    await hass.async_block_till_done()
                    yield hass, entry, sys.modules["custom_components.june_oven"]
            finally:
                await hass.async_stop(force=True)
                _forget_custom_components()

    async def _cook(self, hass: Any, entry: Any, *, cancel: bool = False) -> None:
        client = entry.runtime_data.client
        client._handle_message(_frame(10018, {"state": "active"}))
        client._handle_message(
            _frame(10013, {"sensor_data": {"cavity": 180000, "probe": []}})
        )
        if cancel:
            client._handle_message(_frame(10017, {"type": "cancelled"}))
        client._handle_message(_frame(10018, {"state": "idle"}))
        await hass.async_block_till_done()

    def _climate(self, hass: Any) -> str:
        from homeassistant.helpers import entity_registry as er

        return next(
            e.entity_id
            for e in er.async_get(hass).entities.values()
            if e.platform == "june_oven" and e.domain == "climate"
        )

    async def test_a_cook_is_saved_with_its_picture_and_event(self) -> None:
        async with self._hass() as (hass, entry, june):
            events: list[Any] = []
            hass.bus.async_listen("june_oven_cook_finished", events.append)
            await self._cook(hass, entry)
            await self._cook(hass, entry, cancel=True)

            history = entry.runtime_data.history
            self.assertEqual(
                [r["outcome"] for r in history.records], ["cancelled", "done"]
            )
            record = history.records[1]
            self.assertEqual(record["peak_c"], 180.0)
            picture = history.picture_path(record)
            self.assertEqual(picture.read_bytes(), JPEG)
            self.assertTrue(str(picture).startswith(hass.config.media_dirs["local"]))
            self.assertEqual([e.data["outcome"] for e in events], ["done", "cancelled"])
            self.assertEqual(events[0].data["picture_path"], str(picture))
            self.assertIsNotNone(events[0].data["device_id"])
            self.assertNotIn("samples", events[0].data)

            # The card reads it by the oven's climate entity.
            climate = self._climate(hass)
            conn = _Connection()
            june.history.ws_cook_history(hass, conn, {"id": 1, "entity_id": climate})
            [result] = conn.results
            self.assertTrue(result["enabled"])
            self.assertTrue(result["pictures"])
            self.assertEqual(len(result["records"]), 2)
            self.assertNotIn("samples", result["records"][0])
            june.history.ws_cook_history(
                hass, conn, {"id": 4, "entity_id": climate, "record_id": record["id"]}
            )
            self.assertEqual(conn.results[-1]["record"]["samples"], record["samples"])
            self.assertTrue(record["samples"])
            june.history.ws_cook_history(
                hass, conn, {"id": 2, "entity_id": "climate.nothing"}
            )
            self.assertEqual(conn.errors, ["not_found"])

            # And fetches the picture from the view.
            view = june.history.CookPictureView()
            request = SimpleNamespace(app={"hass": hass})
            response = await view.get(request, entry.entry_id, record["id"])
            self.assertEqual(Path(response._path), picture)
            missing = await view.get(request, entry.entry_id, "nope")
            self.assertEqual(missing.status, 404)

            # Deleting a cook deletes its picture; the history survives a reload.
            june.history.ws_cook_history_delete(
                hass, conn, {"id": 3, "entity_id": climate, "record_id": record["id"]}
            )
            await hass.async_block_till_done(wait_background_tasks=True)
            self.assertEqual(conn.results[-1], {"records": 1})
            self.assertFalse(picture.exists())
            await hass.config_entries.async_reload(entry.entry_id)
            await hass.async_block_till_done()
            reloaded = entry.runtime_data.history
            self.assertIsNot(reloaded, history)
            self.assertEqual([r["outcome"] for r in reloaded.records], ["cancelled"])

    async def test_history_can_be_turned_off(self) -> None:
        async with self._hass({"cook_history": False}) as (hass, entry, _):
            await self._cook(hass, entry)
            history = entry.runtime_data.history
            self.assertEqual(history.records, [])
            self.assertFalse(history.pictures)

    async def test_pictures_can_be_turned_off(self) -> None:
        async with self._hass({"cook_history_pictures": False}) as (hass, entry, _):
            await self._cook(hass, entry)
            [record] = entry.runtime_data.history.records
            self.assertIsNone(record["picture"])

    async def test_options_offer_the_history_settings(self) -> None:
        async with self._hass() as (hass, entry, _):
            result = await hass.config_entries.options.async_init(entry.entry_id)
            keys = {str(k) for k in result["data_schema"].schema}
            self.assertLessEqual({"cook_history", "cook_history_pictures"}, keys)


if __name__ == "__main__":
    unittest.main()
