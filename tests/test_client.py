"""Replay relayed oven frames through the client without Home Assistant."""

from __future__ import annotations

import asyncio
import importlib
import importlib.util
import json
import ssl
import sys
import types
import unittest
from pathlib import Path
from typing import Any

from test_protocol import frame_at, june_local_status, load_frames, rest_status

INTEGRATION = Path(__file__).parents[1] / "custom_components" / "june_oven"
PACKAGE = "june_oven_under_test"


def _load_api() -> types.ModuleType:
    """Import api.py as part of the integration package, skipping __init__."""
    package = types.ModuleType(PACKAGE)
    package.__path__ = [str(INTEGRATION)]
    sys.modules[PACKAGE] = package
    stub = None
    if importlib.util.find_spec("aiohttp") is None:
        # The client only needs these names to import; nothing here uses them.
        stub = types.ModuleType("aiohttp")
        for name in ("ClientResponse", "ClientSession", "ClientWebSocketResponse"):
            setattr(stub, name, type(name, (), {}))
        stub.ClientError = type("ClientError", (Exception,), {})
        stub.ClientSSLError = type("ClientSSLError", (stub.ClientError,), {})
        stub.WSServerHandshakeError = type(
            "WSServerHandshakeError", (stub.ClientError,), {}
        )
        stub.WSMsgType = types.SimpleNamespace(TEXT=1, CLOSE=8, CLOSED=257, ERROR=258)
        sys.modules["aiohttp"] = stub
    try:
        return importlib.import_module(f"{PACKAGE}.api")
    finally:
        if stub is not None:
            del sys.modules["aiohttp"]


api = _load_api()

IDENTITY = api.JuneIdentity(
    oven_id="oven",
    device_id="companion",
    device_name="Home Assistant",
    password="",
    ed25519_seed_hex="00" * 32,
    access_token="",
    refresh_token="",
)


