# Φ Guardian
**Awareness without surveillance. Protection without control.**

PhiGuardian is an MIT-licensed, local-first **environmental event awareness** foundation for PhiOS. Mission Zero includes a React operator console, a dependency-free Node.js event service, a Frigate NVR adapter, configurable zone-based *advisories*, tests, and CI.

> **Not a certified safety system.** Do not rely on this prototype for emergency response, fire or CO detection, medical decisions, or personal threat assessment. Detection can miss events or raise false alerts. Nothing in this repository infers a person's intent, identity, or dangerousness.

## Mission Zero status
- **Working:** Node HTTP API, versioned normalized event contract, bounded RAM-only store, token-protected sensor event ingress (disabled by default), Frigate event polling, explicit demo-mode React console, zone advisories, health/status checks, unit and HTTP tests.
- **Not implemented:** raw USB/RTSP camera inference, acoustic analysis, biometric identification, smoke/CO monitoring, mobile push, PhiOS/OptiEyes/Gen.E-Wrist connectors, unattended reliability guarantees. These require separate adapters, permissions, and safety review.

## Quick start (Node.js 22+)
```bash
git clone https://github.com/MichaelWave369/PhiGuardian.git
cd PhiGuardian
npm install
npm run dev:api
```
In a second terminal:
```bash
npm run dev:web
```
Visit http://127.0.0.1:5173. The console works with no cameras: press **Explore demo** to display clearly labeled simulated events. Without a Frigate instance, live events are empty by design.

## Connect an existing local Frigate instance
Copy `.env.example` to `.env`; set `GUARDIAN_FRIGATE_URL` to your locally reachable Frigate base URL (e.g. `http://127.0.0.1:5000/` inside a trusted local setup, or an authenticated `https://...` URL). For authenticated Frigate, configure `GUARDIAN_FRIGATE_TOKEN` with a bearer token (never commit it). Start/restart the API. Frigate's own configured detectors do the recognition; Guardian **only normalizes its events**. See [Frigate's event endpoint](https://docs.frigate.video/integrations/api/events-events-get/) and [authentication documentation](https://docs.frigate.video/configuration/authentication/).

Optional comma-separated **zone advisory** settings: `GUARDIAN_REVIEW_ZONES` for person/vehicle presence in a *user-designated* zone, and `GUARDIAN_PET_HAZARD_ZONES` for animals in a pet hazard zone. These are not threat judgments. Unconfigured observations stay informational.

## API
- `GET /api/health` health and source connection state
- `GET /api/events` recent RAM-only events (up to 200)
- `GET /api/privacy` active privacy policy
- `POST /api/events` optional sensor adapter ingestion: **disabled** unless `GUARDIAN_INGEST_TOKEN` is defined; requires `Authorization: Bearer <token>`
- Contract: `docs/EVENT_CONTRACT_V1.md` and `shared/event.schema.json`

Server listens on `127.0.0.1:8787` by default, with restrictive browser CORS. No cloud calls, raw media storage, facial recognition, hidden recording, or always-on microphones are provided. For now, the console accesses the API over loopback. Do **not** expose this development API to a public network. A production multiuser deployment requires authentication, TLS, audit controls, and independent review.

## Tests and build
```bash
npm test
npm run build
```

## Roadmap
1. **Mission Zero:** honest event contract, local Frigate adapter, operator dashboard, demo/live separation, privacy defaults.
2. **Rung One:** opt-in camera adapter, tested retention and authentication, signed/validated sensor providers, calibrated alert policies.
3. **Rung Two:** dedicated certified safety sensor inputs and human-confirmed emergency routing.
4. **Rung Three:** versioned, permission-scoped PhiOS / OptiEyes / Gen.E-Wrist interoperability.

## Principles
Privacy by default. Observe **events, not personalities**. Local reasoning first. Human-centered explanations with uncertainty. Visible active sensors, data deletion, and a physical/manual shutoff path as future system requirements.

Licensed under MIT. See [LICENSE](LICENSE).
