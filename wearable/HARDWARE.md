# Guardian Node: wearable hardware and validation plan

This is a **prototype design, not an approved BOM, validated wiring diagram, purchasing quote or certified personal safety device**. No physical build has been completed.

## Candidate V1 hardware

| Function | Candidate | Notes |
| --- | --- | --- |
| Controller, BLE, IMU, microphone | **Seeed Studio XIAO nRF52840 Sense** | Small MCU with built-in 6-axis IMU, digital microphone and BLE. Exact board revision and Arduino core must be confirmed before firmware. |
| SOS input | Momentary pushbutton | Proposed D2 -> GND, using a suitable internal pull-up. Long-press and debounce in firmware; verify final PCB/pin map. |
| Haptic output | Coin vibration motor **plus transistor/MOSFET driver and flyback protection as appropriate** | Proposed D3 logic control only. **Never connect a motor directly to a microcontroller GPIO.** Confirm rated voltage/current, driver, diode and board wiring with the selected motor. |
| Battery | Protected 3.7 V LiPo and appropriate enclosure | Verify cell protection, connector polarity, charging limits, temperature, cable strain relief and electrical safety before body-worn use. |
| Wearable housing | Printed / off-the-shelf ventilated enclosure | Nonconductive, rounded, sweat-resistant design; no exposed battery or wiring. Consider wearable skin contact and breakaway attachment. |
| Optional sensors | Bosch BME688 or Sensirion SGP41 module, later | These measure selected environmental signals and need calibration; **not substitutes for certified smoke/CO/gas alarms**. |
| Advanced proximity | Separate radar, distance or camera module, later | Higher power, privacy impact and difficult validation. Do not infer a person's intent or identity. |

Board details and pin map: [Seeed's official XIAO nRF52840 guide](https://wiki.seeedstudio.com/XIAO_BLE/) and [pin multiplexing](https://wiki.seeedstudio.com/XIAO-BLE-Sense-Pin-Multiplexing/). The **Sense** board is required for the built-in IMU and microphone. Hardware feature and board-revision differences must be checked against the exact purchased module.

## Prototype input and output behavior

- **Short press:** no emergency action; optionally a status query.
- **Long press:** manual SOS **candidate** with immediate on-device haptic acknowledgement. It is *not* a guarantee of notification delivery. No auto-dial or emergency dispatch.
- **Impact candidate:** simple IMU threshold detector with orientation and motion context, then conservative hysteresis/cooldown. Never call this a verified fall or injury.
- **Haptics:** distinct optional patterns for local button acknowledgement, link loss and contextual caution. User-adjustable intensity and quiet settings, except a clearly indicated hardware state.
- **Sound:** microphone **disabled by default**. Later opt-in sound-level/event features only; no raw audio storage or streaming as a baseline. A loud noise alone does not establish human conflict.
- **Disconnect:** indicate when companion delivery is unavailable and do not quietly queue endless personal event history.

## Battery and reliability test gates

1. Measure deep sleep, periodic sampling, BLE advertising/connected, active haptic and charging current with physical instruments.
2. Measure runtime across at least three operating modes with the selected cell; record temperature and recharge behavior. **Do not assume 24-hour battery life**.
3. Verify brownout recovery, button bounce, IMU unavailable, stuck buttons, BLE link loss/rejoin, duplicate and reordered packets.
4. Run controlled false-positive experiments on everyday movement, car travel, walking, pet interactions and manual SOS ergonomics. **No intentional injury, collisions, or dangerous testing.**
5. Test consent, secure pairing, revocation, and firmware rollback before any field deployment.

## Software and safety responsibilities

- Firmware owns *immediate* local feedback, user input, power modes, sensor availability, minimal event packet and visible sensor state.
- Companion owns BLE link security, user consent, time stamping, packet validation, replay protection, rate limiting, and eventual authenticated local Guardian event ingestion.
- Guardian Core owns event history/policy and integration with PhiOS. Existing core stores only volatile event metadata for up to one hour; that does not configure Frigate's own recording retention.
- User owns sensor permissions and shutdown. A wearable must never become a covert people-tracking device.

## Explicit non-goals
Human dangerousness classification, criminal intent prediction, covert recording, unattended emergency dispatch, biometric identification, a replacement for certified smoke/CO alarms, or a guarantee of 24/7 detection.

Cost, compatible add-ons, pin choices, battery and runtime are **estimates to validate**, not established facts. Firmware development starts only after selecting and verifying the actual board revision and hardware circuit.