class CookRecorderTest(unittest.TestCase):
    """Summarize cooks without an oven."""

    def test_long_cooks_keep_their_whole_curve(self) -> None:
        from datetime import UTC, datetime, timedelta

        cooklog = sys.modules[f"{PACKAGE}.cooklog"]
        recorder = cooklog.CookRecorder()
        start = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)
        recorder.idle()
        recorder.start(start)
        state = api.JuneState(active=True, cook_mode="bake", target_temp_c=180.0)
        # Six hours at one reading every 10 s.
        for second in range(0, 6 * 3600, 10):
            state.current_temp_c = 20 + min(second, 900) / 6
            recorder.observe(state, start + timedelta(seconds=second))
        record = recorder.finish(state, start + timedelta(hours=6), cancelled=False)
        samples = record["samples"]
        self.assertLessEqual(len(samples), cooklog.MAX_SAMPLES)
        self.assertGreater(len(samples), cooklog.MAX_SAMPLES // 2)
        self.assertEqual(samples[0][0], 0)
        self.assertEqual(samples[-1][0], 6 * 3600)
        self.assertEqual(record["duration_s"], 6 * 3600)
        self.assertEqual(record["peak_c"], 170.0)
        self.assertFalse(record["joined"])
        self.assertIsNone(recorder.finish(state, start, cancelled=False))


def plan_data(plan_id: int, mode: str) -> dict[str, Any]:
    """A cook plan as 10014 carries it (and 10013 as cook_plan_data)."""
    step = {"id": 1, "cook_mode": mode, "temperature_cavity": 176667}
    return {
        "food": {"name": mode, "plan": {"id": plan_id, "steps": [step]}},
        "session_id": "session",
        "step_state": {"step_id": 1, "step_index": 0},
    }


def plan_frame(code: int, plan_id: int, mode: str) -> str:
    """A 10014 plan report, or 10013 telemetry carrying the plan."""
    data = plan_data(plan_id, mode)
    if code == 10013:
        data = {"sensor_data": {"cavity": 150000}, "cook_plan_data": data}
    return json.dumps({"message_code": code, "data": data})


class ClientReplayTest(unittest.IsolatedAsyncioTestCase):
    """Feed oven frames to JuneClient in receive order."""

    async def asyncSetUp(self) -> None:
        self.client = api.JuneClient(None, IDENTITY)
        self.sent: list[tuple[int, dict[str, Any]]] = []
        self.statuses: list[str | None] = []
        self.pulses: list[str] = []
        self.replayed: dict[str, int] = {}
        start_pulse = self.client._start_pulse

        def record_pulse(field: str) -> None:
            self.pulses.append(field)
            start_pulse(field)

        async def send_command(code: int, data: dict[str, Any]) -> str | None:
            self.sent.append((code, dict(data)))
            return self.statuses.pop(0) if self.statuses else "success"

        self.client._start_pulse = record_pulse
        self.client._async_send_command = send_command
        self.records: list[dict[str, Any]] = []
        self.client.cook_callback = self.records.append

    async def asyncTearDown(self) -> None:
        await self.client.async_stop()

    def replay(self, name: str, *, until: int | None = None) -> None:
        """Handle a fixture's next oven frames, through a capture line."""
        for frame in load_frames(name):
            if frame["line"] <= self.replayed.get(name, 0):
                continue
            if until is not None and frame["line"] > until:
                return
            self.replayed[name] = frame["line"]
            if frame["dir"] == "oven" and frame["message_code"] != api.MC_ACK:
                self.client._handle_message(json.dumps(frame))

    async def test_companion_bake_with_timer_and_temperature_change(self) -> None:
        state = self.client.state
        self.replay("bake-timer-temperature.jsonl", until=250)
        self.assertTrue(state.active)
        self.assertEqual(state.connection_state, "online")
        self.assertEqual(state.cook_mode, "bake")
        self.assertEqual(state.plan_id, 0)
        self.assertAlmostEqual(state.target_temp_c, 176.667)
        self.assertEqual(state.cook_phase, "preheating")

        self.replay("bake-timer-temperature.jsonl", until=284)
        self.assertAlmostEqual(state.progress_percent, 0.99031466)
        self.assertAlmostEqual(state.current_temp_c, 26.7)
        self.assertIsNone(state.cook_elapsed_s)
        self.assertFalse(state.ready)

        # The companion lowered the target to 325 F with 11005 at line 289.
        await self.client.async_set_target_f(325, "bake")
        self.assertEqual(
            self.sent,
            [
                (
                    api.MC_SET_TEMPERATURE,
                    frame_at("bake-timer-temperature.jsonl", 289)["data"],
                )
            ],
        )
        self.replay("bake-timer-temperature.jsonl", until=304)
        self.assertAlmostEqual(state.target_temp_c, 162.778)
        self.assertAlmostEqual(state.progress_percent, 0.0)

        self.replay("bake-timer-temperature.jsonl")
        self.assertFalse(state.active)
        self.assertEqual(state.cook_phase, "idle")
        self.assertIsNone(state.progress_percent)
        self.assertFalse(state.done)
        self.assertEqual(self.pulses, [])
        # Companion primitives stay selected for the next start.
        self.assertEqual(state.cook_mode, "bake")

    async def test_preheat_complete_pulses_ready_once(self) -> None:
        state = self.client.state
        self.replay("preheat-complete.jsonl", until=277)
        self.assertEqual(state.cook_phase, "preheating")
        self.replay("preheat-complete.jsonl", until=278)
        self.assertTrue(state.ready)
        self.assertAlmostEqual(state.target_temp_c, 37.778)
        self.replay("preheat-complete.jsonl", until=281)
        self.assertEqual(state.cook_phase, "preheated")
        self.assertEqual(state.progress_percent, 100.0)
        self.assertEqual(self.pulses, ["ready"])

    async def test_oven_screen_proof(self) -> None:
        state = self.client.state
        self.replay("oven-screen-proof.jsonl", until=251)
        # This 10018 is stamped with the oven's 2022 clock; it still applies.
        self.assertEqual(state.connection_state, "online")
        self.assertFalse(state.active)

        self.replay("oven-screen-proof.jsonl", until=345)
        self.assertTrue(state.active)
        self.assertEqual(state.cook_mode, "proof")
        self.assertEqual(state.plan_id, 114)
        self.assertAlmostEqual(state.target_temp_c, 26.667)
        self.assertEqual(state.cook_phase, "cooking")
        self.assertEqual(state.cook_elapsed_s, 1.0)

        # Proof is a startable primitive, but this is the oven screen's proof
        # program (plan 114): a refused 11005 leaves it running rather than
        # replacing it with a remote proof.
        self.statuses = ["not-allowed"]
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_set_target_f(100, "proof")
        self.assertEqual([code for code, _ in self.sent], [api.MC_SET_TEMPERATURE])

        self.replay("oven-screen-proof.jsonl")
        self.assertEqual(state.cook_elapsed_s, 8.003)

        await self.client.async_set_timer(10)
        await self.client.async_cancel()
        self.assertEqual(
            self.sent[1:],
            [
                (api.MC_SET_TIMER, {"plan_id": 114, "duration": 600000}),
                (api.MC_CANCEL, {"plan_id": 114}),
            ],
        )

        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "idle"}})
        )
        self.assertFalse(state.done)
        self.assertEqual(state.plan_id, 0)
        # Startable primitives stay selected, with their temperature, for
        # the next start.
        self.assertEqual(state.cook_mode, "proof")
        self.assertAlmostEqual(state.target_temp_c, 26.667)

    async def test_timer_waits_for_the_plan_it_belongs_to(self) -> None:
        """11006 must name the plan of the cook that is running.

        Regression for the 2026-10-11 reboot: the reheat timer went out 5 ms
        after the start acknowledgement with the previous plan id (0) while the
        running reheat plan was 2; cancelling that cook rebooted the oven.
        """
        self.client.plan_start_timeout = 0.5
        task = asyncio.create_task(self.client.async_set_timer(60))
        await asyncio.sleep(0.1)
        # Nothing goes out until the oven reports the plan of the new cook.
        self.assertEqual(self.sent, [])

        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "active"}})
        )
        self.assertEqual(self.sent, [])
        self.client._handle_message(
            json.dumps(
                {
                    "message_code": 10014,
                    "data": {
                        "food": {
                            "name": "reheat",
                            "plan": {
                                "id": 2,
                                "steps": [
                                    {
                                        "id": 1,
                                        "cook_mode": "reheat",
                                        "temperature_cavity": 176667,
                                    }
                                ],
                            },
                        },
                        "session_id": "session",
                        "step_state": {"step_id": 1, "step_index": 0},
                    },
                }
            )
        )
        await asyncio.wait_for(task, 2)
        self.assertEqual(
            self.sent, [(api.MC_SET_TIMER, {"plan_id": 2, "duration": 3600000})]
        )

    async def test_timer_after_a_restart_waits_for_the_new_plan(self) -> None:
        """A cook HA restarts stays active, but its old plan id is gone."""

        def plan(plan_id: int, mode: str) -> str:
            step = {"id": 1, "cook_mode": mode, "temperature_cavity": 176667}
            return json.dumps(
                {
                    "message_code": 10014,
                    "data": {
                        "food": {
                            "name": mode,
                            "plan": {"id": plan_id, "steps": [step]},
                        },
                        "session_id": "session",
                        "step_state": {"step_id": 1, "step_index": 0},
                    },
                }
            )

        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "active"}})
        )
        self.client._handle_message(plan(2, "bake"))
        await self.client.async_preheat("reheat", 350)
        self.sent.clear()

        self.client.plan_start_timeout = 0.5
        task = asyncio.create_task(self.client.async_set_timer(60))
        await asyncio.sleep(0.1)
        self.assertEqual(self.sent, [])
        self.client._handle_message(plan(3, "reheat"))
        await asyncio.wait_for(task, 2)
        self.assertEqual(
            self.sent, [(api.MC_SET_TIMER, {"plan_id": 3, "duration": 3600000})]
        )

    def running(self, plan_id: int, mode: str) -> None:
        """The oven reports an active cook of ``mode`` as plan ``plan_id``."""
        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "active"}})
        )
        self.client._handle_message(plan_frame(10014, plan_id, mode))

    async def test_replaced_cooks_reports_are_not_the_new_plan(self) -> None:
        """While a start waits, the old cook's telemetry and REST don't count.

        The cook a start replaces keeps sending 10013 (with its plan) about
        every second, and june-local's REST status serves the last plan it
        knew; either, taken for the new plan, sends the timer to the old one.
        """
        self.running(2, "bake")
        await self.client.async_preheat("reheat", 350)
        self.sent.clear()

        self.client.plan_start_timeout = 0.5
        task = asyncio.create_task(self.client.async_set_timer(60))
        await asyncio.sleep(0.1)
        self.client._handle_message(plan_frame(10013, 2, "bake"))
        self.client._apply_status(
            june_local_status("connected", {"state": "active"}, plan_data(2, "bake"))
        )
        await asyncio.sleep(0.1)
        self.assertEqual(self.sent, [])
        # The new cook's own telemetry, with a plan other than the replaced one.
        self.client._handle_message(plan_frame(10013, 3, "reheat"))
        await asyncio.wait_for(task, 2)
        self.assertEqual(
            self.sent, [(api.MC_SET_TIMER, {"plan_id": 3, "duration": 3600000})]
        )

    async def test_a_refused_start_keeps_the_running_plan(self) -> None:
        self.running(2, "bake")
        self.statuses = ["door-open"]
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_preheat("roast", 400)
        self.client.plan_start_timeout = 0.2
        await self.client.async_set_timer(30)
        self.assertEqual(
            self.sent[-1], (api.MC_SET_TIMER, {"plan_id": 2, "duration": 1800000})
        )

    async def test_stop_right_after_a_start_names_the_new_plan(self) -> None:
        self.running(2, "bake")
        await self.client.async_preheat("roast", 400)
        self.sent.clear()
        task = asyncio.create_task(self.client.async_cancel())
        await asyncio.sleep(0.1)
        self.assertEqual(self.sent, [])
        self.client._handle_message(plan_frame(10014, 5, "roast"))
        await asyncio.wait_for(task, 2)
        self.assertEqual(self.sent, [(api.MC_CANCEL, {"plan_id": 5})])

    async def test_mode_change_keeps_the_plan_index(self) -> None:
        """A running cook switched to grill restarts at the chosen heat."""
        self.running(2, "bake")
        await self.client.async_set_mode("grill", 400, 1)
        self.assertEqual(
            self.sent,
            [
                (api.MC_CANCEL, {"plan_id": 2}),
                (
                    api.MC_PREHEAT,
                    {
                        "primitive_type": "grill",
                        "temperature_cavity": 204444,
                        "plan_index": 1,
                    },
                ),
            ],
        )

    async def test_refused_change_never_restarts_a_plan_mode(self) -> None:
        """Toast's temperature is its plan's: a restart would reset its timing."""
        self.running(0, "toast")
        self.statuses = ["not-allowed"]
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_set_target_f(450, "toast")
        self.assertEqual([code for code, _ in self.sent], [api.MC_SET_TEMPERATURE])

    async def test_refused_change_never_restarts_an_oven_screen_program(self) -> None:
        """Proof from the oven's screen runs as plan 114, not a remote start."""
        self.replay("oven-screen-proof.jsonl", until=345)
        self.assertEqual(self.client.state.plan_id, 114)
        self.statuses = ["not-allowed"]
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_set_target_f(95, "proof")
        self.assertEqual([code for code, _ in self.sent], [api.MC_SET_TEMPERATURE])

    async def test_timer_without_a_running_cook_is_refused(self) -> None:
        self.client.plan_start_timeout = 0.2
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_set_timer(30)
        self.assertEqual(self.sent, [])

    async def test_add_cook_time_extends_the_time_left(self) -> None:
        state = self.client.state
        self.replay("oven-screen-proof.jsonl", until=345)
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_add_cook_time(5)
        self.assertEqual(self.sent, [])

        self.client._apply_telemetry(
            {
                "cook_state_data": {
                    "cook_time_elapsed": 60000,
                    "cook_time_remaining": 750000,
                },
                "eta": {"status": "acquired"},
            }
        )
        self.assertEqual(state.cook_time_remaining_s, 750.0)
        self.assertEqual(state.eta_status, "acquired")
        await self.client.async_add_cook_time(5)
        self.assertEqual(
            self.sent, [(api.MC_SET_TIMER, {"plan_id": 114, "duration": 1_050_000})]
        )

        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "idle"}})
        )
        self.assertIsNone(state.cook_time_remaining_s)
        self.assertIsNone(state.eta_status)
        # The cook ended on its own, so it counts as completed.
        self.assertIsNotNone(state.last_cook_completed)

    async def test_cancelled_cook_is_not_completed(self) -> None:
        self.replay("oven-screen-proof.jsonl", until=345)
        await self.client.async_cancel()
        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "idle"}})
        )
        self.assertIsNone(self.client.state.last_cook_completed)

    async def test_cook_history_records_a_cancelled_bake(self) -> None:
        self.replay("bake-timer-temperature.jsonl", until=250)
        self.assertEqual(self.records, [])
        self.replay("bake-timer-temperature.jsonl")
        [record] = self.records
        self.assertEqual(record["outcome"], "cancelled")
        self.assertEqual(record["name"], "bake")
        self.assertFalse(record["program"])
        self.assertEqual(record["plan_id"], 0)
        self.assertEqual(record["session_id"], "b8144d30-3e0c-478e-a731-b2da799a9170")
        # The target was lowered from 350 F to 325 F during the cook.
        self.assertEqual(record["targets_c"], [176.7, 162.8])
        self.assertEqual(record["target_c"], 162.8)
        self.assertEqual(record["peak_c"], 27.4)
        self.assertIsNone(record["probe"])
        self.assertIsNone(record["picture"])
        # The capture starts mid-cook, before the client saw the oven idle.
        self.assertTrue(record["joined"])
        self.assertTrue(record["samples"])
        json.dumps(record)

    async def test_cook_history_records_a_finished_program(self) -> None:
        self.replay("oven-screen-proof.jsonl")
        sensors = {"cavity": 27000, "probe": [{"id": "left", "value": 30500}]}
        self.client._handle_message(
            json.dumps({"message_code": 10013, "data": {"sensor_data": sensors}})
        )
        self.client._handle_message(
            json.dumps({"message_code": 10018, "data": {"state": "idle"}})
        )
        [record] = self.records
        self.assertEqual(record["outcome"], "done")
        self.assertEqual(record["name"], "proof")
        # Proof is a startable primitive again, not a program.
        self.assertFalse(record["program"])
        self.assertEqual(record["plan_id"], 114)
        self.assertFalse(record["joined"])
        self.assertEqual(
            record["probe"], {"peak_c": 30.5, "final_c": 30.5, "target_c": None}
        )
        self.assertEqual(record["samples"][-1][1:], [27.0, 30.5])

    async def test_cook_history_notes_preheat(self) -> None:
        self.replay("preheat-complete.jsonl")
        [record] = self.records
        self.assertEqual(record["preheat_s"], 0)

    async def test_cook_history_failure_does_not_break_updates(self) -> None:
        def broken(record: dict[str, Any]) -> None:
            raise RuntimeError("disk full")

        self.client.cook_callback = broken
        with self.assertLogs(api._LOGGER, "ERROR"):
            self.replay("bake-timer-temperature.jsonl")
        self.assertFalse(self.client.state.active)

    async def test_refused_temperature_change_restarts_a_primitive(self) -> None:
        self.replay("bake-timer-temperature.jsonl", until=250)
        self.statuses = ["not-allowed", "success", "success"]
        await self.client.async_set_target_f(325, "bake")
        self.assertEqual(
            [code for code, _ in self.sent],
            [api.MC_SET_TEMPERATURE, api.MC_CANCEL, api.MC_PREHEAT],
        )
        self.assertEqual(
            self.sent[2][1], {"primitive_type": "bake", "temperature_cavity": 162778}
        )

    async def test_preheat_sends_the_plan_index(self) -> None:
        self.replay("bake-timer-temperature.jsonl", until=250)
        self.statuses = ["success", "success"]
        await self.client.async_preheat("toast", 500, 6)
        await self.client.async_preheat("bake", 325)
        self.assertEqual(
            self.sent[0][1],
            {"primitive_type": "toast", "temperature_cavity": 260000, "plan_index": 6},
        )
        self.assertEqual(
            self.sent[1][1], {"primitive_type": "bake", "temperature_cavity": 162778}
        )

    async def test_unacknowledged_temperature_change_does_not_restart(self) -> None:
        self.replay("bake-timer-temperature.jsonl", until=250)
        self.statuses = [None]
        with self.assertRaises(api.JuneCommandError):
            await self.client.async_set_target_f(325, "bake")
        self.assertEqual(len(self.sent), 1)

    async def test_rest_status_from_june_local(self) -> None:
        state = self.client.state
        cook_plan = frame_at("oven-screen-proof.jsonl", 344)["data"]
        self.client._apply_status(
            june_local_status("connected", {"state": "active"}, cook_plan)
        )
        self.assertTrue(state.online)
        self.assertTrue(state.active)
        self.assertEqual(state.plan_id, 114)
        self.assertEqual(state.cook_mode, "proof")

        # june-local keeps the last plan after the cook ends.
        self.client._apply_status(
            june_local_status("disconnected", {"state": "idle"}, cook_plan)
        )
        self.assertEqual(state.connection_state, "offline")
        self.assertFalse(state.online)
        self.assertFalse(state.active)
        self.assertEqual(state.plan_id, 0)
        self.assertEqual(state.cook_mode, "proof")

    async def test_recorded_rest_statuses(self) -> None:
        state = self.client.state
        self.client._apply_status(rest_status("june_local_active"))
        self.assertEqual(state.connection_state, "online")
        self.assertTrue(state.active)
        self.assertEqual(state.plan_id, 114)
        self.assertEqual(state.cook_mode, "proof")

        self.client._apply_status(rest_status("june_local_idle"))
        self.assertEqual(state.connection_state, "online")
        self.assertFalse(state.active)
        self.assertEqual(state.cook_mode, "proof")

        self.client._apply_status(rest_status("cloud_active"))
        self.assertEqual(state.connection_state, "online")
        self.assertTrue(state.active)
        self.assertEqual(state.plan_id, 114)

        # Only the canonical value is stored, never "disconnected".
        self.client._apply_status(
            {"connection_state": "disconnected", "device_state": {"state": "idle"}}
        )
        self.assertEqual(state.connection_state, "offline")
        self.assertFalse(state.active)

    async def test_local_camera_frames_are_rehomed(self) -> None:
        self.client.endpoints = api.build_endpoints("192.168.1.75")
        # june-local still names api.junelife.com in every 10011.
        for path in ("/media/prod/images/1.jpg?ts=1", "/media/prod/images/2.jpg"):
            self.client._handle_message(
                json.dumps(
                    {
                        "message_code": api.MC_CAMERA,
                        "data": {"image_url": f"https://api.junelife.com{path}"},
                    }
                )
            )
            self.assertEqual(
                self.client.state.snapshot_url, f"https://192.168.1.75{path}"
            )


