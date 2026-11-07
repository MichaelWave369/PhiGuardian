export const SCHEMA_VERSION = "1.0";
const CATEGORY_BY_LABEL = {
  person: "person", car: "vehicle", truck: "vehicle", bus: "vehicle",
  motorcycle: "vehicle", bicycle: "vehicle", dog: "animal",
  cat: "animal", bird: "animal",
};
const CATEGORIES = new Set(["person", "vehicle", "animal", "environment", "sound", "system"]);
const LEVELS = new Set(["info", "caution"]);
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isRealDate = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

export function parseZones(value) {
  return new Set(String(value || "").split(",").map(x => x.trim()).filter(Boolean));
}

export function normalizeFrigate(raw, rules = {}) {
  if (!raw || typeof raw !== "object" || raw.false_positive === true) return null;
  const label = clean(raw.label, 32).toLowerCase();
  const category = CATEGORY_BY_LABEL[label];
  const id = clean(raw.id, 120);
  const camera = clean(raw.camera, 80);
  if (!category || !id || !camera || typeof raw.start_time !== "number" || !Number.isFinite(raw.start_time)) return null;
  const observedAt = new Date(raw.start_time * 1000);
  if (Number.isNaN(observedAt.getTime())) return null;
  const zones = Array.isArray(raw.zones) ? raw.zones.filter(z => typeof z === "string").map(z => z.slice(0, 80)) : [];
  const review = rules.reviewZones || new Set();
  const petHazards = rules.petHazardZones || new Set();
  const caution = zones.some(zone =>
    (category === "animal" && petHazards.has(zone)) ||
    ((category === "person" || category === "vehicle") && review.has(zone))
  );
  const score = raw.data?.score;
  const confidence = typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1 ? score : null;
  const item = label.charAt(0).toUpperCase() + label.slice(1);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "frigate:" + id,
    observedAt: observedAt.toISOString(),
    category,
    severity: caution ? "caution" : "info",
    title: item + " observed",
    description: caution ? "Observed in a configured review zone; please verify the context." : "Object observed by a configured local camera.",
    source: { kind: "frigate", name: camera },
    zone: zones[0] || null,
    confidence,
    simulated: false,
  };
}

// Return a newly projected record: no arbitrary metadata or media is retained.
export function validateIncoming(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.schemaVersion !== SCHEMA_VERSION || raw.simulated !== false) return null;
  if (!CATEGORIES.has(raw.category) || !LEVELS.has(raw.severity)) return null;
  if (!raw.source || raw.source.kind !== "sensor") return null;
  const id = clean(raw.id, 128);
  const title = clean(raw.title, 120);
  const name = clean(raw.source.name, 80);
  const description = clean(raw.description, 240);
  const zone = raw.zone === null ? null : clean(raw.zone, 80);
  const confidence = raw.confidence;
  if (!id || !title || !name || !isRealDate(raw.observedAt)) return null;
  if (raw.zone !== null && !zone) return null;
  if (confidence !== null && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) return null;
  return {
    schemaVersion: SCHEMA_VERSION, id, observedAt: new Date(raw.observedAt).toISOString(),
    category: raw.category, severity: raw.severity, title, description,
    source: { kind: "sensor", name }, zone, confidence, simulated: false,
  };
}

export class EventStore {
  constructor({ clock = () => Date.now(), max = 200, ttlMs = 60 * 60 * 1000 } = {}) {
    this.clock = clock;
    this.max = max;
    this.ttlMs = ttlMs;
    this.events = [];
  }
  prune() {
    const cutoff = this.clock() - this.ttlMs;
    this.events = this.events.filter(e => Date.parse(e.observedAt) >= cutoff && Date.parse(e.observedAt) <= this.clock() + 60_000);
  }
  add(event) {
    this.prune();
    if (!event || !isRealDate(event.observedAt) || Date.parse(event.observedAt) < this.clock() - this.ttlMs ||
      Date.parse(event.observedAt) > this.clock() + 60_000 ||
      this.events.some(e => e.id === event.id)) return false;
    this.events.push(event);
    this.events.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    this.events = this.events.slice(0, this.max);
    return true;
  }
  list() {
    this.prune();
    return this.events.slice();
  }
}
