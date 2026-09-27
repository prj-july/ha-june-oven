"""Config flow for June Oven."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    BooleanSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
)

from .api import (
    JuneError,
    JunePairingNotReady,
    JunePairingSession,
    SSLSetting,
    connection_settings,
)
from .const import (
    CONF_CA_CERT,
    CONF_DEFAULT_MODE,
    CONF_DEFAULT_TEMP_F,
    CONF_DEVICE_NAME,
    CONF_HOST,
    CONF_VERIFY_SSL,
    DEFAULT_DEVICE_NAME,
    DEFAULT_HOST,
    DEFAULT_MODE,
    DEFAULT_MODES,
    DEFAULT_TEMP_F,
    DEFAULT_VERIFY_SSL,
    DOMAIN,
    MAX_TEMP_F,
    MIN_TEMP_F,
)
from .protocol import JuneEndpoints

MODE_SELECTOR = SelectSelector(
    SelectSelectorConfig(
        options=list(DEFAULT_MODES),
        mode=SelectSelectorMode.DROPDOWN,
    )
)
TEMP_SELECTOR = NumberSelector(
    NumberSelectorConfig(
        min=MIN_TEMP_F,
        max=MAX_TEMP_F,
        step=5,
        unit_of_measurement="°F",
        mode=NumberSelectorMode.BOX,
    )
)
NAME_SELECTOR = TextSelector(TextSelectorConfig())
HOST_SELECTOR = TextSelector(TextSelectorConfig())
CA_CERT_SELECTOR = TextSelector(TextSelectorConfig(multiline=True))
VERIFY_SSL_SELECTOR = BooleanSelector()


def _connection_fields(
    *,
    host: str = DEFAULT_HOST,
    verify_ssl: bool = DEFAULT_VERIFY_SSL,
    ca_cert: str = "",
) -> dict[vol.Marker, Any]:
    # Host and CA certificate are optional and may be cleared, so they use
    # suggested values instead of defaults that would refill a blank field.
    return {
        vol.Optional(CONF_HOST, description={"suggested_value": host}): HOST_SELECTOR,
        vol.Required(CONF_VERIFY_SSL, default=verify_ssl): VERIFY_SSL_SELECTOR,
        vol.Optional(
            CONF_CA_CERT, description={"suggested_value": ca_cert}
        ): CA_CERT_SELECTOR,
    }


def _connection_values(user_input: dict[str, Any]) -> dict[str, Any]:
    """Return every connection key, with cleared optional fields as blanks."""
    return {
        CONF_HOST: str(user_input.get(CONF_HOST) or "").strip(),
        CONF_VERIFY_SSL: bool(user_input.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL)),
        CONF_CA_CERT: str(user_input.get(CONF_CA_CERT) or "").strip(),
    }


async def _async_validate_connection(
    hass: HomeAssistant, values: dict[str, Any]
) -> tuple[JuneEndpoints, SSLSetting] | dict[str, str]:
    """Return endpoints and TLS trust, or form errors for invalid input."""
    try:
        return await hass.async_add_executor_job(connection_settings, values)
    except ValueError:
        try:
            JuneEndpoints.from_host(values[CONF_HOST])
        except ValueError:
            return {CONF_HOST: "invalid_host"}
        return {CONF_CA_CERT: "invalid_ca_cert"}


def _settings_schema(
    *,
    device_name: str = DEFAULT_DEVICE_NAME,
    default_mode: str = DEFAULT_MODE,
    default_temp_f: float = DEFAULT_TEMP_F,
) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_DEVICE_NAME, default=device_name): NAME_SELECTOR,
            **_connection_fields(),
            vol.Required(CONF_DEFAULT_MODE, default=default_mode): MODE_SELECTOR,
            vol.Required(CONF_DEFAULT_TEMP_F, default=default_temp_f): TEMP_SELECTOR,
        }
    )


def _options_schema(
    *,
    host: str = DEFAULT_HOST,
    verify_ssl: bool = DEFAULT_VERIFY_SSL,
    ca_cert: str = "",
    default_mode: str = DEFAULT_MODE,
    default_temp_f: float = DEFAULT_TEMP_F,
) -> vol.Schema:
    return vol.Schema(
        {
            **_connection_fields(host=host, verify_ssl=verify_ssl, ca_cert=ca_cert),
            vol.Required(CONF_DEFAULT_MODE, default=default_mode): MODE_SELECTOR,
            vol.Required(CONF_DEFAULT_TEMP_F, default=default_temp_f): TEMP_SELECTOR,
        }
    )


class JuneOvenConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a June Oven config flow."""

    VERSION = 1

    def __init__(self) -> None:
        self._pairing: JunePairingSession | None = None
        self._settings: dict[str, Any] = {}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Collect preferences and begin direct oven pairing."""
        errors: dict[str, str] = {}
        if user_input is not None:
            self._settings = {**user_input, **_connection_values(user_input)}
            connection = await _async_validate_connection(self.hass, self._settings)
            if isinstance(connection, dict):
                errors = connection
            else:
                endpoints, ssl_setting = connection
                self._pairing = JunePairingSession(
                    async_get_clientsession(self.hass),
                    str(user_input[CONF_DEVICE_NAME]),
                    self.hass.config.time_zone,
                    endpoints=endpoints,
                    ssl_setting=ssl_setting,
                )
                try:
                    await self._pairing.async_begin()
                except JuneError:
                    errors["base"] = "cannot_connect"
                else:
                    return await self.async_step_pair()

        schema = _settings_schema()
        if user_input:
            schema = self.add_suggested_values_to_schema(schema, user_input)
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_pair(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Wait for the oven to accept the displayed PIN."""
        if self._pairing is None or self._pairing.shown_code is None:
            return self.async_abort(reason="pairing_lost")

        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                identity = await self._pairing.async_wait_paired()
            except JunePairingNotReady:
                errors["base"] = "not_paired_yet"
            except JuneError:
                errors["base"] = "pairing_failed"
            else:
                await self.async_set_unique_id(identity.oven_id)
                self._abort_if_unique_id_configured()
                data = {**identity.as_dict(), **self._settings}
                return self.async_create_entry(
                    title=str(self._settings[CONF_DEVICE_NAME]),
                    data=data,
                )

        return self.async_show_form(
            step_id="pair",
            data_schema=vol.Schema({}),
            errors=errors,
            description_placeholders={
                "code": (
                    f"{self._pairing.shown_code[:4]} {self._pairing.shown_code[4:]}"
                )
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> OptionsFlow:
        """Return the options flow."""
        return JuneOvenOptionsFlow(config_entry)


class JuneOvenOptionsFlow(OptionsFlow):
    """Configure the oven host and default cook behavior."""

    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage June Oven options."""
        errors: dict[str, str] = {}
        options: dict[str, Any] = {}
        if user_input is not None:
            # Store every connection key so a cleared field overrides whatever
            # was entered during setup instead of falling back to it.
            options = {**user_input, **_connection_values(user_input)}
            connection = await _async_validate_connection(self.hass, options)
            if isinstance(connection, dict):
                errors = connection
            else:
                return self.async_create_entry(title="", data=options)

        values = {**self._entry.data, **self._entry.options, **options}
        return self.async_show_form(
            step_id="init",
            data_schema=_options_schema(
                host=str(values.get(CONF_HOST) or DEFAULT_HOST),
                verify_ssl=bool(values.get(CONF_VERIFY_SSL, DEFAULT_VERIFY_SSL)),
                ca_cert=str(values.get(CONF_CA_CERT) or ""),
                default_mode=str(values.get(CONF_DEFAULT_MODE, DEFAULT_MODE)),
                default_temp_f=float(values.get(CONF_DEFAULT_TEMP_F, DEFAULT_TEMP_F)),
            ),
            errors=errors,
        )
