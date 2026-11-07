import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, Bell, Camera, CarFront, Check, ChevronRight, CircleAlert,
  Clock3, CloudOff, Database, Eye, FlaskConical, Gauge, HardDrive, Info,
  LayoutDashboard, LockKeyhole, MapPin, PawPrint, Radar, Radio, RefreshCw,
  ScanEye, Settings2, ShieldCheck, SlidersHorizontal, UserRound, Waves,
  type LucideIcon,
} from "lucide-react";

type Category = "person" | "vehicle" | "animal" | "environment" | "sound" | "system";
type Severity = "info" | "caution";
type GuardianEvent = {
  schemaVersion: "1.0"; id: string; observedAt: string;
  category: Category; severity: Severity; title: string; description: string;
  source: { kind: "frigate" | "sensor"; name: string };
  zone: string | null; confidence: number | null; simulated: boolean;
};
type Health = {
  ok: boolean; service: string; storage: string;
  frigate: {
    configured: boolean; connected: boolean;
    lastAttemptAt: string | null; lastSuccessAt: string | null; error: string | null;
  };
};
type Privacy = {
  rawMediaStored: boolean; cloudProcessing: boolean; faceRecognition: boolean;
  audioCapture: boolean; eventStorage: string; eventMax: number;
  eventTtlSeconds: number; ingestionEnabled: boolean;
};

