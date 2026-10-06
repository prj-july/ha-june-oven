"""Constants for the June Oven integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "june_oven"

CONF_ACCESS_TOKEN: Final = "access_token"
CONF_CA_CERT: Final = "ca_cert"
CONF_CLIENT_ID: Final = "client_id"
CONF_CLIENT_SECRET: Final = "client_secret"
CONF_DEFAULT_MODE: Final = "default_mode"
CONF_DEFAULT_TEMP_F: Final = "default_temp_f"
CONF_DEVICE_ID: Final = "device_id"
CONF_DEVICE_NAME: Final = "device_name"
CONF_ED25519_SEED_HEX: Final = "ed25519_seed_hex"
CONF_ENDPOINT: Final = "endpoint"
CONF_HISTORY: Final = "cook_history"
CONF_HISTORY_PICTURES: Final = "cook_history_pictures"
CONF_OVEN_ID: Final = "oven_id"
CONF_PASSWORD: Final = "password"
CONF_REFRESH_TOKEN: Final = "refresh_token"
CONF_VERIFY_SSL: Final = "verify_ssl"

DEFAULT_DEVICE_NAME: Final = "Home Assistant"
DEFAULT_MODE: Final = "bake"
DEFAULT_TEMP_F: Final = 350
# Cook primitives sent as 11002 ``primitive_type``; names match the June app.
DEFAULT_MODES: Final[tuple[str, ...]] = (
    "bake",
    "roast",
    "broil",
    "airfry",
    "toast",
    "reheat",
    "proof",
    "warm",
    "dehydrate",
    "grill",
    "pizzaiolo",
)
# Modes whose cavity temperature is fixed by the oven plan; the user picks
# only the mode (and, for toast, the level). Values are Fahrenheit.
FIXED_MODE_TEMPS_F: Final[dict[str, float]] = {
    "broil": 500,
    "toast": 500,
    "reheat": 350,
    "warm": 170,
    "pizzaiolo": 500,
}
# Grill heat levels: plan_index 0/1/2 -> high/medium/low, cavity temp in F.
GRILL_HEAT_F: Final[dict[int, float]] = {0: 450, 1: 400, 2: 275}
DEFAULT_GRILL_HEAT: Final = 0
# Modes with a user temperature on a per-mode range: (min, max, default) in F.
MODE_TEMP_RANGES_F: Final[dict[str, tuple[float, float, float]]] = {
    "proof": (80, 110, 85),
    "dehydrate": (100, 160, 135),
}
DEFAULT_TOAST_LEVEL: Final = 5
# Earlier releases stored air fry as "air-fry"; the June app sends "airfry".
LEGACY_MODES: Final[dict[str, str]] = {"air-fry": "airfry"}

MIN_TEMP_F: Final = 100
MAX_TEMP_F: Final = 500
POLL_INTERVAL_SECONDS: Final = 60

# The bundled Lovelace card, served by the integration (see www/).
CARD_URL: Final = "/june_oven/july-oven-card.js"
CARD_VERSION: Final = "0.5.12"

# Fired with each finished cook's history record (history.py).
EVENT_COOK_FINISHED: Final = "june_oven_cook_finished"

PLATFORMS: Final[tuple[str, ...]] = (
    "binary_sensor",
    "camera",
    "climate",
    "number",
    "sensor",
)

ATTRIBUTION: Final = "Data provided by June's unofficial cloud API via ha-june-oven"


def normalize_mode(mode: object) -> str:
    """Return a stored default cook mode as a current primitive."""
    value = LEGACY_MODES.get(str(mode), str(mode))
    return value if value in DEFAULT_MODES else DEFAULT_MODE
