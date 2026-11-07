import test from "node:test";
import assert from "node:assert/strict";
import { parseWearablePacket, WearableTranslator } from "../wearable/companion/translate.mjs";
import { validateIncoming, EventStore } from "../server/domain.mjs";

const sample = Object.freeze({
  protocol: "phiguardian.wearable/1",
  deviceId: "guardian-node-01",
  bootId: "9f6d4a832c17b0ea",
  sequence: 19,
  uptimeMs: 84622,
  kind: "sos_press",
});
const fixed = new Date("2026-11-07T05:00:00.000Z");
const makeTranslator = () => new WearableTranslator({
  allowedDeviceIds: new Set(["guardian-node-01"]),
  now: () => fixed,
});

test("accepts only strict minimal envelopes", () => {
  assert.deepEqual(parseWearablePacket(sample), sample);
  assert.equal(parseWearablePacket({ ...sample, microphoneAudio: "raw" }), null);
  assert.equal(parseWearablePacket({ ...sample, macAddress: "AB:CD" }), null);
  assert.equal(parseWearablePacket({ ...sample, protocol: "phiguardian.wearable/2" }), null);
  assert.equal(parseWearablePacket({ ...sample, sequence: -1 }), null);
  assert.equal(parseWearablePacket({ ...sample, uptimeMs: 1.25 }), null);
  assert.equal(parseWearablePacket({ ...sample, deviceId: "../bad" }), null);
  assert.equal(parseWearablePacket({ ...sample, bootId: "not-random" }), null);
  assert.equal(parseWearablePacket({ ...sample, kind: "person_dangerous" }), null);
});

test("normalizes manual SOS without false emergency-delivery claims", () => {
  const event = makeTranslator().accept(sample);
  assert.ok(event);
  assert.equal(event.schemaVersion, "1.0");
  assert.equal(event.category, "system");
  assert.equal(event.severity, "caution");
  assert.equal(event.simulated, false);
  assert.equal(event.source.kind, "sensor");
  assert.equal(event.confidence, null);
  assert.equal(event.zone, null);
  assert.equal(event.observedAt, fixed.toISOString());
  assert.equal(validateIncoming(event)?.id, event.id);
  assert.match(event.description, /No automatic emergency contact/i);
  assert.equal(JSON.stringify(event).includes("macAddress"), false);
});

test("isolates observations, not human intent or uncalibrated certainty", () => {
  const kinds = ["impact_candidate", "motion_pattern", "sound_level_spike", "sensor_fault", "battery_low"];
  for (const [index, kind] of kinds.entries()) {
    const event = makeTranslator().accept({ ...sample, kind, sequence: index + 1 });
    assert.ok(event);
    assert.equal(event.confidence, null);
    assert.equal(event.description.toLowerCase().includes("dangerous person"), false);
    assert.ok(["info", "caution"].includes(event.severity));
  }
});

test("denies unallowed aliases and rejects replayed, regressive or duplicate session sequences", () => {
  const translator = makeTranslator();
  assert.equal(translator.accept({ ...sample, deviceId: "stranger-node" }), null);
  assert.ok(translator.accept(sample));
  assert.equal(translator.accept(sample), null);
  assert.equal(translator.accept({ ...sample, sequence: 18 }), null);
  assert.equal(translator.accept({ ...sample, sequence: 20, uptimeMs: 80000 }), null);
  assert.ok(translator.accept({ ...sample, sequence: 20, uptimeMs: 85000 }));
  assert.ok(translator.accept({ ...sample, bootId: "0123456789abcdef", sequence: 0, uptimeMs: 10 }));
  assert.equal(translator.accept({ ...sample, bootId: "0123456789abcdef", sequence: 0, uptimeMs: 10 }), null);
  translator.forget("guardian-node-01");
  assert.equal(translator.accept({ ...sample, bootId: "abcdef0123456789", sequence: 0, uptimeMs: 10 }), null);
});

test("events fit existing bounded store with no new data retention", () => {
  const translator = makeTranslator();
  const store = new EventStore({ clock: () => fixed.getTime() + 1000 });
  const event = translator.accept(sample);
  assert.equal(store.add(event), true);
  assert.equal(store.add(event), false);
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].id, event.id);
});

test("memory-bounded session table validates options", () => {
  assert.throws(() => new WearableTranslator({ maxBootsPerDevice: 0 }), RangeError);
  const translator = new WearableTranslator({
    allowedDeviceIds: new Set(["guardian-node-01"]),
    now: () => fixed,
    maxBootsPerDevice: 1,
  });
  assert.ok(translator.accept(sample));
  assert.ok(translator.accept({ ...sample, bootId: "0123456789abcdef", sequence: 1, uptimeMs: 5 }));
  assert.equal(translator.sessions.get(sample.deviceId).size, 1);
});
