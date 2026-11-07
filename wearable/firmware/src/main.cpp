#include <Arduino.h>
#include <LSM6DS3.h>
#include <cmath>

#include "guardian_logic.hpp"

// Proposed bench-only wiring, to be verified against the physical board:
// D2 -> momentary SOS switch to GND, INPUT_PULLUP.
// D3 -> MOSFET gate through resistor. Motor powered via suitable external
// supply and flyback-protected transistor driver. NEVER drive motor from GPIO.
constexpr uint8_t kSosPin = 2;
constexpr uint8_t kHapticDriverPin = 3;
constexpr uint32_t kImuSampleIntervalMs = 40;

// USB diagnostics contain event kinds only. Never claim remote delivery.
// They are OFF by default, including for a production-style bench flash.
#ifndef PHIGUARDIAN_USB_DIAGNOSTICS
#define PHIGUARDIAN_USB_DIAGNOSTICS 0
#endif

LSM6DS3 imu(I2C_MODE, 0x6A);
guardian::NodeLogic logic;
bool imuReady = false;
float lastAccelerationG = 1.0f;
uint32_t previousImuSample = 0;

void setup() {
  pinMode(kSosPin, INPUT_PULLUP);
  digitalWrite(kHapticDriverPin, LOW);
  pinMode(kHapticDriverPin, OUTPUT);
  // Built-in status LED polarity/visibility must be bench verified.
#ifdef LED_BUILTIN
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
#endif

  // No BLE advertising, transmission, phone pairing, network, or microphone.
  // This deliberately remains a USB/physical bench test, not a wearable alarm.
#if PHIGUARDIAN_USB_DIAGNOSTICS
  Serial.begin(115200);
#endif
  imuReady = imu.begin() == 0;
}

void loop() {
  const uint32_t now = millis();
  if (imuReady && now - previousImuSample >= kImuSampleIntervalMs) {
    previousImuSample = now;
    const float x = imu.readFloatAccelX();
    const float y = imu.readFloatAccelY();
    const float z = imu.readFloatAccelZ();
    const float g = sqrtf(x * x + y * y + z * z);
    if (std::isfinite(g)) lastAccelerationG = g;
    else imuReady = false;
  }

  const guardian::Output result = logic.tick(
      now, digitalRead(kSosPin) == LOW, imuReady, lastAccelerationG);
  digitalWrite(kHapticDriverPin, result.haptic ? HIGH : LOW);

#ifdef LED_BUILTIN
  // Many nRF52840 Sense variants use active-low user LEDs.
  digitalWrite(LED_BUILTIN, result.faultLed ? LOW : HIGH);
#endif

#if PHIGUARDIAN_USB_DIAGNOSTICS
  if (result.sosPress) Serial.println("phiguardian.bench:sos_press:LOCAL_ONLY");
  if (result.impactCandidate) Serial.println("phiguardian.bench:impact_candidate:NOT_A_FALL_DIAGNOSIS");
  if (result.sensorFault) Serial.println("phiguardian.bench:sensor_fault");
#endif
  delay(5);
}