class _FakeResponse:
    """Minimal aiohttp response stand-in for the camera HTTP calls."""

    def __init__(self, status: int = 200, body: bytes = b"") -> None:
        self.status = status
        self._body = body
        self.headers: dict[str, str] = {}

    async def read(self) -> bytes:
        return self._body

    async def __aenter__(self) -> _FakeResponse:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class _FakeSession:
    """Records camera requests; serves one JPEG for every GET."""

    def __init__(self, image: bytes = b"\xff\xd8fake-jpeg") -> None:
        self.image = image
        self.posts: list[str] = []
        self.gets: list[str] = []
        self.post_status = 200

    def post(self, url: str, **kwargs: object) -> _FakeResponse:
        self.posts.append(url)
        return _FakeResponse(status=self.post_status)

    def get(self, url: str, **kwargs: object) -> _FakeResponse:
        self.gets.append(url)
        return _FakeResponse(body=self.image)


class IdleCameraTest(unittest.IsolatedAsyncioTestCase):
    """An idle live view wakes the camera and falls back to the still URL."""

    def make_client(self, endpoint: str) -> tuple[api.JuneClient, _FakeSession]:
        session = _FakeSession()
        client = api.JuneClient(
            session, IDENTITY, endpoints=api.build_endpoints(endpoint)
        )
        return client, session

    async def test_idle_fetch_does_not_wake_by_default(self) -> None:
        client, session = self.make_client("192.168.1.207")
        image = await client.async_fetch_camera_image()
        self.assertEqual(image, session.image)
        self.assertEqual(session.posts, [])
        self.assertEqual(
            session.gets, ["https://192.168.1.207/media/prod/images/latest.jpg"]
        )
        # An explicit view wakes, once inside the wake window.
        self.assertEqual(
            await client.async_fetch_camera_image(wake=True), session.image
        )
        self.assertEqual(
            session.posts, ["https://192.168.1.207/internal/camera/on?seconds=20"]
        )
        self.assertEqual(
            await client.async_fetch_camera_image(wake=True), session.image
        )
        self.assertEqual(len(session.posts), 1)

    async def test_pushed_frame_url_still_wins_when_present(self) -> None:
        client, session = self.make_client("192.168.1.207")
        client.state.snapshot_url = (
            "https://192.168.1.207/media/prod/images/latest.jpg?ts=99"
        )
        await client.async_fetch_camera_image()
        self.assertEqual(
            session.gets, ["https://192.168.1.207/media/prod/images/latest.jpg?ts=99"]
        )

    async def test_cooking_does_not_wake(self) -> None:
        client, session = self.make_client("192.168.1.207")
        client.state.active = True
        self.assertEqual(await client.async_fetch_camera_image(), session.image)
        self.assertEqual(session.posts, [])

    async def test_cloud_behavior_is_unchanged(self) -> None:
        client, session = self.make_client("")
        self.assertIsNone(await client.async_fetch_camera_image())
        self.assertEqual(session.posts, [])
        self.assertEqual(session.gets, [])
        client.state.snapshot_url = "https://api.junelife.com/media/prod/images/a.jpg"
        self.assertEqual(await client.async_fetch_camera_image(), session.image)
        self.assertEqual(
            session.gets, ["https://api.junelife.com/media/prod/images/a.jpg"]
        )


