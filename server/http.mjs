import { timingSafeEqual } from "node:crypto";
import { validateIncoming } from "./domain.mjs";

const ORIGINS = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const json = (res, code, value) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'",
  });
  res.end(JSON.stringify(value));
};
const authenticated = (supplied, expected) => {
  if (!expected || typeof supplied !== "string" || !supplied.startsWith("Bearer ")) return false;
  const a = Buffer.from(supplied.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
const readJson = async request => {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 16_384) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

export function makeHandler({ store, status, ingestToken = "" }) {
  return async function handler(req, res) {
    const origin = req.headers.origin;
    if (origin && !ORIGINS.has(origin)) return json(res, 403, { error: "Origin not allowed" });
    if (origin) {
      // Set only for the two explicitly allowed local Vite origins.
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
      });
      return res.end();
    }
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (req.method === "GET" && path === "/api/health") {
      return json(res, 200, { schemaVersion: "1.0", ok: true, storage: "memory-only", ...status });
    }
    if (req.method === "GET" && path === "/api/events") {
      return json(res, 200, { schemaVersion: "1.0", events: store.list() });
    }
    if (req.method === "GET" && path === "/api/privacy") {
      return json(res, 200, {
        rawMediaStored: false, cloudProcessing: false, faceRecognition: false,
        audioCapture: false, eventStorage: "volatile-memory", eventMax: 200,
        eventTtlSeconds: 3600, ingestionEnabled: Boolean(ingestToken),
      });
    }
    if (req.method === "POST" && path === "/api/events") {
      if (!ingestToken) return json(res, 403, { error: "Sensor ingestion disabled" });
      if (!authenticated(req.headers.authorization, ingestToken)) return json(res, 401, { error: "Unauthorized" });
      let payload;
      try { payload = await readJson(req); }
      catch { return json(res, 400, { error: "Invalid JSON or oversized body" }); }
      const event = validateIncoming(payload);
      if (!event) return json(res, 422, { error: "Invalid v1 event" });
      return json(res, 202, { accepted: store.add(event) });
    }
    return json(res, 404, { error: "Not found" });
  };
}
