# PhiGuardian event contract v1

`schemaVersion` is always `"1.0"`. API responses use the JSON shape in [shared/event.schema.json](../shared/event.schema.json). Fields:
- `id`: adapter-scoped stable identifier; de-duplicated while retained
- `observedAt`: UTC ISO-8601 timestamp
- `category`: `person | vehicle | animal | environment | sound | system`
- `severity`: `info | caution`; no autonomous high-risk threat scoring
- `title` and `description`: brief, observable account, never motive or identity
- `source`: `{ kind: "frigate" | "sensor", name: string }`
- `zone`: named user zone or null
- `confidence`: optional model score in 0..1, **not probability of danger**
- `simulated`: boolean, must be false for incoming live events

Ingest accepts only well-formed, validated v1 records over a token-authenticated local endpoint. Normalization strips unknown fields. Demo data is generated **only in the browser** and is visually marked as simulated. No raw images, sound, faces, plate numbers, GPS coordinates, personal identity, or arbitrary AI descriptions are required in this contract. This is a prototype contract, not a safety certification.

Frigate rules: supported object labels `person`, `car`, `truck`, `bus`, `motorcycle`, `bicycle`, `dog`, `cat`, `bird`. Unsupported categories are ignored rather than misrepresented. Review zones are explicit opt-in. Presence in a designated zone causes `caution`, never a declaration about anyone's intentions. Deduplication and retention are RAM-only and reset at restart.
