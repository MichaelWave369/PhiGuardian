#pragma once

#include <cstdint>

namespace guardian {

// Platform-neutral and deterministic. This is an event *candidate* generator,
// not fall detection, an emergency service or a human-threat classifier.
struct Settings {
  uint32_t debounceMs = 35;
  uint32_t sosHoldMs = 1800;
  uint32_t impactCooldownMs = 4500;
  float impactThresholdG = 2.8f;
  float impactRearmG = 1.5f;
};

struct Output {
  bool sosPress = false;
  bool impactCandidate = false;
  bool sensorFault = false;
  bool haptic = false;
  bool faultLed = false;
};

class NodeLogic {
 public:
  explicit NodeLogic(Settings settings = {});
  Output tick(uint32_t nowMs, bool buttonPressed, bool imuReady, float accelerationG);

 private:
  enum class Pattern { None, SosAck, ImpactNotice };
  Settings cfg_;
  bool initialized_ = false;
  bool rawButton_ = false;
  bool stableButton_ = false;
  bool sosFired_ = false;
  bool ignoreUntilReleased_ = false;
  bool overImpactThreshold_ = false;
  bool impactEver_ = false;
  bool prevImuReady_ = true;
  uint32_t rawChangedAt_ = 0;
  uint32_t pressedAt_ = 0;
  uint32_t lastImpactAt_ = 0;
  Pattern pattern_ = Pattern::None;
  uint32_t patternStartedAt_ = 0;

  void startHaptic(Pattern pattern, uint32_t nowMs);
  bool hapticAt(uint32_t nowMs);
};

}  // namespace guardian
