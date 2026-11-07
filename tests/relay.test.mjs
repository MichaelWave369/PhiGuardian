import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { EventStore } from "../server/domain.mjs";
import { makeHandler } from "../server/http.mjs";
import { WearableTranslator } from "../wearable/companion/translate.mjs";
import { WearableRelay, getLoopbackIngressUrl } from "../wearable/companion/relay.mjs";

const SECRET = "test-token-with-at-least-16-characters";
const PACKET = Object.freeze({
  protocol: "phiguardian.wearable/1",
  deviceId: "guardian-node-01",
  bootId: "9f6d4a832c17b0ea",
  sequence: 19,
  uptimeMs: 84622,
  kind: "sos_press",
});

const translator = (now = () => new Date()) =>
  new WearableTranslator({ allowedDeviceIds: new Set([PACKET.deviceId]), now });

const createHarness = async (token = SECRET) => {
  const store = new EventStore();
  const server = createServer(makeHandler({
    store,
    status: { frigate: { configured: false, connected: false } },
    ingestToken: token,
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    store,
    url: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise(resolve => server.close(resolve)),
  };
};

function relay({ baseUrl, consent = () => true, trusted = () => true, ...opts }) {
  return new WearableRelay({
    translator: translator(),
    baseUrl,
    ingestToken: SECRET,
    verifyTransport: trusted, // TEST STUB, not actual Bluetooth authentication.
    hasOperatorConsent: consent, // TEST STUB, not a user-facing permission UI.
    ...opts,
  });
}

test("loopback-only URL policy rejects external, credential-bearing and path-modified endpoints", () => {
  assert.equal(getLoopbackIngressUrl("http://127.0.0.1:8787"), "http://127.0.0.1:8787/api/events");
  for (const bad of [
    "http://localhost:8787", "https://127.0.0.1:8787", "http://192.168.1.4:8787",
    "http://example.org:8787", "http://127.0.0.1:8787/other",
    "http://user:pass@127.0.0.1:8787", "http://127.0.0.1:8787?token=abc",
  ]) {
    assert.throws(() => getLoopbackIngressUrl(bad), TypeError);
  }
});

test("fails closed with missing verifier, consent checker or host token", () => {
  assert.throws(() => new WearableRelay({ translator: translator(), ingestToken: SECRET }), TypeError);
  assert.throws(() => new WearableRelay({
    translator: translator(), verifyTransport: () => true,
    hasOperatorConsent: () => true, ingestToken: "123",
  }), TypeError);
});

test("trusted and consented events reach real localhost Guardian API with exact storage acknowledgment", async () => {
  const host = await createHarness();
  try {
    const gateway = relay({ baseUrl: host.url });
    const response = await gateway.receive(PACKET, { testSessionId: "stub-verified" });
    assert.equal(response.status, "stored");
    assert.equal(response.reason, "guardian_volatile_memory_only");
    const events = host.store.list();
    assert.equal(events.length, 1);
    assert.equal(events[0].id, response.eventId);
    assert.equal(events[0].source.kind, "sensor");
    assert.equal(events[0].source.name, "Wearable guardian-node-01");
    assert.equal(events[0].simulated, false);
    assert.match(events[0].description, /No automatic emergency contact/i);
    assert.equal((await gateway.receive(PACKET, {})).reason, "unknown_or_duplicate");
    assert.equal(host.store.list().length, 1);
  } finally {
    await host.close();
  }
});

test("invalid, untrusted and unconsented packets never hit event ingestion", async () => {
  const host = await createHarness();
  try {
    const malicious = relay({ baseUrl: host.url, trusted: () => false });
    assert.deepEqual(await malicious.receive(PACKET, {}), {
      status: "blocked", reason: "untrusted_transport",
    });
    const unconsented = relay({ baseUrl: host.url, consent: () => false });
    assert.equal((await unconsented.receive(PACKET, {})).reason, "consent_missing");
    const malformed = relay({ baseUrl: host.url });
    assert.equal((await malformed.receive({ ...PACKET, rawAudio: "nope" }, {})).reason, "invalid_packet");
    assert.equal(host.store.list().length, 0);
  } finally {
    await host.close();
  }
});

test("consent is checked on every packet and revocation clears translator state", async () => {
  const host = await createHarness();
  let permitted = true;
  try {
    const gateway = relay({ baseUrl: host.url, consent: () => permitted });
    assert.equal((await gateway.receive(PACKET, {})).status, "stored");
    permitted = false;
    assert.equal((await gateway.receive({ ...PACKET, sequence: 20, uptimeMs: 86000 }, {})).reason, "consent_missing");
    gateway.revokeDevice(PACKET.deviceId);
    permitted = true;
    assert.equal((await gateway.receive({ ...PACKET, sequence: 21, uptimeMs: 87000 }, {})).reason, "unknown_or_duplicate");
    assert.equal(host.store.list().length, 1);
  } finally { await host.close(); }
});

test("incorrect Guardian API token is not claimed as delivered or stored", async () => {
  const host = await createHarness("different-server-token-with-lots-of-characters");
  try {
    const gateway = relay({ baseUrl: host.url });
    const result = await gateway.receive(PACKET, {});
    assert.equal(result.status, "not_sent");
    assert.equal(result.reason, "guardian_authorization_denied");
    assert.equal(host.store.list().length, 0);
  } finally { await host.close(); }
});

test("Guardian unavailable or invalid acknowledgment never creates false SOS delivery", async () => {
  const timeout = relay({
    baseUrl: "http://127.0.0.1:1",
    fetchImpl: async () => { throw new Error("secret network error that must never be returned"); },
  });
  const result = await timeout.receive(PACKET, {});
  assert.equal(result.status, "unavailable");
  assert.equal(JSON.stringify(result).includes("secret"), false);
  const fakeSuccess = relay({
    fetchImpl: async () => ({ status: 202, json: async () => ({ accepted: false }) }),
  });
  const duplicate = await fakeSuccess.receive(PACKET, {});
  assert.equal(duplicate.status, "not_stored");
  assert.equal(duplicate.reason, "duplicate_or_outside_retention");
});

test("slow Guardian cannot overflow bounded concurrent requests", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const gateway = relay({
    maxInflight: 1,
    fetchImpl: async () => { await pending; return { status: 202, json: async () => ({ accepted: true }) }; },
  });
  const first = gateway.receive(PACKET, {});
  // Admit the first pending request before sending the next.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await gateway.receive({ ...PACKET, sequence: 20, uptimeMs: 86000 }, {})).reason, "busy");
  release();
  assert.equal((await first).status, "stored");
  assert.equal((await gateway.receive({ ...PACKET, sequence: 20, uptimeMs: 86000 }, {})).status, "stored");
});

test("transport verification errors fail closed without leaking exceptions", async () => {
  const gateway = relay({ trusted: () => { throw new Error("Internal credentials"); } });
  const result = await gateway.receive(PACKET, {});
  assert.deepEqual(result, { status: "blocked", reason: "authorization_check_failed" });
});
