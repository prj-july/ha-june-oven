"""Protocol-level tests that do not require Home Assistant."""

from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path

PROTOCOL_PATH = (
    Path(__file__).parents[1] / "custom_components" / "june_oven" / "protocol.py"
)
SPEC = importlib.util.spec_from_file_location("june_protocol", PROTOCOL_PATH)
assert SPEC is not None and SPEC.loader is not None
protocol = importlib.util.module_from_spec(SPEC)
# Dataclasses resolve their defining module through sys.modules.
sys.modules[SPEC.name] = protocol
SPEC.loader.exec_module(protocol)


class ProtocolHelpersTest(unittest.TestCase):
    """Verify deterministic protocol helpers."""

    def test_temperature_conversion(self) -> None:
        self.assertEqual(protocol.fahrenheit_to_millic(350), 176667)
        self.assertAlmostEqual(protocol.millic_to_celsius(176667), 176.667)
        self.assertEqual(protocol.celsius_to_fahrenheit(100), 212)

    def test_pairing_code_has_valid_damm_check_digit(self) -> None:
        shown = protocol.build_shown_code("12345", 67)
        self.assertEqual(shown, "12345671")
        self.assertEqual(protocol.damm(shown), 0)

    def test_order_is_strictly_increasing(self) -> None:
        orders = protocol.OrderGenerator()
        self.assertEqual(orders.next(1000), 1000)
        self.assertEqual(orders.next(1000), 1001)
        self.assertEqual(orders.next(999), 1002)

    def test_srp_group_and_deterministic_public_value(self) -> None:
        self.assertEqual(protocol.SRP_N.bit_length(), 8192)
        server = protocol.SrpServer(
            "12345678",
            salt=bytes(range(16)),
            secret_b=123456789,
        )
        self.assertEqual(server.salt_base64, "AAECAwQFBgcICQoLDA0ODw==")
        self.assertEqual(
            hashlib.sha256(server.public_base64.encode()).hexdigest(),
            "5e52eddb66d2e5956848cff9c169f2ad7baf5d18ccf71aa990abef833f568f16",
        )

    def test_signed_frame_wire_shape(self) -> None:
        try:
            from nacl.signing import SigningKey
        except ImportError:
            self.skipTest("PyNaCl is not installed")

        key = SigningKey.generate()
        identity = {
            "oven_id": "oven",
            "device_id": "companion",
            "device_name": "Home Assistant",
            "ed25519_seed_hex": bytes(key).hex(),
        }
        encoded = protocol.build_signed_frame(
            identity,
            protocol.MC_CANCEL,
            {"plan_id": 0},
            order=42,
            now_ms=1000,
        )
        frame = json.loads(encoded)
        signature = base64.b64decode(frame["signature"])
        self.assertEqual(len(signature), 72)
        expected_fingerprint = hashlib.blake2b(
            key.verify_key.encode(), digest_size=8
        ).digest()
        self.assertEqual(signature[:8], expected_fingerprint)

        frame["signature"] = ""
        payload = json.dumps(frame, separators=(",", ":"), ensure_ascii=False).encode()
        key.verify_key.verify(payload, signature[8:])


class EndpointTest(unittest.TestCase):
    """Verify one configured endpoint derives every service URL."""

    def test_normalize_accepts_hosts_addresses_and_ports(self) -> None:
        cases = {
            "": "",
            "   ": "",
            "192.168.1.75": "https://192.168.1.75",
            " 192.168.1.75/ ": "https://192.168.1.75",
            "June-Oven.local": "https://june-oven.local",
            "june-oven.local.": "https://june-oven.local",
            "192.168.1.75:443": "https://192.168.1.75",
            "192.168.1.75:8443": "https://192.168.1.75:8443",
            "https://oven.lan": "https://oven.lan",
            "HTTPS://oven.lan:443/": "https://oven.lan",
            "http://192.168.1.75": "http://192.168.1.75:8080",
            "http://192.168.1.75:80": "http://192.168.1.75:80",
            "fe80::1": "https://[fe80::1]",
            "[fe80::1]:8443": "https://[fe80::1]:8443",
            "http://[FE80::0001]": "http://[fe80::1]:8080",
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(protocol.normalize_endpoint(value), expected)
                # Stored values are normalized again on load.
                self.assertEqual(protocol.normalize_endpoint(expected), expected)

    def test_normalize_rejects_invalid_values(self) -> None:
        for value in (
            "ftp://oven.local",
            "wss://oven.local",
            "oven.local/local/status",
            "user:secret@oven.local",
            "oven.local:99999",
            "oven.local:port",
            "-oven.local",
            "oven_local",
            "oven local",
            "https://",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                protocol.normalize_endpoint(value)

    def test_empty_endpoint_uses_public_cloud(self) -> None:
        endpoints = protocol.build_endpoints("")
        self.assertFalse(endpoints.local)
        self.assertEqual(endpoints.api_url, "https://api.junelife.com")
        self.assertEqual(endpoints.messaging_url, "https://messaging.junelife.com")
        self.assertEqual(
            endpoints.ws_url,
            "wss://messaging.junelife.com/1/messaging/websocket/companion",
        )

    def test_local_endpoint_derives_every_url(self) -> None:
        endpoints = protocol.build_endpoints("192.168.1.75")
        self.assertTrue(endpoints.local)
        self.assertEqual(endpoints.api_url, "https://192.168.1.75")
        self.assertEqual(endpoints.messaging_url, "https://192.168.1.75")
        self.assertEqual(
            endpoints.ws_url,
            "wss://192.168.1.75/1/messaging/websocket/companion",
        )
        self.assertEqual(endpoints.status_url, "https://192.168.1.75/local/status")

    def test_plain_http_endpoint_uses_plain_websocket(self) -> None:
        endpoints = protocol.build_endpoints("http://192.168.1.75")
        self.assertEqual(endpoints.api_url, "http://192.168.1.75:8080")
        self.assertEqual(
            endpoints.ws_url,
            "ws://192.168.1.75:8080/1/messaging/websocket/companion",
        )

    def test_local_media_url_is_rehomed_to_endpoint(self) -> None:
        endpoints = protocol.build_endpoints("192.168.1.75")
        self.assertEqual(
            endpoints.local_media_url(
                "https://api.junelife.com/media/prod/images/latest.jpg?ts=12"
            ),
            "https://192.168.1.75/media/prod/images/latest.jpg?ts=12",
        )
        self.assertEqual(
            endpoints.local_media_url(
                "http://10.0.0.9:8080/media/prod/images/latest.jpg"
            ),
            "https://192.168.1.75/media/prod/images/latest.jpg",
        )
        for candidate in (
            None,
            42,
            "https://api.junelife.com/2/devices/register",
            "https://api.junelife.com/media/../2/devices/pairing",
        ):
            with self.subTest(candidate=candidate):
                self.assertIsNone(endpoints.local_media_url(candidate))

    def test_cloud_endpoints_do_not_rehome_media(self) -> None:
        self.assertIsNone(
            protocol.build_endpoints("").local_media_url(
                "https://api.junelife.com/media/prod/images/latest.jpg"
            )
        )


if __name__ == "__main__":
    unittest.main()