class SslOptionTest(unittest.TestCase):
    """Verify which CAs a server's TLS setting trusts."""

    INSTALLER_SERIAL = "A0A43F697EA12E577AABD4A6CF031221"

    def serials(self, context: ssl.SSLContext) -> set[str]:
        return {cert["serialNumber"] for cert in context.get_ca_certs()}

    def test_local_server_trusts_installer_ca_and_checks_hostname(self) -> None:
        context = api.create_ssl_option(True, "", local=True)
        self.assertIsInstance(context, ssl.SSLContext)
        self.assertIn(self.INSTALLER_SERIAL, self.serials(context))
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)

    def test_cloud_never_trusts_installer_ca(self) -> None:
        self.assertIs(api.create_ssl_option(True, ""), True)
        self.assertIs(api.create_ssl_option(True, "", local=False), True)

    def test_pasted_ca_is_the_only_ca(self) -> None:
        context = api.create_ssl_option(True, api.PROJECT_JULY_CA, local=True)
        self.assertEqual(self.serials(context), {self.INSTALLER_SERIAL})

    def test_verification_off(self) -> None:
        self.assertIs(api.create_ssl_option(False, "", local=True), False)

    def test_invalid_pasted_ca_is_rejected(self) -> None:
        with self.assertRaises((ssl.SSLError, ValueError)):
            api.create_ssl_option(True, "not a certificate", local=True)


if __name__ == "__main__":
    unittest.main()
