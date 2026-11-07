import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { EventStore, parseZones } from "./domain.mjs";
import { makeHandler } from "./http.mjs";
import { startFrigate } from "./frigate.mjs";

if (existsSync(".env")) process.loadEnvFile(".env");
const port = Number(process.env.GUARDIAN_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid GUARDIAN_PORT");
const store = new EventStore();
const baseUrl = process.env.GUARDIAN_FRIGATE_URL?.trim() || "";
const status = {
  service: "PhiGuardian Mission Zero",
  frigate: { configured: Boolean(baseUrl), connected: false, lastAttemptAt: null, lastSuccessAt: null, error: null },
};
const server = createServer(makeHandler({ store, status, ingestToken: process.env.GUARDIAN_INGEST_TOKEN || "" }));
const stop = startFrigate({
  baseUrl, bearerToken: process.env.GUARDIAN_FRIGATE_TOKEN || "",
  store, status,
  rules: {
    reviewZones: parseZones(process.env.GUARDIAN_REVIEW_ZONES),
    petHazardZones: parseZones(process.env.GUARDIAN_PET_HAZARD_ZONES),
  },
});
server.listen(port, "127.0.0.1", () => {
  console.log("PhiGuardian local API: http://127.0.0.1:" + port);
  console.log("Frigate adapter: " + (baseUrl ? "configured" : "disabled"));
});
const shutdown = () => { stop(); server.close(() => process.exit(0)); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
