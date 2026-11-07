#include "guardian_logic.hpp"

#include <cmath>

namespace guardian {

NodeLogic::NodeLogic(Settings settings) : cfg_(settings) {}

void NodeLogic::startHaptic(Pattern pattern, uint32_t nowMs) {
  pattern_ = pattern;
  patternStartedAt_ = nowMs;
}

bool NodeLogic::hapticAt(uint32_t nowMs) {
  // Unsigned subtraction tolerates millis() wraparound for short intervals.
  const uint32_t elapsed = nowMs - patternStartedAt_;
  if (pattern_ == Pattern::SosAck) {
    if (elapsed >= 670) { pattern_ = Pattern::None; return false; }
    return elapsed < 120 || (elapsed >= 210 && elapsed < 330) || elapsed >= 420;
  }
  if (pattern_ == Pattern::ImpactNotice) {
    if (elapsed >= 320) { pattern_ = Pattern::None; return false; }
    return elapsed < 100 || elapsed >= 220;
  }
  return false;
}

Output NodeLogic::tick(uint32_t nowMs, bool buttonPressed, bool imuReady, float accelerationG) {
  Output out;
  if (!initialized_) {
    initialized_ = true;
    rawButton_ = buttonPressed;
    stableButton_ = false;
    rawChangedAt_ = nowMs;
    prevImuReady_ = imuReady;
    // Never arm SOS for a button held across reset or power-on.
    ignoreUntilReleased_ = buttonPressed;
  }

  if (buttonPressed != rawButton_) {
    rawButton_ = buttonPressed;
    rawChangedAt_ = nowMs;
  }
  if (rawButton_ != stableButton_ && nowMs - rawChangedAt_ >= cfg_.debounceMs) {
    stableButton_ = rawButton_;
    if (stableButton_) {
      pressedAt_ = nowMs;
      sosFired_ = false;
    } else {
      ignoreUntilReleased_ = false;
    }
  }
  if (stableButton_ && !ignoreUntilReleased_ && !sosFired_ && nowMs - pressedAt_ >= cfg_.sosHoldMs) {
    sosFired_ = true;
    out.sosPress = true;
    startHaptic(Pattern::SosAck, nowMs);
  }

  if (prevImuReady_ && !imuReady) out.sensorFault = true;
  prevImuReady_ = imuReady;
  out.faultLed = !imuReady && (nowMs / 500u) % 2u == 0u;

  if (imuReady && std::isfinite(accelerationG) && accelerationG >= 0.0f) {
    if (accelerationG <= cfg_.impactRearmG) overImpactThreshold_ = false;
    if (!overImpactThreshold_ && accelerationG >= cfg_.impactThresholdG) {
      overImpactThreshold_ = true;
      if (!impactEver_ || nowMs - lastImpactAt_ >= cfg_.impactCooldownMs) {
        impactEver_ = true;
        lastImpactAt_ = nowMs;
        out.impactCandidate = true;
        if (!out.sosPress && pattern_ != Pattern::SosAck) startHaptic(Pattern::ImpactNotice, nowMs);
      }
    }
  }
  out.haptic = hapticAt(nowMs);
  return out;
}

}  // namespace guardian