const API = import.meta.env.VITE_GUARDIAN_API || "http://127.0.0.1:8787";
const demoTemplate: Array<Pick<GuardianEvent, "category" | "severity" | "title" | "description" | "zone" | "source">> = [
  { category: "person", severity: "info", title: "Person observed", description: "Object observed by a configured local camera.", zone: "Front walkway", source: { kind: "frigate", name: "Front camera" } },
  { category: "animal", severity: "caution", title: "Dog observed", description: "Observed in a configured pet hazard zone; verify the context.", zone: "Driveway", source: { kind: "frigate", name: "South camera" } },
  { category: "vehicle", severity: "info", title: "Car observed", description: "Vehicle observed near the entry approach.", zone: "Entry approach", source: { kind: "frigate", name: "Front camera" } },
  { category: "environment", severity: "caution", title: "Water sensor triggered", description: "Simulated dedicated water sensor event for demonstration.", zone: "Utility room", source: { kind: "sensor", name: "Leak sensor" } },
  { category: "animal", severity: "info", title: "Cat observed", description: "Animal observed by a configured local camera.", zone: "Back garden", source: { kind: "frigate", name: "Garden camera" } },
];
function makeDemo(): GuardianEvent[] {
  const now = Date.now();
  return demoTemplate.map((event, index) => ({
    ...event, schemaVersion: "1.0", id: "demo:" + index,
    observedAt: new Date(now - index * 46_000).toISOString(),
    confidence: index === 3 ? null : 0.84 - index * 0.06,
    simulated: true,
  }));
}
function relativeTime(date: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(date)) / 1000));
  if (!Number.isFinite(seconds)) return "Unknown";
  if (seconds < 60) return seconds + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  return Math.floor(seconds / 3600) + "h ago";
}
const ICONS: Record<Category, LucideIcon> = {
  person: UserRound, vehicle: CarFront, animal: PawPrint,
  environment: Waves, sound: Radio, system: Activity,
};
function EventIcon({ category }: { category: Category }) {
  const Icon = ICONS[category] || Activity;
  return <Icon size={19} strokeWidth={1.85} />;
}
function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={"brand-mark" + (small ? " brand-mark-small" : "")} aria-hidden="true">
      <ShieldCheck size={small ? 20 : 25} strokeWidth={1.8} />
    </span>
  );
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [liveEvents, setLiveEvents] = useState<GuardianEvent[]>([]);
  const [demoEvents, setDemoEvents] = useState<GuardianEvent[]>([]);
  const [demo, setDemo] = useState(false);
  const [filter, setFilter] = useState<"all" | "caution">("all");
  const [page, setPage] = useState<"overview" | "privacy">("overview");
  const [apiError, setApiError] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch(API + "/api/health", { cache: "no-store" }),
        fetch(API + "/api/events", { cache: "no-store" }),
        fetch(API + "/api/privacy", { cache: "no-store" }),
      ]);
      if (responses.some(response => !response.ok)) throw new Error("API unavailable");
      const [h, e, p] = await Promise.all(responses.map(response => response.json()));
      setHealth(h as Health);
      setLiveEvents(Array.isArray(e.events) ? e.events as GuardianEvent[] : []);
      setPrivacy(p as Privacy);
      setApiError(false);
    } catch {
      setHealth(null);
      setApiError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), 5_000);
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [refresh]);

  const events = useMemo(() => (demo ? demoEvents : liveEvents).slice().sort(
    (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)
  ), [demo, demoEvents, liveEvents]);
  const shown = filter === "caution" ? events.filter(e => e.severity === "caution") : events;
  const cautions = events.filter(e => e.severity === "caution").length;
  const sourceCount = new Set(events.map(e => e.source.name)).size;
  const frigateState = health?.frigate.connected ? "Connected" : health?.frigate.configured ? "Needs attention" : "Not configured";
  const activateDemo = () => { setDemoEvents(makeDemo()); setDemo(true); setPage("overview"); setFilter("all"); };
  const clockText = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div><strong>PHI<span>GUARDIAN</span></strong><small>PHI369 LABS / LOCAL CORE</small></div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button className={"nav-item" + (page === "overview" ? " selected" : "")} onClick={() => setPage("overview")}><LayoutDashboard size={18} /> Overview <ChevronRight size={15} className="nav-chevron" /></button>
          <button className={"nav-item" + (page === "privacy" ? " selected" : "")} onClick={() => setPage("privacy")}><LockKeyhole size={18} /> Privacy & policy <ChevronRight size={15} className="nav-chevron" /></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="side-panel">
          <div className="side-panel-title"><span className="pulse-dot" /> GUARDIAN CORE</div>
          <p>Event awareness running locally. No identity profiling.</p>
          <span className="side-panel-version">MISSION ZERO · v0.1</span>
        </div>
        <div className="side-footer"><div className="avatar">Φ</div><div><strong>Local operator</strong><small>Private workspace</small></div><Settings2 size={17} /></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">PHIOS <ChevronRight size={13} /> SAFETY SYSTEMS <ChevronRight size={13} /> <strong>GUARDIAN</strong></div>
          <div className="top-right"><span className="clock"><Clock3 size={14} /> {clockText}</span><span className={"service-pill" + (health ? "" : " off")}><span className="status-dot" /> API {health ? "ONLINE" : "OFFLINE"}</span></div>
        </header>

        <div className="content">
          {page === "overview" ? (
            <>
              <div className="title-row">
                <div><div className="overline">ENVIRONMENTAL INTELLIGENCE / 001</div><h1>Guardian overview<span className="heading-period">.</span></h1><p className="subtitle">Stay aware of what happens around you. Observe events, not intentions.</p></div>
                <div className="title-actions">
                  <button className="outline-btn" onClick={() => void refresh()} title="Refresh live API"><RefreshCw size={16} /> Refresh</button>
                  <button className="primary-btn" onClick={activateDemo}><FlaskConical size={16} /> Explore demo <ArrowRight size={16} /></button>
                </div>
              </div>

              {demo ? (
                <div className="demo-banner"><FlaskConical size={18} /><span><strong>SIMULATION ACTIVE.</strong> These are illustrative events. No camera or sensor detected them.</span><button onClick={() => setDemo(false)}>Return to live feed <ArrowRight size={14} /></button></div>
              ) : apiError ? (
                <div className="notice-banner"><CircleAlert size={18} /><span>Local API unreachable. Run <code>npm run dev:api</code> on this machine to connect the event service.</span></div>
              ) : null}

              <div className="hero-grid">
                <section className="hero-card">
                  <div className="hero-content">
                    <div className="hero-eyebrow"><span className="pulse-dot" /> CORE PRINCIPLE 01 / AWARENESS</div>
                    <h2>Know your surroundings.<br /><em>Keep your autonomy.</em></h2>
                    <p>PhiGuardian turns local sensor observations into clear, contextual information. No cloud dependence. No human threat profiling.</p>
                    <span className="hero-footer"><ShieldCheck size={16} /> LOCAL-FIRST BY DESIGN</span>
                  </div>
                  <div className="radar-art" aria-hidden="true"><div className="radar-grid" /><div className="radar-circle ring-a" /><div className="radar-circle ring-b" /><div className="radar-circle ring-c" /><div className="radar-sweep" /><div className="radar-cross-h" /><div className="radar-cross-v" /><div className="radar-center"><Radar size={22} /></div><div className="radar-blip blip-one" /><div className="radar-blip blip-two" /></div>
                </section>
                <section className="integrity-card">
                  <div className="section-overline">SYSTEM INTEGRITY <span className="inline-green">◆</span></div>
                  <div className="integrity-icon"><ScanEye size={29} strokeWidth={1.5} /></div>
                  <h3>Awareness,<br />not surveillance.</h3>
                  <p>We report what sensors observe, not who a person is or what they might intend.</p>
                  <button className="text-link" onClick={() => setPage("privacy")}>View our principles <ArrowRight size={16} /></button>
                </section>
              </div>

              <div className="metric-grid">
                <div className="metric"><div className="metric-top">EVENT SOURCE <Radio size={18} /></div><strong className="metric-number metric-word">{demo ? "Demo" : frigateState}</strong><span className="metric-foot"><span className={"tiny-dot " + (demo || health?.frigate.connected ? "green" : "gray")} /> {demo ? "Simulated feed" : "Frigate detector adapter"}</span></div>
                <div className="metric"><div className="metric-top">OBSERVATIONS <Eye size={18} /></div><strong className="metric-number">{String(events.length).padStart(2, "0")}</strong><span className="metric-foot">Current {demo ? "demo" : "live"} window</span></div>
                <div className="metric"><div className="metric-top">REVIEW ADVISORIES <CircleAlert size={18} /></div><strong className="metric-number">{String(cautions).padStart(2, "0")}</strong><span className="metric-foot">Context confirmation suggested</span></div>
                <div className="metric"><div className="metric-top">DATA POLICY <Database size={18} /></div><strong className="metric-number metric-word">Memory only</strong><span className="metric-foot"><span className="tiny-dot green" /> Guardian event retention: 1h</span></div>
              </div>

              <div className="dashboard-grid">
                <section className="panel event-panel">
                  <div className="panel-head">
                    <div><span className="section-overline">ACTIVITY STREAM</span><h3>Recent observations <span className="small-count">{events.length}</span></h3></div>
                    <div className="segmented" aria-label="Event severity filter"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All events</button><button className={filter === "caution" ? "active" : ""} onClick={() => setFilter("caution")}>Advisories</button></div>
                  </div>
                  <div className="event-list">
                    {shown.length ? shown.map(event => (
                      <article className="event-row" key={event.id}>
                        <div className={"event-icon " + event.category}><EventIcon category={event.category} /></div>
                        <div className="event-details"><div className="event-title">{event.title} {event.simulated && <span className="demo-tag">DEMO</span>}</div><p>{event.description}</p><div className="event-meta"><MapPin size={12} /> {event.zone || "Unspecified zone"} <span className="dot-separator">•</span>{event.source.name}</div></div>
                        <div className="event-trailing"><span className={"severity " + event.severity}>{event.severity === "caution" ? "Review" : "Info"}</span><small>{relativeTime(event.observedAt, now)}</small></div>
                      </article>
                    )) : (
                      <div className="empty-events"><div className="empty-symbol"><Eye size={23} /></div><h4>No {filter === "caution" ? "advisories" : "observations"} to display</h4><p>{filter === "caution" ? "Nothing in the selected window requires contextual review." : demo ? "The demo feed is empty." : "Connect a local Frigate detector, or explore the clearly labeled demo."}</p>{!demo && <button onClick={activateDemo}>Explore demo <ArrowRight size={14} /></button>}</div>
                    )}
                  </div>
                  <footer className="panel-foot"><span><Clock3 size={13} /> API refreshes every 5 seconds</span><span>{demo ? "SIMULATED DATA" : "LIVE EVENTS ONLY"}</span></footer>
                </section>

                <aside className="right-stack">
                  <section className="panel sources-panel">
                    <div className="panel-head"><div><span className="section-overline">INPUT LAYERS</span><h3>Connected systems</h3></div><SlidersHorizontal size={19} /></div>
                    <div className="source-line"><div className="source-icon"><Camera size={18} /></div><div><strong>Frigate vision</strong><span>{health?.frigate.configured ? "Local object detector" : "Requires configuration"}</span></div><span className={"source-state " + (health?.frigate.connected ? "connected" : "")}>{health?.frigate.connected ? "Online" : "Idle"}</span></div>
                    <div className="source-line"><div className="source-icon"><Radio size={18} /></div><div><strong>Sensor gateway</strong><span>Optional authenticated ingress</span></div><span className={"source-state " + (privacy?.ingestionEnabled ? "connected" : "")}>{privacy?.ingestionEnabled ? "Enabled" : "Disabled"}</span></div>
                    <div className="source-line"><div className="source-icon"><Waves size={18} /></div><div><strong>Audio awareness</strong><span>Not implemented in v0.1</span></div><span className="source-state">Planned</span></div>
                    <div className="source-summary"><Gauge size={15} /> {demo ? sourceCount + " illustrative source(s)" : health?.frigate.connected ? "Frigate events available" : "Awaiting live detector input"}</div>
                  </section>
                  <section className="panel privacy-panel">
                    <div className="panel-head"><div><span className="section-overline">PRIVACY STANDARD</span><h3>Under your control.</h3></div><LockKeyhole size={20} /></div>
                    <div className="privacy-line"><Check size={16} /> No Guardian raw media storage</div>
                    <div className="privacy-line"><Check size={16} /> No facial identification</div>
                    <div className="privacy-line"><Check size={16} /> No Guardian cloud processing</div>
                    <div className="privacy-line"><Check size={16} /> Bounded, volatile event history</div>
                    <button className="privacy-more" onClick={() => setPage("privacy")}>Full privacy design <ArrowRight size={15} /></button>
                  </section>
                </aside>
              </div>
              <div className="disclaimer"><Info size={16} /><span>Prototype, not an emergency response system. Detections may be inaccurate or delayed. Frigate itself may maintain recordings under its own configuration.</span></div>
            </>
          ) : (
            <div className="policy-page">
              <div className="overline">DESIGN POLICY / LOCAL CONTROL</div>
              <h1>Privacy is the architecture<span className="heading-period">.</span></h1>
              <p className="subtitle">The safety-awareness system should never become an unaccountable monitoring system.</p>
              <div className="policy-hero"><LockKeyhole size={35} /><div><strong>Event awareness without identity profiling</strong><p>Guardian reports observable events with clear limits and human review. It does not classify people as threats.</p></div></div>
              <div className="policy-grid">
                <div><HardDrive size={23} /><h3>Local event storage</h3><p>At Mission Zero, Guardian stores only normalized event metadata in server RAM, capped at 200 events and one hour. Restarting clears all events.</p></div>
                <div><CloudOff size={23} /><h3>No cloud processor</h3><p>No Guardian cloud video or audio uploads. Frigate connections go only to the user-configured detector URL; check that provider's own privacy settings separately.</p></div>
                <div><Eye size={23} /><h3>Behavior, not identity</h3><p>People are observations, not targets. Review zones may create neutral presence advisories. No face recognition, demographic inference, or autonomous accusations.</p></div>
                <div><Bell size={23} /><h3>Human oversight</h3><p>Every caution asks for context, not enforcement. No automatic confrontation, emergency call, weapon control, or use-of-force action.</p></div>
              </div>
              <div className="policy-status"><div><strong>Current local API</strong><p>{health ? "Connected to Guardian service" : "Not connected to Guardian service"}</p></div><span className={"service-pill" + (health ? "" : " off")}><span className="status-dot" /> {health ? "ONLINE" : "OFFLINE"}</span></div>
              <button className="outline-btn back-btn" onClick={() => setPage("overview")}><ArrowRight size={16} className="rotate-icon" /> Back to overview</button>
            </div>
          )}
          <div className="main-footer"><div><BrandMark small /> <span>PHIGUARDIAN / MISSION ZERO</span></div><span>LEDGER ABOVE EGO. PEOPLE ABOVE PROFIT.</span></div>
        </div>
      </main>
    </div>
  );
}
