import { WearableTranslator, parseWearablePacket } from "./translate.mjs";

/*
 * Local event submission only. This is NOT a BLE/USB adapter, pairing
 * mechanism, operating-system consent interface, emergency notification
 * service, or trust verifier. The integration must provide independent
 * authenticated-transport and operator-consent checks for EACH packet.
 *
 * Simulator/test verifiers do not constitute real device authentication.
 */

export function getLoopbackIngressUrl(baseUrl = "http://127.0.0.1:8787") {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash ||
      !["/", ""].includes(url.pathname)) {
    throw new TypeError("Companion relay requires a plain HTTP loopback base URL");
  }
  url.pathname = "/api/events";
  return url.href;
}

const result = (status, reason, eventId) => ({
  status,
  ...(reason ? { reason } : {}),
  ...(eventId ? { eventId } : {}),
});

/**
 * The callbacks MUST be supplied by a separate, correctly implemented
 * trusted adapter. They must not trust fields inside the packet or a
 * caller-controlled `session.trusted` boolean.
 *
 * A successful POST confirms ONLY volatile event storage in Guardian.
 * It does not confirm a person received a warning or an SOS message.
 */
export class WearableRelay {
  constructor({
    translator,
    verifyTransport,
    hasOperatorConsent,
    ingestToken,
    baseUrl = "http://127.0.0.1:8787",
    fetchImpl = fetch,
    timeoutMs = 3000,
    maxInflight = 4,
  } = {}) {
    if (!(translator instanceof WearableTranslator)) throw new TypeError("WearableTranslator required");
    if (typeof verifyTransport !== "function" || typeof hasOperatorConsent !== "function") {
      throw new TypeError("A trusted transport verifier and independent operator consent callback are required");
    }
    if (typeof ingestToken !== "string" || ingestToken.length < 16) {
      throw new TypeError("A host-side Guardian ingestion token (at least 16 characters) is required");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
      throw new RangeError("timeoutMs must be between 100 and 30000");
    }
    if (!Number.isInteger(maxInflight) || maxInflight < 1 || maxInflight > 32) {
      throw new RangeError("maxInflight must be between 1 and 32");
    }
    this.translator = translator;
    this.verifyTransport = verifyTransport;
    this.hasOperatorConsent = hasOperatorConsent;
    this.ingestToken = ingestToken;
    this.ingressUrl = getLoopbackIngressUrl(baseUrl);
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxInflight = maxInflight;
    this.inflight = 0;
  }

  async receive(packetLike, connectionContext) {
    const packet = parseWearablePacket(packetLike);
    if (!packet) return result("blocked", "invalid_packet");

    // No trust callback is run against an event alone: it must be bound to the
    // actual external connection, independently of attacker-supplied alias.
    try {
      if (await this.verifyTransport(connectionContext, packet.deviceId) !== true) {
        return result("blocked", "untrusted_transport");
      }
      if (await this.hasOperatorConsent(packet.deviceId) !== true) {
        return result("blocked", "consent_missing");
      }
    } catch {
      return result("blocked", "authorization_check_failed");
    }
    if (this.inflight >= this.maxInflight) return result("not_sent", "busy");

    // Normalization is deliberately performed AFTER transport verification.
    // The translator has a bounded, volatile per-device replay filter.
    const event = this.translator.accept(packet);
    if (!event) return result("blocked", "unknown_or_duplicate");

    this.inflight += 1;
    try {
      const response = await this.fetchImpl(this.ingressUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.ingestToken,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 202) {
        const payload = await response.json();
        if (payload?.accepted === true) return result("stored", "guardian_volatile_memory_only", event.id);
        return result("not_stored", "duplicate_or_outside_retention", event.id);
      }
      if (response.status === 401 || response.status === 403) {
        return result("not_sent", "guardian_authorization_denied", event.id);
      }
      if (response.status === 400 || response.status === 422) {
        return result("not_stored", "guardian_rejected_event", event.id);
      }
      return result("unavailable", "guardian_unavailable", event.id);
    } catch {
      // Do not expose HTTP bodies, credentials, host networking details or
      // the original packet. There is no retry queue in this milestone.
      return result("unavailable", "guardian_unavailable", event.id);
    } finally {
      this.inflight -= 1;
    }
  }

  revokeDevice(deviceId) {
    // Memory-only consent/transport caches are owned by the host adapter.
    // Callers must revoke those independently AND close the live connection.
    this.translator.forget(deviceId);
  }
}
