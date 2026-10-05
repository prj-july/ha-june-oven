"""Summarize each cook as one cook history record.

This module has no Home Assistant imports: the client feeds it what it learns
from the oven, and history.py stores the finished records.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

from .const import DEFAULT_MODES

# Temperature samples kept per cook: one every SAMPLE_SECONDS, thinned to every
# other one (and the interval doubled) whenever MAX_SAMPLES is reached, so a
# long cook keeps its whole curve at a coarser step.
SAMPLE_SECONDS = 30
MAX_SAMPLES = 240


def _round(value: float | None) -> float | None:
    return round(value, 1) if value is not None else None


class CookRecorder:
    """Follow the current cook and summarize it when it ends."""

    def __init__(self) -> None:
        self._cook: dict[str, Any] | None = None
        self._seen_state = False

    @property
    def cooking(self) -> bool:
        """Return whether a cook is being followed."""
        return self._cook is not None

    def start(self, now: datetime) -> None:
        """Begin following a cook that just became active."""
        self._cook = {
            "started": now,
            # Already running the first time the oven was heard from, such as
            # after a restart: the start time is when it was first seen.
            "joined": not self._seen_state,
            "name": None,
            "plan_id": None,
            "session_id": None,
            "targets": [],
            "peak": None,
            "probe_peak": None,
            "probe_target": None,
            "probe_last": None,
            "timer": None,
            "ready": None,
            "samples": [],
            "step": SAMPLE_SECONDS,
        }
        self._seen_state = True

    def idle(self) -> None:
        """Note that the oven was seen idle."""
        self._seen_state = True

    def plan(self, name: str | None, plan_id: int | None, session: str | None) -> None:
        """Note the cook plan's food name, plan and session."""
        cook = self._cook
        if cook is None:
            return
        if name:
            cook["name"] = name
        if plan_id is not None:
            cook["plan_id"] = plan_id
        if session:
            cook["session_id"] = session

    def ready(self, now: datetime) -> None:
        """Note that preheating finished."""
        if self._cook is not None and self._cook["ready"] is None:
            self._cook["ready"] = now

    def observe(self, state: Any, now: datetime) -> None:
        """Take what matters from the client's current JuneState."""
        cook = self._cook
        if cook is None or not state.active:
            return
        if state.cook_mode and not cook["name"]:
            cook["name"] = state.cook_mode
        target = _round(state.target_temp_c)
        if target is not None and (
            not cook["targets"] or cook["targets"][-1] != target
        ):
            cook["targets"].append(target)
        current = state.current_temp_c
        if current is not None:
            cook["peak"] = (
                current if cook["peak"] is None else max(cook["peak"], current)
            )
        probe = state.probe_temp_c if state.probe_present is not False else None
        if probe is not None:
            cook["probe_last"] = probe
            cook["probe_peak"] = (
                probe if cook["probe_peak"] is None else max(cook["probe_peak"], probe)
            )
        if state.probe_target_c is not None:
            cook["probe_target"] = state.probe_target_c
        if state.cook_time_remaining_s is not None:
            total = state.cook_time_remaining_s + (state.cook_elapsed_s or 0)
            cook["timer"] = (
                total if cook["timer"] is None else max(cook["timer"], total)
            )
        self._sample(now, current, probe)

    def finish(
        self, state: Any, now: datetime, *, cancelled: bool
    ) -> dict[str, Any] | None:
        """Return the finished cook's record and stop following it."""
        cook = self._cook
        if cook is None:
            return None
        self.observe(state, now)
        self._sample(now, state.current_temp_c, cook["probe_last"], force=True)
        self._cook = None
        started: datetime = cook["started"]
        name = cook["name"]
        ready = cook["ready"]
        record: dict[str, Any] = {
            "id": f"{int(started.timestamp())}-{secrets.token_hex(3)}",
            "started": started.isoformat(),
            "ended": now.isoformat(),
            "duration_s": round((now - started).total_seconds()),
            "outcome": "cancelled" if cancelled else "done",
            # A primitive such as "bake", or the program or food the cook ran.
            "name": name,
            "program": bool(name) and name not in DEFAULT_MODES,
            "plan_id": cook["plan_id"],
            "session_id": cook["session_id"],
            "target_c": cook["targets"][-1] if cook["targets"] else None,
            "targets_c": cook["targets"],
            "peak_c": _round(cook["peak"]),
            "preheat_s": round((ready - started).total_seconds()) if ready else None,
            "timer_s": round(cook["timer"]) if cook["timer"] is not None else None,
            "probe": None,
            "joined": cook["joined"],
            # [seconds since the start, oven °C, food °C or None]
            "samples": cook["samples"],
            "picture": None,
        }
        if cook["probe_peak"] is not None or cook["probe_target"] is not None:
            record["probe"] = {
                "peak_c": _round(cook["probe_peak"]),
                "final_c": _round(cook["probe_last"]),
                "target_c": _round(cook["probe_target"]),
            }
        return record

    def _sample(
        self,
        now: datetime,
        current: float | None,
        probe: float | None,
        *,
        force: bool = False,
    ) -> None:
        cook = self._cook
        if cook is None or (current is None and probe is None):
            return
        samples: list[list[Any]] = cook["samples"]
        offset = max(0, round((now - cook["started"]).total_seconds()))
        if samples and not force and offset - samples[-1][0] < cook["step"]:
            return
        if samples and samples[-1][0] == offset:
            samples.pop()
        samples.append([offset, _round(current), _round(probe)])
        if len(samples) > MAX_SAMPLES:
            # Keep the first and the newest, and every other one between.
            cook["samples"] = samples[:-1:2] + [samples[-1]]
            cook["step"] *= 2


def utcnow() -> datetime:
    """Return the current time, for the client's cook records."""
    return datetime.now(UTC)
