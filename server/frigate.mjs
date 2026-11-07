import { normalizeFrigate } from "./domain.mjs";

// Frigate does the actual object detection. Guardian only polls its documented event API.
export function startFrigate({ baseUrl, bearerToken, store, rules, status, fetchImpl = fetch, intervalMs = 12000 }) {
  if (!baseUrl) return () => {};
  let base;
  try {
    base = new URL(baseUrl);
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Unexpected protocol");
  } catch {
    status.frigate.error = "Invalid Frigate URL";
    return () => {};
  }
  let inFlight = false;
  let stopped = false;
  async function poll() {
    if (inFlight || stopped) return;
    inFlight = true;
    status.frigate.lastAttemptAt = new Date().toISOString();
    try {
      const url = new URL("api/events", base.href.endsWith("/") ? base : base.href + "/");
      url.searchParams.set("limit", "50");
      url.searchParams.set("after", String(Math.floor(Date.now() / 1000) - 90));
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json", ...(bearerToken ? { Authorization: "Bearer " + bearerToken } : {}) },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error("Frigate HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Frigate returned unexpected data");
      for (const raw of data) {
        const event = normalizeFrigate(raw, rules);
        if (event) store.add(event);
      }
      status.frigate.connected = true;
      status.frigate.lastSuccessAt = new Date().toISOString();
      status.frigate.error = null;
    } catch (error) {
      status.frigate.connected = false;
      // Never surface URLs or credentials in error messages.
      status.frigate.error = error instanceof Error && error.message.startsWith("Frigate HTTP ") ? error.message : "Unable to reach or parse Frigate";
    } finally {
      inFlight = false;
    }
  }
  void poll();
  const timer = setInterval(() => void poll(), Math.max(5000, intervalMs));
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
