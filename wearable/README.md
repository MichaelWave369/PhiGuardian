# Φ Guardian Wearable

> **Status: versioned protocol, companion translator, guarded local relay, and board-targeted offline firmware.** Native C++ tests, PlatformIO cross-build, and local Guardian HTTP integration tests are included. No physical wearable, secure Bluetooth transport, real consent interface, sensor measurements or battery runtime have been validated. See [hardware plan](HARDWARE.md) and [companion bridge](companion/README.md).

**One Guardian, multiple interfaces.** PhiGuardian remains the environmental event service. A `wearable/` node supplies opt-in *observations*, not identity or threat judgments. Gen.E-Wrist and OptiEyes are future, permission-scoped presentation surfaces, not prerequisites for the node.

## Intended data flow

```text
[Wearable / battery + button + IMU + optional sensors]
       | local haptic feedback and simple event candidates
       | user-controlled sensor switches and visible status
       v
[Authenticated, bonded BLE connection]  <-- PLANNED, not implemented
       |
       v
[Companion on phone or PhiOS host]
       | verifies pairing, session, replay protections and user consent
       | maps wearable packet -> PhiGuardian event v1
       v
[PhiGuardian local event service] -> [PhiOS / Gen.E-Wrist / OptiEyes]
       | no cloud required          [optional, permission scoped]
       v
[Owner-visible advisories and manual SOS follow-up]
```

A disconnected wearable should still acknowledge a manual SOS button press *locally* with a haptic pattern. It must **not** imply that anyone received the signal when the companion is disconnected. Remote delivery and emergency call workflows are not implemented and should never be advertised as guaranteed.

## Now included
- [Versioned, minimised wearable event envelope](protocol/event-v1.schema.json): event kind, pseudonymous user-assigned device alias, random boot session ID, strictly increasing sequence and uptime. No audio, images, identifiers of nearby people, or raw accelerometer samples in the envelope.
- [Pure companion mapping](companion/translate.mjs): converts a verified/opted-in wearable event envelope to the **existing** `shared/event.schema.json` format. It preserves the core `source.kind = "sensor"` convention and explicitly avoids certainty about injury, danger or intent.
- [Fail-closed local relay](companion/relay.mjs): requires separately supplied transport verification and operator consent checks before a token-authenticated loopback-only Guardian API POST. Its tests exercise the actual local HTTP server; **no real BLE authentication or real operator approval implementation is included**. See [trust boundary](../docs/WEARABLE_COMPANION_TRUST.md).
- Node unit tests in `tests/wearable.test.mjs` for schema boundaries, event mapping, duplicate sequence rejection, unknown devices and session ordering.
- [Rung-by-rung hardware and safety plan](HARDWARE.md), including power, secure pairing and real-world verification requirements.
- [Guardian Node firmware bench prototype](firmware/README.md): SOS debounce/one-shot with local three-pulse haptic feedback, IMU impact *candidates* with cooldown, fault indication and native C++ tests. No BLE or cloud transport.

## Not included
- A **physically flashed or validated** wearable, complete electronics/packaging, BLE stack, pairing/bonding implementation or OTA update path.
- A deployable connected wearable or Bluetooth/USB adapter: the relay can send normalized events to Guardian *only* when a future trusted host adapter supplies legitimate device authentication and owner consent. Current tests use clearly identified stubs.
- Continuous microphone processing, fall diagnosis, human detection, environmental gas alarms or verified 24/7 battery runtime.
- A phone application. It is **future work** and must authenticate the BLE link before passing packets to the translator.

## Milestones
1. **Guardian Node / Rung 1:** board-targeted *offline* button/haptic and IMU source is in place with native tests and CI build. Next: flash a real XIAO nRF52840 Sense, electrically verify haptic driver and pinout, measure power, then design protected battery handling and explicit sensor disable. Disconnect behavior awaits secure BLE.
2. **Sensor Intelligence / Rung 2:** calibrate candidate impact signals and opt-in sound-level-only measures; collect false-positive rates in controlled tests; add calibrated environmental sensors where appropriate. A low-cost air-quality sensor is not a certified smoke, gas or CO detector.
3. **Companion / Rung 3:** authenticated pairing/bonding, rotating session IDs, transport integrity, replay resistance across restarts, rate limits, explicit user permission and revocation, link-loss warnings and host-only consent before POST ingestion.
4. **Field Reliability / Rung 4:** battery measurements, watchdog and brownout behavior, offline queue limits, ingress backpressure, sensor failure states, safe firmware updates, accessibility and genuine wearer trials.

## Boundary for human-related observations
Motion and microphone level by themselves cannot reliably establish that another person is present, hostile, or approaching. Human, vehicle, or proximity advisories would require an **independently evaluated** proximity/radar/camera sensor, and must always be about observations with user-reviewed context. No face recognition, protected-trait inference, autonomous confrontation, location tracking by default or covert audio recording.

For the full project, see the [root README](../README.md). Licensed under MIT.
