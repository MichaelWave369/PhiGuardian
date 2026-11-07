# Wearable companion interface

The companion is **not a deployed phone application or a running BLE service**. This folder contains only an isolated, tested packet-to-event translator. It is designed to preserve the stable PhiGuardian v1 event shape, not to replace host security.

## Translation
`translate.mjs` converts a strictly validated packet to a `sensor` event with `observedAt` set to the **host's receive time**, because wearable uptime is not a clock. The source is a pseudonymous device alias; confidence is null without a calibrated statistical model. Cautions are *review requests* about sensor observations.

To maintain the safety boundary, this module **does not call** `POST /api/events` and does not claim to perform device pairing, Bluetooth cryptography, or remote notification. The future bridge must verify bonded/encrypted BLE transport and explicit user consent *before* forwarding packets. The normalizer's allowlist and in-process sequence checks are defense in depth, **not authentication** or complete anti-replay protection.

## Example (pure local conversion only)
```js
import { WearableTranslator } from "./translate.mjs";

const bridge = new WearableTranslator({ allowedDeviceIds: new Set(["guardian-node-01"]) });
const observation = bridge.accept({
  protocol: "phiguardian.wearable/1",
  deviceId: "guardian-node-01",
  bootId: "9f6d4a832c17b0ea",
  sequence: 19,
  uptimeMs: 84622,
  kind: "sos_press",
});
// observation is a normalized event object; NOT transmitted.
```

A future authenticated host process can pass `observation` to the existing Guardian ingestion API *only after* cryptographic pairing/consent/revocation checks, and with a host-side secret kept off the wearable. A manual SOS must not create a false assertion that responders were contacted.

## Protocol decisions
- No raw audio, media, location, MAC address, nearby person data, or continuous motion stream in v1.
- The host supplies wall-clock receive time and maintains a bounded volatile history.
- A fresh random boot ID is required on every reboot. Device IDs are user-controlled aliases only.
- Duplicate/stale sequences within a seen boot are ignored, with a bounded in-memory table. **Replay across bridge restarts or after eviction remains possible until authenticated transport handles it**.
- BLE pairing/bonding, device revocation, message integrity, forward-security, key storage, rate limiting and privacy-preserving diagnostics are open implementation and review tasks.
