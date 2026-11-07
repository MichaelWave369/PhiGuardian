#include "../src/guardian_logic.hpp"

#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>

using guardian::NodeLogic;
using guardian::Output;

void testDebounceAndOneShotSos() {
  NodeLogic node;
  assert(!node.tick(0, false, true, 1.0f).sosPress);
  assert(!node.tick(10, true, true, 1.0f).sosPress);
  assert(!node.tick(20, false, true, 1.0f).sosPress);
  assert(!node.tick(30, true, true, 1.0f).sosPress);
  assert(!node.tick(65, true, true, 1.0f).sosPress);
  assert(!node.tick(1864, true, true, 1.0f).sosPress);
  const Output sos = node.tick(1865, true, true, 1.0f);
  assert(sos.sosPress && sos.haptic);
  assert(!node.tick(1880, true, true, 1.0f).sosPress);
  assert(!node.tick(2600, true, true, 1.0f).sosPress);
  node.tick(2650, false, true, 1.0f);
  node.tick(2685, false, true, 1.0f);
  node.tick(2750, true, true, 1.0f);
  node.tick(2785, true, true, 1.0f);
  assert(node.tick(4585, true, true, 1.0f).sosPress);
}

void testHapticPattern() {
  NodeLogic node;
  node.tick(0, false, true, 1.0f);
  node.tick(10, true, true, 1.0f);
  node.tick(45, true, true, 1.0f);
  assert(node.tick(1845, true, true, 1.0f).haptic);
  assert(!node.tick(1990, true, true, 1.0f).haptic);
  assert(node.tick(2060, true, true, 1.0f).haptic);
  assert(!node.tick(2220, true, true, 1.0f).haptic);
  assert(node.tick(2300, true, true, 1.0f).haptic);
  assert(!node.tick(2600, true, true, 1.0f).haptic);
}

void testImpactCandidateEdgeAndCooldown() {
  NodeLogic node;
  node.tick(0, false, true, 1.0f);
  assert(node.tick(100, false, true, 3.1f).impactCandidate);
  assert(!node.tick(120, false, true, 3.9f).impactCandidate);
  node.tick(300, false, true, 1.0f);
  assert(!node.tick(400, false, true, 3.2f).impactCandidate);
  node.tick(4600, false, true, 1.0f);
  assert(node.tick(4700, false, true, 3.0f).impactCandidate);
  node.tick(5200, false, true, 1.0f);
  assert(!node.tick(5300, false, true, std::numeric_limits<float>::quiet_NaN()).impactCandidate);
}

void testSensorFaultAndOfflineSos() {
  NodeLogic node;
  node.tick(0, false, true, 1.0f);
  assert(node.tick(100, false, false, 1.0f).sensorFault);
  assert(!node.tick(200, false, false, 1.0f).sensorFault);
  node.tick(300, true, false, 1.0f);
  node.tick(335, true, false, 1.0f);
  assert(node.tick(2135, true, false, 1.0f).sosPress);
  node.tick(2400, false, true, 1.0f);
  assert(node.tick(2500, false, false, 1.0f).sensorFault);
}

void testHeldButtonAtBootDoesNotAccidentallySOS() {
  NodeLogic node;
  node.tick(0, true, true, 1.0f);
  node.tick(35, true, true, 1.0f);
  assert(!node.tick(5000, true, true, 1.0f).sosPress);
  node.tick(5010, false, true, 1.0f);
  node.tick(5045, false, true, 1.0f);
  node.tick(5100, true, true, 1.0f);
  node.tick(5135, true, true, 1.0f);
  assert(node.tick(6935, true, true, 1.0f).sosPress);
}

void testUnsignedClockWraparound() {
  NodeLogic node;
  const uint32_t max = std::numeric_limits<uint32_t>::max();
  node.tick(max - 100, false, true, 1.0f);
  node.tick(max - 50, true, true, 1.0f);
  node.tick(max - 15, true, true, 1.0f);
  assert(!node.tick(1600, true, true, 1.0f).sosPress);
  assert(node.tick(1785, true, true, 1.0f).sosPress);
}

int main() {
  testDebounceAndOneShotSos();
  testHapticPattern();
  testImpactCandidateEdgeAndCooldown();
  testSensorFaultAndOfflineSos();
  testUnsignedClockWraparound();
  testHeldButtonAtBootDoesNotAccidentallySOS();
  std::cout << "Guardian Node native logic: all checks passed\n";
}
