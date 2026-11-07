import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { EventStore } from "../server/domain.mjs";
import { makeHandler } from "../server/http.mjs";

test("HTTP privacy, health, ingestion auth and browser origin protection", async () => {
  const clock = () => Date.parse("2026-11-06T12:00:10Z");
  const store = new EventStore({ clock });
  const server = createServer(makeHandler({
    store, status: { frigate: { configured: false, connected: false } }, ingestToken: "test-secret",
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const health = await (await fetch(base + "/api/health")).json();
    assert.equal(health.ok, true);
    assert.equal(health.storage, "memory-only");
    const privacy = await (await fetch(base + "/api/privacy")).json();
    assert.equal(privacy.cloudProcessing, false);
    assert.equal(privacy.rawMediaStored, false);
    assert.equal((await fetch(base + "/api/health", { headers: { Origin: "https://example.org" } })).status, 403);
    assert.equal((await fetch(base + "/api/events", { method: "POST", body: "{}" })).status, 401);
    const event = {
      schemaVersion: "1.0", id: "sensor:water", observedAt: "2026-11-06T12:00:00Z",
      category: "environment", severity: "caution", title: "Water observed",
      description: "Water sensor triggered", source: { kind: "sensor", name: "Test" },
      zone: "kitchen", confidence: null, simulated: false,
    };
    const sent = await fetch(base + "/api/events", {
      method: "POST", headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    assert.equal(sent.status, 202);
    assert.equal((await sent.json()).accepted, true);
    const feed = await (await fetch(base + "/api/events")).json();
    assert.equal(feed.events.length, 1);
    assert.equal(feed.events[0].title, "Water observed");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
