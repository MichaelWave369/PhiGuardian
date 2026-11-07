import test from "node:test";
import assert from "node:assert/strict";
import { EventStore, normalizeFrigate, parseZones, validateIncoming } from "../server/domain.mjs";

const example = { id: "evt1", label: "person", camera: "front", start_time: 1750000000, zones: ["walkway"], data: { score: 0.82 }, false_positive: false };

test("normalizes Frigate detection without inferring a person's intent", () => {
  const event = normalizeFrigate(example);
  assert.equal(event.category, "person");
  assert.equal(event.severity, "info");
  assert.equal(event.title, "Person observed");
  assert.equal(event.confidence, 0.82);
  assert.equal(event.simulated, false);
  assert.equal(event.source.name, "front");
});

test("explicit review zone produces an advisory, never a threat label", () => {
  const event = normalizeFrigate(example, { reviewZones: parseZones("walkway") });
  assert.equal(event.severity, "caution");
  assert.match(event.description, /verify the context/i);
});

test("rejects false positives, unknown labels, missing IDs", () => {
  assert.equal(normalizeFrigate({ ...example, false_positive: true }), null);
  assert.equal(normalizeFrigate({ ...example, label: "unknown" }), null);
  assert.equal(normalizeFrigate({ ...example, id: "" }), null);
});

test("pet hazard zones are opt-in", () => {
  const dog = { ...example, label: "dog" };
  assert.equal(normalizeFrigate(dog).severity, "info");
  assert.equal(normalizeFrigate(dog, { petHazardZones: new Set(["walkway"]) }).severity, "caution");
});

const validSensor = {
  schemaVersion: "1.0", id: "sensor:a1", observedAt: "2026-11-06T12:00:00.000Z",
  category: "environment", severity: "info", title: "Water detected",
  description: "Sensor triggered", source: { kind: "sensor", name: "Water monitor" },
  zone: null, confidence: null, simulated: false,
};
test("validates sensor events and strips unrecognized fields", () => {
  const safe = validateIncoming({ ...validSensor, secretExtra: "must not survive" });
  assert.ok(safe);
  assert.equal("secretExtra" in safe, false);
  assert.equal(validateIncoming({ ...validSensor, simulated: true }), null);
  assert.equal(validateIncoming({ ...validSensor, confidence: 2 }), null);
  assert.equal(validateIncoming({ ...validSensor, source: { kind: "frigate", name: "not allowed" } }), null);
});

test("event store deduplicates, expires, and bounds observations", () => {
  let now = Date.parse("2026-11-06T12:00:10.000Z");
  const store = new EventStore({ clock: () => now, max: 2, ttlMs: 60_000 });
  assert.equal(store.add(validSensor), true);
  assert.equal(store.add(validSensor), false);
  store.add({ ...validSensor, id: "sensor:a2" });
  store.add({ ...validSensor, id: "sensor:a3" });
  assert.equal(store.list().length, 2);
  now += 61_000;
  assert.equal(store.list().length, 0);
});
