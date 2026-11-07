# Guardian Node firmware

**No hardware firmware is shipped yet.** This folder reserves the firmware track inside the main PhiGuardian repository, as opposed to creating another disconnected project.

Target for the first bench build: **Seeed Studio XIAO nRF52840 Sense** (not the non-Sense variant). Verify the exact board/core, sensor drivers, power pins, motor driver, secure BLE stack and battery wiring from vendor documentation before flashing.

Planned layout:

```
wearable/firmware/
  README.md                  # present
  src/                       # future board-specific code
  tests/                     # future host-buildable state-machine tests
  wiring/                    # future revision-specific diagram
```

Acceptance for first firmware PR:
- [ ] Board toolchain reproducibly builds in CI for a *pinned* board/core version.
- [ ] Debounced long-press with locally distinct haptic confirmation and a status indication that remote delivery may be unavailable.
- [ ] Simple non-medical IMU motion event candidates with opt-in thresholds and false-alarm cooldown.
- [ ] Safe MOSFET-driven vibration circuit, verified GPIO map, battery protection and charging.
- [ ] BLE secure pairing/bonding and verified encryption before event transmission.
- [ ] Versioned `phiguardian.wearable/1` payload with no identifying human/audio/location data.
- [ ] Explicit microphone opt-in, visible sensing state, battery/profile instrumentation and link-failure handling.
- [ ] Documented flashing, rollback, manual power/sensor disable and bench validation.

Protocol and host adapter: [../protocol/event-v1.schema.json](../protocol/event-v1.schema.json) and [../companion/README.md](../companion/README.md).
