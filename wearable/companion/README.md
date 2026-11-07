# Wearable companion interface

**Status:** pure packet translator **plus a fail-closed localhost event relay**, with deterministic unit and end-to-end API tests. **This is not a running phone app, BLE service, authenticating device driver, emergency alert system, or approved production integration.**

## Two separate responsibilities

1. [`translate.mjs`](translate.mjs) turns a strictly validated wearable packet into the existing Guardian `sensor` event v1 contract. The host supplies receive time because wearable uptime is not a wall clock. Confidence remains null until a calibrated model exists, and caution text is observational.
2. [`relay.mjs`](relay.mjs) accepts an event **only after** callbacks provided by the host's trusted transport adapter verify the device's actual authenticated session and independent owner consent. It then posts the normalized event to the existing `POST /api/events` endpoint using a **host-side token** and **loopback-only URL**. It checks server acknowledgment without implying a person received a warning.

**No real BLE authentication, pairing, encrypted link, OS/device identity, owner permission UI or phone companion has been implemented.** The test callbacks that return `true` do **not** authenticate anything. This relay must not be connected to an unverified sensor, raw BLE notification, website input, or publicly accessible listener. See the [trust boundary specification](../../docs/WEARABLE_COMPANION_TRUST.md).

## Safe integration requirements

The future adapter must bind the user-approved device alias to a cryptographically authenticated peer on the actual transport, validate link state for each packet, enforce consent/revocation, and provide a separately stored host-only Guardian ingestion token (minimum 16 characters, preferably cryptographically random and much longer). The packet itself must never choose whether it is trusted or consented.

`WearableRelay` takes required constructor options:
- `translator`: `new WearableTranslator({ allowedDeviceIds })`
- `verifyTransport(connectionContext, claimedDeviceId)`: async or sync, **independent transport-backed authentication**, not a caller-provided boolean
- `hasOperatorConsent(deviceId)`: async or sync independent owner approval check
- `ingestToken`: host-only local API token, not stored on the wearable
- `baseUrl`: default `http://127.0.0.1:8787`, strictly loopback-only
- `fetchImpl`, `timeoutMs`, `maxInflight`: optional transport/test controls

Call `await relay.receive(packet, authenticConnectionContext)` only from that approved adapter. The result has a narrow status vocabulary: `blocked`, `not_sent`, `unavailable`, `not_stored`, or `stored`. **`stored` means only that Guardian's volatile memory accepted the event**, never that an emergency contact or the wearer was notified. Events are never retried or queued in this milestone. A disconnected device can lose events.

`relay.revokeDevice(alias)` clears the translator's local allowlist and session state; the host **must also** revoke actual pairing/permissions and terminate the connection. A real adapter must additionally prevent alias spoofing and packet replays after reconnect or process restart.

## Validation

```bash
npm test
```

The HTTP integration test starts the real Guardian local API on an ephemeral loopback port, with test-only authorization callbacks. It verifies consent denial, trust failure, malformed packet rejection, duplicate protection, bearer token mismatch, unavailable API reporting, and successful **local storage acknowledgment**.

## Packet minimization

No raw audio, video, GPS, nearby person identity, BLE MAC address, or continuous accelerometer signals are accepted in the v1 packet. The translator maintains bounded in-memory deduplication and does not provide persistent cryptographic replay protection. For the underlying event schema, see [shared/event.schema.json](../../shared/event.schema.json).
