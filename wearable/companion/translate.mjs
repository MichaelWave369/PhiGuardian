import { validateIncoming } from "../../server/domain.mjs";

const PROTOCOL = "phiguardian.wearable/1";
const DEVICE_ID = /^[a-z][a-z0-9-]{1,23}$/;
const BOOT_ID = /^[0-9a-f]{16}$/;
const MAX_U32 = 4_294_967_295;
const FIELDS = new Set(["protocol", "deviceId", "bootId", "sequence", "uptimeMs", "kind"]);

const DESCRIPTIONS = Object.freeze({
  sos_press: {
    category: "system",
    severity: "caution",
    title: "Wearable SOS button activated",
    description: "A wearer-initiated button event was received. No automatic emergency contact has been made.",
  },
  impact_candidate: {
    category: "system",
    severity: "caution",
    title: "Possible impact observed",
    description: "Motion sensing reported an impact candidate. This does not confirm a fall or injury.",
  },
  motion_pattern: {
    category: "system",
    severity: "info",
    title: "Motion pattern observed",
    description: "A wearable motion event was reported; additional context may be needed.",
  },
  sound_level_spike: {
    category: "sound",
    severity: "info",
    title: "Elevated sound level observed",
    description: "An opted-in sensor reported a sound-level change; no audio is included.",
  },
  sensor_fault: {
    category: "system",
    severity: "caution",
    title: "Wearable sensor needs attention",
    description: "The wearable reported a sensor fault. Its observations may be unavailable.",
  },
  battery_low: {
    category: "system",
    severity: "info",
    title: "Wearable battery low",
    description: "The wearable reported low battery. Monitoring may soon be interrupted.",
  },
});
const isUint32 = n => Number.isInteger(n) && n >= 0 && n <= MAX_U32;

/**
 * Reject unknown/unexpected fields: no sensor audio, media or identifiers can
 * accidentally leak into the shared Guardian event envelope.
 */
export function parseWearablePacket(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (Object.keys(raw).some(key => !FIELDS.has(key))) return null;
  const { protocol, deviceId, bootId, sequence, uptimeMs, kind } = raw;
  if (protocol !== PROTOCOL || typeof deviceId !== "string" || !DEVICE_ID.test(deviceId)) return null;
  if (typeof bootId !== "string" || !BOOT_ID.test(bootId)) return null;
  if (!isUint32(sequence) || !isUint32(uptimeMs)) return null;
  if (!Object.hasOwn(DESCRIPTIONS, kind)) return null;
  return { protocol, deviceId, bootId, sequence, uptimeMs, kind };
}

/**
 * Companion-side, bounded volatile dedupe and conversion. Not a BLE stack or
 * authentication boundary. Caller MUST establish encrypted/bonded/consented
 * transport before presenting real device packets to this class.
 */
export class WearableTranslator {
  constructor({ allowedDeviceIds = new Set(), now = () => new Date(), maxBootsPerDevice = 16 } = {}) {
    if (!(allowedDeviceIds instanceof Set)) throw new TypeError("allowedDeviceIds must be a Set");
    if (!Number.isInteger(maxBootsPerDevice) || maxBootsPerDevice < 1 || maxBootsPerDevice > 256) throw new RangeError("maxBootsPerDevice must be 1..256");
    this.allowedDeviceIds = new Set([...allowedDeviceIds].filter(id => typeof id === "string" && DEVICE_ID.test(id)));
    this.now = now;
    this.maxBootsPerDevice = maxBootsPerDevice;
    this.sessions = new Map();
  }

  accept(raw) {
    const packet = parseWearablePacket(raw);
    if (!packet || !this.allowedDeviceIds.has(packet.deviceId)) return null;
    const boots = this.sessions.get(packet.deviceId) || new Map();
    const previous = boots.get(packet.bootId);
    if (previous && (packet.sequence <= previous.sequence || packet.uptimeMs < previous.uptimeMs)) return null;
    const time = this.now();
    if (!(time instanceof Date) || !Number.isFinite(time.getTime())) return null;
    const template = DESCRIPTIONS[packet.kind];
    const event = validateIncoming({
      schemaVersion: "1.0",
      id: `wearable:${packet.deviceId}:${packet.bootId}:${packet.sequence}`,
      observedAt: time.toISOString(),
      category: template.category,
      severity: template.severity,
      title: template.title,
      description: template.description,
      source: { kind: "sensor", name: "Wearable " + packet.deviceId },
      zone: null,
      confidence: null,
      simulated: false,
    });
    if (!event) return null;
    // LRU-like memory bound; in-process dedupe is NOT equivalent to authenticated replay protection.
    if (boots.has(packet.bootId)) boots.delete(packet.bootId);
    boots.set(packet.bootId, { sequence: packet.sequence, uptimeMs: packet.uptimeMs });
    while (boots.size > this.maxBootsPerDevice) boots.delete(boots.keys().next().value);
    this.sessions.set(packet.deviceId, boots);
    return event;
  }

  forget(deviceId) {
    this.sessions.delete(deviceId);
    this.allowedDeviceIds.delete(deviceId);
  }
}
