# Guardian Node firmware / Rung 1 bench build

**Status: board-targeted source + host-tested state machine. Not flashed or validated on physical hardware.** Do not rely on this for emergency response, actual fall detection, human threat assessment, or SOS delivery.

This is intentionally **offline-only** firmware for the **Seeed Studio XIAO nRF52840 Sense**. It responds locally to a debounced manual SOS long-press and IMU-derived *impact candidates*. It does not transmit Bluetooth data, record audio, call emergency services, or contact PhiOS.

## Pinned build

Install Python 3 and PlatformIO Core **6.1.18**:

```sh
python -m pip install 'platformio==6.1.18'
pio run --project-dir wearable/firmware --environment guardian_node
```

The PlatformIO board is `seeed-xiao-afruitnrf52-nrf52840`, using Seeed `platform-seeedboards#1.1.0`, Arduino, and the Seeed LSM6DS3 library version `2.0.7`. The firmware CI workflow independently attempts an actual board-targeted build; do not mistake this for a flash or physical verification.

The deterministic state machine can be tested without any board:

```sh
g++ -std=c++17 -Wall -Wextra -Werror -pedantic wearable/firmware/tests/logic_test.cpp wearable/firmware/src/guardian_logic.cpp -o /tmp/phiguardian-node-tests
/tmp/phiguardian-node-tests
```

## Proposed bench wiring: verify before powering

| Function | Pin | External connection |
| --- | --- | --- |
| Manual SOS switch | D2 (Arduino 2) | Momentary switch to **GND**; firmware uses `INPUT_PULLUP` |
| Haptic gate control | D3 (Arduino 3) | **Only a logic-level MOSFET/transistor gate**, through a properly chosen resistor. Motor uses an appropriately rated separate driver circuit, protection and supply. |
| IMU | Built-in | Sense-model LSM6DS3TR-C, I2C address 0x6A |
| Fault LED | `LED_BUILTIN`, if defined | User LED assumed active-low; **verify revision/polarity** on the actual board |

**Never attach a motor directly to GPIO or connect battery positive to D2.** Confirm motor voltage/current, proper transistor/flyback protection, gate pull-down and common ground against the selected components. Start **USB bench-only** with a button and LED and *no motor or lithium cell*. Validate an isolated driver on a current-limited supply before attaching haptics. Battery integration needs cell protection, charging/thermal review and a safe enclosure.

Vendor references: [XIAO pin map](https://wiki.seeedstudio.com/XIAO-BLE-Sense-Pin-Multiplexing/), [PlatformIO](https://wiki.seeedstudio.com/xiao_nrf52840_with_platform_io/), [Sense IMU](https://wiki.seeedstudio.com/XIAO-BLE-Sense-IMU-Usage/).

## What the code does

- **SOS:** 35 ms debounce; a stable **1.8 s hold** creates one *local* candidate and a three-pulse haptic acknowledgment. Holding the button longer does not retrigger until it is released. A button held at boot is ignored until released. **No contact is notified.**
- **Impact candidate:** samples the IMU approximately every 40 ms; initial lab threshold 2.8 g, rearm below 1.5 g, and 4.5 s cooldown. These are *arbitrary uncalibrated settings*, not fall, collision or injury diagnoses. A separate haptic pattern acknowledges a candidate.
- **IMU unavailable:** manual SOS remains possible; impact detection is disabled. Optional active-low fault LED blinks, pending hardware polarity confirmation.
- **USB diagnostics:** compiled off by default (`PHIGUARDIAN_USB_DIAGNOSTICS=0`). For bench-only event-kind messages, set `1` in `platformio.ini` and monitor at 115200 baud. No user data or media are output.
- **No BLE yet:** no secure pairing/bonding, device authentication, message integrity, replay protection, phone companion, event ingest, or remote acknowledgment. The existing JavaScript translator is **not** a substitute for trusted transport.
- **No microphone and no camera:** there is no continuous sound analysis, person detection or classification.
- **No battery support yet:** charging, cell protection, watchdog, runtime, power measurement and wearable enclosure must be designed and verified.

## Validation gates

- [x] Host-native deterministic logic tests for debounce, one-shot SOS, haptic phases, impact hysteresis/cooldown, fault paths, button held across reset, and 32-bit timer rollover.
- [ ] Board cross-build in GitHub Actions, pending CI outcome.
- [ ] Flash a physical XIAO nRF52840 Sense and verify pin/LED behavior.
- [ ] Test safe transistor-driven vibration circuit, and current/thermal behavior.
- [ ] Calibrate IMU observations with safe, controlled activity trials; measure false positives.
- [ ] Measure battery runtime and add protected battery and explicit shutdown.
- [ ] Implement consented encrypted BLE pairing before companion event delivery.

Architecture: [wearable/README.md](../README.md), [hardware plan](../HARDWARE.md), and [companion](../companion/README.md).
