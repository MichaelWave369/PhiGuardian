# Φ Guardian Wearable

> **Status: protocol and architecture scaffold.** No wearable firmware, Bluetooth connectivity, physical sensor measurements, or battery runtime has been validated. See [hardware plan](HARDWARE.md) and [companion bridge](companion/README.md).

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
- Node unit tests in `tests/wearable.test.mjs` for schema boundaries, event mapping, duplicate sequence rejection, unknown devices and session ordering.
- [Rung-by-rung hardware and safety plan](HARDWARE.md), including power, secure pairing and real-world verification requirements.

## Not included
- Any compiled or flashed firmware; a BLE stack, pairing/bonding implementation, hardware-specific button/haptic code or OTA update path.
- Any connection from this translator to the running Guardian API; mapping tests are isolated.
- Continuous microphone processing, fall diagnosis, human detection, environmental gas alarms or verified 24/7 battery runtime.
- A phone application. It is **future work** and must authenticate the BLE link before passing packets to the translator.

## Milestones
1. **Guardian Node / Rung 1:** prototype one XIAO nRF52840 Sense with real button input, safe haptic driver, IMU, battery handling, physical sensor disable and documented flash procedure. Verify haptic feedback and disconnect behavior on the bench.
2. **Sensor Intelligence / Rung 2:** calibrate candidate impact signals and opt-in sound-level-only measures; collect false-positive rates in controlled tests; add calibrated environmental sensors where appropriate. A low-cost air-quality sensor is not a certified smoke, gas or CO detector.
3. **Companion / Rung 3:** authenticated pairing/bonding, rotating session IDs, transport integrity, replay resistance across restarts, rate limits, explicit user permission and revocation, link-loss warnings and host-only consent before POST ingestion.
4. **Field Reliability / Rung 4:** battery measurements, watchdog and brownout behavior, offline queue limits, ingress backpressure, sensor failure states, safe firmware updates, accessibility and genuine wearer trials.

## Boundary for human-related observations
Motion and microphone level by themselves cannot reliably establish that another person is present, hostile, or approaching. Human, vehicle, or proximity advisories would require an **independently evaluated** proximity/radar/camera sensor, and must always be about observations with user-reviewed context. No face recognition, protected-trait inference, autonomous confrontation, location tracking by default or covert audio recording.

For the full project, see the [root README](../README.md). Licensed under MIT.
