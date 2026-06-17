import React, { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// Idle Vehicle Nudge — interactive prototype (Kazam · OCPP 1.6J pilot)
// When a vehicle finishes charging but stays plugged in, waiting drivers
// within 100m can send anonymous, rate-limited nudges to the occupying
// driver. The system also sends automated reminders and escalates to a
// support call. Many waiting drivers are treated as ONE counterparty on a
// single shared conversation; conversation status is visible to all app
// users, but only those within 100m can nudge.
//
// Timeline, with T = the moment charging stops:
//   T      → notification to occupying driver (session over)   [finishing packet]
//   T+5    → automated reminder sent to the driver
//   T+10   → waiting drivers may send a nudge
//   T+20   → support calls the driver to move the vehicle
//   ≥5 min must elapse between any two messages (shared cooldown)
//   gun out → available packet → scrap the chat + remove the button
//   charger offline → remove the button
// ─────────────────────────────────────────────────────────────

// ── Design tokens (verbatim from kazam-tokens) ──────────────
const K = {
  bg: "#0B0B0E",
  card: "#1A1A1C",
  cardLight: "#26262A",
  border: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.06)",
  text: "#FFFFFF",
  text2: "rgba(255,255,255,0.65)",
  text3: "rgba(255,255,255,0.42)",
  purple: "#A77BFF",
  purpleBg: "rgba(167,123,255,0.16)",
  purpleEdge: "rgba(167,123,255,0.35)",
  red: "#E84B4B",
  redBg: "rgba(232,75,75,0.14)",
  redEdge: "rgba(232,75,75,0.32)",
  amber: "#F5A623",
  amberBg: "rgba(245,166,35,0.14)",
  amberEdge: "rgba(245,166,35,0.35)",
  green: "#4CD964",
  greenBg: "rgba(76,217,100,0.14)",
  blue: "#4D9FFF",
  blueBg: "rgba(77,159,255,0.14)",
  blueEdge: "rgba(77,159,255,0.35)",
  font: '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
};

// ── Icons ────────────────────────────────────────────────────
const Ico = {
  back: (c = K.text) => (
    <svg width="11" height="18" viewBox="0 0 11 18" fill="none">
      <path d="M9.5 1.5L2 9l7.5 7.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  help: (c = K.text2) => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12.5" stroke={c} strokeWidth="1.4" />
      <path d="M10.5 11c0-2 1.6-3.5 3.5-3.5s3.5 1.4 3.5 3.2c0 1.7-1.2 2.3-2.4 3.1-1.1.8-1.1 1.6-1.1 2.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="20.5" r="1.1" fill={c} />
    </svg>
  ),
  zap: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" fill={c} />
    </svg>
  ),
  zapOutline: (c, s = 18) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
      <path d="M10 1.5L4 10h4l-1 6.5L13 8H9l1-6.5z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  rupee: (c, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 13 13" fill="none">
      <path d="M3 2h7M3 4.5h7M3.5 2c2.5 0 4 1 4 2.5S6 7 3.5 7H3l5 4" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (c, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.7" stroke={c} strokeWidth="1.4" />
      <path d="M7 3.5V7l2.2 1.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  shield: (c) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.2l5 2v4.4c0 3-2.2 4.8-5 5.4-2.8-.6-5-2.4-5-5.4V3.2l5-2z" stroke={c} strokeWidth="1.3" />
    </svg>
  ),
  pin: (c, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1.2c2.4 0 4.3 1.9 4.3 4.3 0 3-4.3 7-4.3 7s-4.3-4-4.3-7C2.7 3.1 4.6 1.2 7 1.2z" stroke={c} strokeWidth="1.3" />
      <circle cx="7" cy="5.5" r="1.6" stroke={c} strokeWidth="1.3" />
    </svg>
  ),
  phone: (c, s = 18) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
      <path d="M3.5 2.5h3l1.2 3.4-2 1.2c.8 1.8 2.2 3.2 4 4l1.2-2 3.4 1.2v3c0 .8-.7 1.4-1.5 1.3C7.5 14.3 3.6 10.4 3.1 4.4c0-.8.6-1.5 1.4-1.5z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  check: (c, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5L6 11l5.5-7.5" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bell: (c = K.text2) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 14V9a6 6 0 0112 0v5l1.5 1.5h-15L4 14z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 17.5a2 2 0 004 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  bellSmall: (c, s = 18) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
      <path d="M4 14V8a5 5 0 0110 0v6l1.5 1.5h-13L4 14z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 17a2 2 0 004 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  offline: (c, s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5c3.5-3 8.5-3 12 0M4.3 9c2.2-1.8 5.2-1.8 7.4 0M6.6 11.4c.9-.7 1.9-.7 2.8 0" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 2l12 12" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

// ── Timeline & policy constants (T = charging stops, idleSec = 0) ────────────
const CHARGE_DURATION = 60;    // sim seconds of "charging" before T (demo brevity)
const T_SYS_NUDGE = 5 * 60;   // T+5  — automated reminder to occupying driver
const T_WAIT_OPEN = 10 * 60;  // T+10 — waiting drivers may send a nudge
const T_SUPPORT = 20 * 60;    // T+20 — support calls the driver
const COOLDOWN = 5 * 60;      // ≥5 min between any two messages (shared)

// ── Helpers ──────────────────────────────────────────────────
const mmss = (s) => {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const minLabel = (s) => `${Math.floor(Math.max(0, s) / 60)} min`;

// Occupying driver's reply options — sent in response to a nudge
const QUICK_REPLIES = ["I'll be there in 2 min", "I'll be there in 5 min", "I'll be there in 15 min"];

// Eligibility is a session-level gate: the feature arms only for eligible
// app-user sessions. RFID / OCPI sessions silently no-op.
const featureArmed = (s) => s.eligible && s.connector !== "available";

// Waiting send needs ≥5 min since the last message (any party) AND T+10 reached.
const coolRemain = (s) => Math.max(0, s.lastMsgSec + COOLDOWN - s.idleSec);
const openRemain = (s) => Math.max(0, T_WAIT_OPEN - s.idleSec);
const canWaitingNudge = (s) =>
  s.eligible && s.inRange && s.connector === "finishing" &&
  s.idleSec >= T_WAIT_OPEN && coolRemain(s) <= 0;
const lastMsg = (log) => (log.length ? log[log.length - 1] : null);
const lastMsgText = (e) => {
  if (!e) return "No messages yet";
  if (e.kind === "wait") return "Waiting driver sent a nudge";
  if (e.kind === "occupier") return "Occupying driver replied";
  return typeof e.label === "string" ? e.label : "Update";
};

// ── Status pill ──────────────────────────────────────────────
function StatusPill({ tone = "green", label, dot = true }) {
  const map = {
    green: { bg: K.greenBg, fg: K.green },
    amber: { bg: K.amberBg, fg: K.amber },
    red: { bg: K.redBg, fg: K.red },
    blue: { bg: K.blueBg, fg: K.blue },
    purple: { bg: K.purpleBg, fg: K.purple },
    grey: { bg: "rgba(255,255,255,0.08)", fg: K.text2 },
  };
  const c = map[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: c.bg, color: c.fg, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, letterSpacing: 0.1 }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />}
      {label}
    </span>
  );
}

// ── iOS device frame (status bar + dynamic island + home bar) ─
function IOSStatusBar({ time = "9:41" }) {
  const c = "#fff";
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 30px 0", pointerEvents: "none" }}>
      <span style={{ fontWeight: 600, fontSize: 15, color: c, fontVariantNumeric: "tabular-nums" }}>{time}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="6.5" width="3" height="4" rx="0.6" fill={c} /><rect x="4.5" y="4.5" width="3" height="6" rx="0.6" fill={c} /><rect x="9" y="2.5" width="3" height="8" rx="0.6" fill={c} /><rect x="13.5" y="0" width="3" height="10.5" rx="0.6" fill={c} /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={c} strokeOpacity="0.4" fill="none" /><rect x="2" y="2" width="18" height="8" rx="1.8" fill={c} /><path d="M23 4v4c.7-.3 1.2-1.1 1.2-2S23.7 4.3 23 4z" fill={c} fillOpacity="0.5" /></svg>
      </div>
    </div>
  );
}

function IOSDevice({ children, dark = true }) {
  return (
    <div style={{ width: 390, height: 800, borderRadius: 46, overflow: "hidden", position: "relative", background: dark ? "#000" : "#F2F2F7", boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)", fontFamily: K.font, WebkitFontSmoothing: "antialiased" }}>
      <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)", width: 122, height: 35, borderRadius: 22, background: "#000", zIndex: 50 }} />
      <IOSStatusBar />
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 60, height: 30, display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 8, pointerEvents: "none" }}>
        <div style={{ width: 135, height: 5, borderRadius: 100, background: "rgba(255,255,255,0.7)" }} />
      </div>
    </div>
  );
}

// ── Shared screen chrome ─────────────────────────────────────
function PageHeader({ title, right, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "60px 22px 14px" }}>
      <div onClick={onBack} style={{ width: 40, height: 40, display: "flex", alignItems: "center", cursor: onBack ? "pointer" : "default" }}>{Ico.back()}</div>
      {title && <div style={{ fontSize: 17, fontWeight: 500, color: K.text }}>{title}</div>}
      <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{right ?? Ico.help()}</div>
    </div>
  );
}

function InfoCell({ label, value, accent }) {
  return (
    <div style={{ background: K.cardLight, borderRadius: 14, padding: "12px 14px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: K.text2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: accent || K.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function BayHero({ statusPill, idleFor, tone = "amber" }) {
  const toneMap = {
    amber: { bg: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(245,166,35,0.18) 0%, transparent 70%)", accent: K.amber, edge: K.amberEdge },
    red: { bg: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(232,75,75,0.20) 0%, transparent 70%)", accent: K.red, edge: K.redEdge },
    blue: { bg: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(77,159,255,0.18) 0%, transparent 70%)", accent: K.blue, edge: "rgba(255,255,255,0.1)" },
    green: { bg: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(76,217,100,0.22) 0%, transparent 70%)", accent: K.green, edge: "rgba(255,255,255,0.1)" },
    grey: { bg: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(255,255,255,0.06) 0%, transparent 70%)", accent: K.text2, edge: "rgba(255,255,255,0.1)" },
  };
  const tk = toneMap[tone];
  return (
    <div style={{ position: "relative", height: 200, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
      <div style={{ position: "absolute", inset: 0, background: tk.bg }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
        <svg width="86" height="50" viewBox="0 0 86 50">
          <path d="M5 36 C 8 22, 18 14, 30 14 L 58 14 C 70 14, 78 22, 80 36 L 80 40 L 5 40 Z" fill="#2A2A2C" stroke="rgba(255,255,255,0.12)" />
          <path d="M28 16 L 38 8 L 56 8 L 64 16 Z" fill="#1f1f22" />
          <circle cx="22" cy="40" r="6" fill="#0c0c0e" stroke="rgba(255,255,255,0.25)" /><circle cx="22" cy="40" r="2.4" fill="#444" />
          <circle cx="64" cy="40" r="6" fill="#0c0c0e" stroke="rgba(255,255,255,0.25)" /><circle cx="64" cy="40" r="2.4" fill="#444" />
          <rect x="74" y="24" width="6" height="6" rx="1" fill={tk.accent} />
        </svg>
        <svg width="48" height="80" viewBox="0 0 48 80">
          <rect x="10" y="6" width="28" height="50" rx="6" fill="#26262A" stroke="rgba(255,255,255,0.15)" />
          <rect x="14" y="12" width="20" height="14" rx="2" fill="#0c0c0e" />
          <circle cx="24" cy="38" r="4" fill={tk.accent} />
          <rect x="14" y="60" width="20" height="14" rx="2" fill="#1c1c1e" />
        </svg>
      </div>
      <div style={{ position: "absolute", top: 14, right: 18 }}>{statusPill}</div>
      {idleFor && (
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", padding: "6px 12px", borderRadius: 999, fontSize: 12, color: tk.accent, fontWeight: 600, border: `1px solid ${tk.edge}`, display: "inline-flex", gap: 6, alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
          {Ico.clock(tk.accent, 12)} {idleFor}
        </div>
      )}
    </div>
  );
}

function StationCard({ children, queue, lastMessage }) {
  return (
    <div style={{ background: K.card, borderRadius: 18, margin: "0 18px", padding: 16, flex: "0 0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: K.text }}>Sangeetha charging station</div>
          <div style={{ fontSize: 13, color: K.text2, marginTop: 3 }}>Kazam Office parking · 1.4 km · ★ 4.3</div>
        </div>
        {queue && <div style={{ background: K.purpleBg, color: K.purple, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{queue}</div>}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 14, color: K.text2, fontSize: 13, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 18, height: 18, borderRadius: 4, background: K.purpleBg, color: K.purple, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Ico.shield(K.purple)}</span>
          Type 2 · 7 kW
        </div>
        <div style={{ width: 1, height: 14, background: K.divider }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{Ico.rupee(K.text2)} 2 Fixed + 2/kWh</div>
      </div>
      {/* last message from the conversation — visible on the charger card */}
      {lastMessage && (
        <div style={{ marginTop: 14, padding: "10px 12px", background: K.cardLight, borderRadius: 12, display: "flex", alignItems: "center", gap: 8 }}>
          {Ico.bell(K.text3)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: K.text3 }}>Latest in conversation</div>
            <div style={{ fontSize: 13, color: K.text2, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMessage}</div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// Chat bubble — sent (right) or received (left). System messages are centred pills.
function LogEntry({ label, labelReceived, time, kind, perspective = "waiting" }) {
  if (kind === "system") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, padding: "4px 12px", fontSize: 11, color: K.text3, fontVariantNumeric: "tabular-nums" }}>
          {label} · {time}
        </div>
      </div>
    );
  }
  // "wait" kind is sent by the waiting driver; "occupier" kind by the occupying driver
  const isSent = (perspective === "waiting" && kind === "wait") || (perspective === "occupying" && kind === "occupier");
  const bubbleBg = isSent ? K.purple : K.cardLight;
  const bubbleColor = isSent ? "#fff" : K.text;
  const senderLabel = kind === "wait" ? "Waiting driver" : "Occupying driver";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isSent ? "flex-end" : "flex-start", padding: "4px 0" }}>
      {!isSent && <div style={{ fontSize: 10, color: K.text3, marginBottom: 3, paddingLeft: 4 }}>{senderLabel}</div>}
      <div style={{ maxWidth: "78%", background: bubbleBg, color: bubbleColor, borderRadius: isSent ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "9px 13px", fontSize: 14, lineHeight: 1.35 }}>{isSent ? label : (labelReceived ?? label)}</div>
      <div style={{ fontSize: 10, color: K.text3, marginTop: 3, fontVariantNumeric: "tabular-nums", paddingRight: isSent ? 4 : 0, paddingLeft: isSent ? 0 : 4 }}>{time}</div>
    </div>
  );
}

// Scrollable conversation thread
function ConversationCard({ log, note = "Anonymous · visible to all app users", perspective = "waiting" }) {
  return (
    <div style={{ background: K.card, borderRadius: 18, margin: "0 18px", padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 2, fontSize: 13, color: K.text2, display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto" }}>
        <span>Conversation</span>
        <span style={{ fontSize: 11, color: K.text3 }}>{note}</span>
      </div>
      <div style={{ borderTop: `1px solid ${K.divider}`, paddingTop: 6, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {log.length === 0 ? (
          <div style={{ fontSize: 13, color: K.text3, padding: "10px 0" }}>No messages yet.</div>
        ) : (
          log.map((e, i) => <LogEntry key={i} {...e} perspective={perspective} />)
        )}
      </div>
    </div>
  );
}

function CtaButton({ tone = "purple", label, sub, disabled, leftIcon, onClick }) {
  const tones = { purple: { bg: K.purple, fg: "#fff" }, red: { bg: K.red, fg: "#fff" }, grey: { bg: K.cardLight, fg: K.text2 } };
  const t = tones[disabled ? "grey" : tone];
  return (
    <button onClick={disabled ? undefined : onClick} style={{ width: "100%", padding: "15px 18px", background: t.bg, color: t.fg, border: "none", borderRadius: 14, cursor: disabled ? "default" : "pointer", fontFamily: K.font, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: disabled ? "none" : tone === "purple" ? "0 8px 24px rgba(167,123,255,0.25)" : tone === "red" ? "0 8px 24px rgba(232,75,75,0.25)" : "none", transition: "transform .1s, filter .15s" }} onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.985)")} onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
      {leftIcon}
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

const AnonNote = ({ text }) => (
  <div style={{ fontSize: 12, color: K.text3, textAlign: "center", marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
    {Ico.shield(K.text3)} {text}
  </div>
);

function ScreenScroll({ children }) {
  // Whole screen fits one page — no page-level scroll. Only the conversation scrolls.
  return (
    <div style={{ position: "absolute", inset: 0, background: K.bg, color: K.text, fontFamily: K.font, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {children}
    </div>
  );
}
function BottomBar({ children }) {
  return (
    <div style={{ marginTop: "auto", padding: "16px 18px 40px", background: `linear-gradient(to top, ${K.bg} 70%, transparent)`, flex: "0 0 auto" }}>
      {children}
    </div>
  );
}

// ── Kazam app home screen (shown to waiting driver while car is charging) ────
function NavItem({ icon, label, active }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {icon}
      <span style={{ fontSize: 10, color: active ? K.purple : "rgba(255,255,255,0.38)", fontWeight: active ? 600 : 400, fontFamily: K.font }}>{label}</span>
    </div>
  );
}

function KazamHomeScreen({ sim, dispatch, onNudge, onCardTap }) {
  const { connector, idleSec, log, eligible, inRange } = sim;
  const chargePct = Math.round(85 + 15 * Math.max(0, Math.min(1, (CHARGE_DURATION + idleSec) / CHARGE_DURATION)));
  const isFinishing = connector === "finishing";
  const canNudge = canWaitingNudge(sim);
  const beforeOpen = isFinishing && idleSec < T_WAIT_OPEN;
  const cooling = isFinishing && !beforeOpen && coolRemain(sim) > 0;
  const lastMessage = lastMsg(log.filter(e => e.kind === "occupier"));

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: K.font, color: K.text, display: "flex", flexDirection: "column", background: "#111114", overflow: "hidden" }}>

      {/* ── Map area ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        {/* Fake dark city map */}
        <svg width="390" height="600" style={{ position: "absolute", top: 0, left: 0 }} aria-hidden="true">
          <rect width="390" height="600" fill="#1A1A1A" />
          {/* building blocks */}
          <rect x="0"   y="0"   width="148" height="188" fill="#1F1F20" />
          <rect x="162" y="0"   width="228" height="130" fill="#1F1F1F" />
          <rect x="0"   y="208" width="140" height="148" fill="#1F1F20" />
          <rect x="162" y="148" width="105" height="128" fill="#202020" />
          <rect x="278" y="148" width="112" height="128" fill="#1E1E1F" />
          <rect x="0"   y="390" width="135" height="210" fill="#1F1F20" />
          <rect x="162" y="314" width="228" height="286" fill="#1F1F1F" />
          {/* vertical road gap */}
          <rect x="149" y="0" width="12" height="600" fill="#242424" />
          {/* horizontal minor roads */}
          <rect x="0"   y="189" width="149" height="18" fill="#242424" />
          <rect x="162" y="130" width="228" height="17" fill="#232323" />
          <rect x="162" y="278" width="228" height="16" fill="#232323" />
          <rect x="0"   y="373" width="149" height="16" fill="#232323" />
          {/* 60 Feet Rd — major near-horizontal */}
          <path d="M -20 395 L 420 365" stroke="#2E2E2E" strokeWidth="24" fill="none" />
          <text x="65" y="363" fill="rgba(255,255,255,0.32)" fontSize="9" transform="rotate(-3.5 65 363)" fontFamily="system-ui">60 Feet Rd</text>
          {/* 1st A Cross Rd — diagonal */}
          <path d="M -20 590 Q 90 430 240 240 Q 310 145 390 60" stroke="#2A2A2A" strokeWidth="18" fill="none" />
          <text x="36" y="488" fill="rgba(255,255,255,0.28)" fontSize="8.5" transform="rotate(-51 36 488)" fontFamily="system-ui">1st A cross Rd</text>
          {/* faint top labels */}
          <text x="6"   y="22" fill="rgba(255,255,255,0.22)" fontSize="8" fontFamily="system-ui">mp...</text>
          <text x="175" y="22" fill="rgba(255,255,255,0.22)" fontSize="8" fontFamily="system-ui">Ga...</text>
          <text x="318" y="22" fill="rgba(255,255,255,0.22)" fontSize="8" fontFamily="system-ui">Cros...</text>
          {/* Charger pin */}
          <g transform="translate(238, 272)">
            <path d="M 0 -26 C -15 -26, -22 -15, -22 -5 C -22 9, 0 30, 0 30 C 0 30, 22 9, 22 -5 C 22 -15, 15 -26, 0 -26 Z" fill="#0D0D0D" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <text x="0" y="3" textAnchor="middle" dominantBaseline="middle" fill="#E84B4B" fontSize="13" fontWeight="900" fontFamily="system-ui">«</text>
          </g>
          {/* User location dot */}
          <circle cx="212" cy="292" r="11" fill="rgba(77,159,255,0.18)" />
          <circle cx="212" cy="292" r="6.5" fill="#4D9FFF" />
          <circle cx="212" cy="292" r="2.8" fill="white" />
        </svg>

        {/* Search bar */}
        <div style={{ position: "absolute", top: 58, left: 14, right: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, background: "rgba(24,24,26,0.97)", borderRadius: 28, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 14px rgba(0,0,0,0.55)" }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.6" /><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="rgba(255,255,255,0.38)" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", flex: 1 }}>Search chargers in 'Pune'</span>
          </div>
          <div style={{ width: 40, height: 40, background: "rgba(24,24,26,0.97)", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{Ico.bell("rgba(255,255,255,0.65)")}</div>
          <div style={{ width: 40, height: 40, background: "rgba(220,220,220,0.95)", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="7" r="3.5" stroke="#555" strokeWidth="1.4" /><path d="M2.5 16c0-3 2.9-5 6.5-5s6.5 2 6.5 5" stroke="#555" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ position: "absolute", top: 108, left: 14, display: "flex", gap: 7 }}>
          {["⫶  Filters", "Available", "CCS", "Type-7", "+10 more"].map((t, i) => (
            <div key={i} style={{ background: "rgba(24,24,26,0.97)", borderRadius: 22, padding: "6px 11px", fontSize: 12, fontWeight: 500, color: K.text, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)" }}>{t}</div>
          ))}
        </div>

        {/* Right FABs */}
        <div style={{ position: "absolute", right: 15, bottom: 82, display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(18,18,20,0.92)", border: "2.5px solid #A77BFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 17s-7-4.5-7-9a4 4 0 018 0 4 4 0 018 0c0 4.5-7 9-7 9z" stroke="#E84B4B" strokeWidth="1.6" fill="#E84B4B" fillOpacity="0.55" /></svg>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(18,18,20,0.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" /><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
        </div>

        {/* Promo banner */}
        <div style={{ position: "absolute", bottom: 14, left: 14, right: 14, background: "#2E7D32", borderRadius: 28, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>⚡🪙</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>Buy a Charger. Start Earning</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: 600, color: "#2E7D32", whiteSpace: "nowrap" }}>Learn more</div>
        </div>
      </div>

      {/* ── Bottom sheet ── */}
      <div style={{ background: "#111114", borderRadius: "20px 20px 0 0", padding: "10px 16px 12px", boxShadow: "0 -4px 20px rgba(0,0,0,0.5)" }}>
        <div style={{ width: 34, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Nearby Chargers</div>
        <div onClick={isFinishing && onCardTap ? onCardTap : undefined} style={{ background: "#1A1A1C", borderRadius: 14, padding: "12px 14px", cursor: isFinishing && onCardTap ? "pointer" : "default" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: isFinishing ? K.amber : K.blue, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: isFinishing ? K.amber : K.blue, fontWeight: 500 }}>{isFinishing ? "Occupied — idle" : "Charging"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "#E84B4B", fontSize: 14, fontWeight: 900, letterSpacing: -2 }}>«</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sangeetha charging station</div>
                  <div style={{ fontSize: 12, color: K.text3, marginTop: 1 }}>Kazam Office parking · 1.4 km</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11, color: K.text3 }}>
                <span>⟳ 1.4 km</span><span>★ 4.3</span><span>₹ 2 Fixed + 2/kWh</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0 0 auto" }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3M13 3H7M13 3v6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              {isFinishing && onNudge && (
                <button
                  onClick={onNudge}
                  title={canNudge ? "Nudge driver" : "Open conversation"}
                  style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${canNudge ? K.purpleEdge : K.divider}`, cursor: "pointer", background: canNudge ? K.purpleBg : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  {Ico.bellSmall(canNudge ? K.purple : K.text3)}
                </button>
              )}
            </div>
          </div>

          {/* Last message — shown once conversation starts */}
          {isFinishing && lastMessage && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
              {Ico.bell(K.text3)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: K.text3 }}>Latest update</div>
                <div style={{ fontSize: 12, color: K.text2, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMessage.label}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div style={{ background: "#111114", paddingBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", height: 56, position: "relative", padding: "0 4px" }}>
          <NavItem active label="Home" icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 10.5L11 3.5l8 7V19H14v-5H8v5H3z" stroke={K.purple} strokeWidth="1.6" fill="none" /></svg>} />
          <NavItem label="Trip Planner" icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 17c2-5 4-7 6-7s4 2 6-4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" fill="none" strokeLinecap="round" /><circle cx="5" cy="17" r="1.8" fill="rgba(255,255,255,0.35)" /><circle cx="17" cy="6" r="1.8" fill="rgba(255,255,255,0.35)" /></svg>} />
          <div style={{ flex: 1 }} />
          <NavItem label="Wallet" icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="6" width="18" height="13" rx="2" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" /><path d="M2 10h18" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" /><circle cx="16" cy="15" r="1.4" fill="rgba(255,255,255,0.35)" /></svg>} />
          <NavItem label="More" icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="5.5" cy="11" r="1.5" fill="rgba(255,255,255,0.35)" /><circle cx="11" cy="11" r="1.5" fill="rgba(255,255,255,0.35)" /><circle cx="16.5" cy="11" r="1.5" fill="rgba(255,255,255,0.35)" /></svg>} />
          {/* QR FAB */}
          <div style={{ position: "absolute", left: "50%", transform: "translate(-50%, -38%)", width: 54, height: 54, borderRadius: 999, background: K.purple, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 18px rgba(167,123,255,0.45)` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
              <rect x="14" y="14" width="3" height="3" fill="white" /><rect x="18" y="14" width="3" height="3" fill="white" />
              <rect x="14" y="18" width="3" height="3" fill="white" /><rect x="18" y="18" width="3" height="3" fill="white" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  WAITING DRIVER — and read-only status for other app users
// ═════════════════════════════════════════════════════════════
function WaitingDriver({ sim, dispatch }) {
  const { connector, eligible, inRange, idleSec, log, supportCalled } = sim;
  const [view, setView] = React.useState("home");

  // Reset to home when connector resets
  React.useEffect(() => {
    if (connector === "charging" || connector === "available") setView("home");
  }, [connector]);

  // home screen — bay occupied and charging, show the Kazam app home
  if ((connector === "charging" || connector === "finishing") && view === "home")
    return <KazamHomeScreen sim={sim} dispatch={dispatch} onNudge={() => { if (canWaitingNudge(sim)) dispatch({ type: "nudge" }); setView("detail"); }} onCardTap={() => setView("detail")} />;

  // bay freed — available packet. Chat already scrapped. No reservation.
  if (connector === "available") {
    return (
      <ScreenScroll>
        <PageHeader />
        <BayHero tone="green" statusPill={<StatusPill tone="green" label="Available" />} />
        <StationCard queue={null}>
          <div style={{ marginTop: 14, padding: "12px 14px", background: K.greenBg, borderRadius: 12, border: "1px solid rgba(76,217,100,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: K.green, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Ico.check("#0B0B0E", 16)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>This bay is now free</div>
              <div style={{ fontSize: 12, color: K.text2, marginTop: 1 }}>No reservation — first to plug in gets it</div>
            </div>
          </div>
        </StationCard>
        <BottomBar>
          <CtaButton tone="purple" label="Start a session" sub="Plug in to begin charging" leftIcon={Ico.zapOutline("#fff", 18)} onClick={() => dispatch({ type: "reset" })} />
        </BottomBar>
      </ScreenScroll>
    );
  }

  // ineligible session → feature silently no-ops: no thread, no button
  if (!eligible) {
    return (
      <ScreenScroll>
        <PageHeader />
        <BayHero tone="amber" statusPill={<StatusPill tone="amber" label="Occupied" />} idleFor={`Idle for ${minLabel(idleSec)}`} />
        <StationCard queue="You're next">
          <div style={{ marginTop: 14, padding: 12, background: K.cardLight, borderRadius: 12, fontSize: 13, color: K.text2 }}>
            This session isn't eligible for nudges. Please wait for the bay to free up.
          </div>
        </StationCard>
        <BottomBar>
          <AnonNote text="Nudge unavailable for this charger" />
        </BottomBar>
      </ScreenScroll>
    );
  }

  // charger offline → status preserved, but no nudge button
  const offline = connector === "offline";
  const tone = supportCalled ? "red" : offline ? "grey" : "amber";
  const statusLabel = offline ? "Charger offline" : supportCalled ? "Idle 20 min" : "Occupied";
  const readOnly = !inRange; // other app users / out of range
  const beforeOpen = idleSec < T_WAIT_OPEN;
  const cooling = coolRemain(sim) > 0;

  let cta, ctaCompact;
  if (offline) {
    cta = (
      <div style={{ padding: "13px 14px", background: K.cardLight, borderRadius: 14, display: "flex", alignItems: "center", gap: 10, color: K.text2 }}>
        {Ico.offline(K.text2)} <span style={{ fontSize: 13 }}>Charger is offline — nudging is unavailable right now.</span>
      </div>
    );
  } else if (readOnly) {
    cta = (
      <div style={{ padding: "13px 14px", background: K.cardLight, borderRadius: 14, display: "flex", alignItems: "center", gap: 10, color: K.text2 }}>
        {Ico.pin(K.text2)} <span style={{ fontSize: 13 }}>You're more than 100m away — view only. Come within range to nudge.</span>
      </div>
    );
  } else if (beforeOpen) {
    cta = <CtaButton disabled label="Nudge driver" sub={`Available in ${mmss(openRemain(sim))}`} leftIcon={Ico.bellSmall(K.text3)} />;
  } else if (cooling) {
    cta = <CtaButton disabled label="Nudge driver" sub={`You can nudge again in ${mmss(coolRemain(sim))}`} leftIcon={Ico.bellSmall(K.text3)} />;
  } else {
    cta = <CtaButton tone="purple" label="Nudge driver" sub="Send an anonymous reminder" leftIcon={Ico.bellSmall("#fff")} onClick={() => dispatch({ type: "nudge" })} />;
    ctaCompact = <CtaButton tone="purple" label="Nudge driver" leftIcon={Ico.bellSmall("#fff")} onClick={() => dispatch({ type: "nudge" })} />;
  }

  // Support CTA — appears at T+20, triggered by the waiting driver
  const supportReady = !offline && !readOnly && idleSec >= T_SUPPORT;

  return (
    <ScreenScroll>
      <PageHeader onBack={() => setView("home")} />
      <BayHero tone={tone} statusPill={<StatusPill tone={tone === "grey" ? "grey" : tone} label={statusLabel} />} idleFor={`Idle for ${minLabel(idleSec)}`} />
      <div style={{ background: K.card, borderRadius: 18, margin: "0 18px", padding: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* Station info */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: K.text }}>Sangeetha charging station</div>
              <div style={{ fontSize: 13, color: K.text2, marginTop: 3 }}>Kazam Office parking · 1.4 km · ★ 4.3</div>
            </div>
            <div style={{ background: K.purpleBg, color: K.purple, padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>You're next</div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 14, color: K.text2, fontSize: 13, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: K.purpleBg, color: K.purple, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Ico.shield(K.purple)}</span>
              Type 2 · 7 kW
            </div>
            <div style={{ width: 1, height: 14, background: K.divider }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{Ico.rupee(K.text2)} 2 Fixed + 2/kWh</div>
          </div>
        </div>
        {/* Conversation thread */}
        <div style={{ borderTop: `1px solid ${K.divider}`, marginTop: 14, paddingTop: 10, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, color: K.text2, marginBottom: 6, flex: "0 0 auto", display: "flex", justifyContent: "space-between" }}>
            <span>Conversation</span>
            <span style={{ fontSize: 11, color: K.text3 }}>Anonymous · visible to all app users</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {log.length === 0 ? (
              <div style={{ fontSize: 13, color: K.text3, padding: "10px 0" }}>No messages yet.</div>
            ) : (
              log.map((e, i) => <LogEntry key={i} {...e} perspective="waiting" />)
            )}
          </div>
        </div>
      </div>
      <BottomBar>
        {supportCalled && (
          <div style={{ marginBottom: 8, padding: "13px 14px", background: K.redBg, border: `1px solid ${K.redEdge}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: K.red, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{Ico.phone("#fff", 14)}</span>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Support has been contacted</div><div style={{ fontSize: 12, color: K.text2, marginTop: 1 }}>They'll call the driver to move the vehicle</div></div>
          </div>
        )}
        {!supportCalled && (supportReady ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <CtaButton tone="red" label="Contact support" leftIcon={Ico.phone("#fff", 16)} onClick={() => dispatch({ type: "support_call" })} />
            {ctaCompact ?? cta}
          </div>
        ) : cta)}
        <AnonNote text={readOnly || offline ? "Conversation status is visible to all app users" : "Anonymous · one shared thread · sent once every 5 min"} />
      </BottomBar>
    </ScreenScroll>
  );
}

// ═════════════════════════════════════════════════════════════
//  OCCUPYING DRIVER — the person blocking the bay
// ═════════════════════════════════════════════════════════════
function OccupyingDriver({ sim, dispatch }) {
  const { connector, eligible, idleSec, log, bReply, sysNudged, supportCalled } = sim;
  const [convoOpen, setConvoOpen] = useState(false);
  const [selectedReply, setSelectedReply] = useState(null);

  // charging screen — session in progress
  if (connector === "charging") {
    const chargePct = Math.round(85 + 15 * Math.max(0, Math.min(1, (CHARGE_DURATION + idleSec) / CHARGE_DURATION)));
    const ringLen = 2 * Math.PI * 84;
    const ringFill = chargePct / 100;
    return (
      <ScreenScroll>
        <PageHeader />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center", padding: "0 24px 20px" }}>
          <div style={{ position: "relative", width: 200, height: 200, marginBottom: 28 }}>
            <svg width="200" height="200" viewBox="0 0 196 196" style={{ position: "absolute", inset: 0 }}>
              <circle cx="98" cy="98" r="84" stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
              <circle cx="98" cy="98" r="84" stroke={K.blue} strokeWidth="9" fill="none"
                strokeDasharray={ringLen} strokeDashoffset={ringLen * (1 - ringFill)}
                strokeLinecap="round" transform="rotate(-90 98 98)"
                style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, lineHeight: 1, color: K.blue, fontVariantNumeric: "tabular-nums" }}>{chargePct}%</div>
              <div style={{ fontSize: 13, color: K.text2, marginTop: 4 }}>Charging</div>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Sangeetha charging station</div>
          <div style={{ fontSize: 14, color: K.text2, marginBottom: 20 }}>Kazam Office parking · 7 kW AC Type 2</div>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <InfoCell label="Started" value="8:50 AM" />
            <InfoCell label="Rate" value="7 kW" />
            <InfoCell label="Battery" value={`${chargePct}%`} accent={K.blue} />
          </div>
        </div>
        <BottomBar>
          <div style={{ padding: "13px 14px", background: K.blueBg, borderRadius: 14, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${K.blueEdge}` }}>
            {Ico.zapOutline(K.blue, 18)}
            <span style={{ fontSize: 13, color: K.blue, fontWeight: 500 }}>We'll notify you when charging is done</span>
          </div>
        </BottomBar>
      </ScreenScroll>
    );
  }

  // charging complete — connector still plugged, please remove it
  if (connector === "finishing" && !sysNudged && !supportCalled && idleSec < T_SYS_NUDGE) {
    return (
      <ScreenScroll>
        <PageHeader />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center", padding: "0 28px 20px" }}>
          <div style={{ width: 100, height: 100, borderRadius: 999, background: K.amberBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, border: `1px solid ${K.amberEdge}` }}>
            {Ico.zapOutline(K.amber, 44)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>Charging complete</div>
          <div style={{ fontSize: 14, color: K.text2, textAlign: "center", lineHeight: 1.6, marginBottom: 28 }}>
            Your battery is at <span style={{ color: K.text, fontWeight: 600 }}>100%</span>. Please remove the connector from your vehicle so the bay is available for other drivers.
          </div>
          <div style={{ width: "100%", background: K.card, borderRadius: 18, padding: 16 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <InfoCell label="Finished at" value="9:36 AM" />
              <InfoCell label="Battery" value="100%" accent={K.green} />
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: K.text3, display: "flex", alignItems: "center", gap: 6 }}>
              {Ico.clock(K.text3, 12)}
              <span>Bay will alert waiting drivers if the connector stays plugged in</span>
            </div>
          </div>
        </div>
        <BottomBar>
          <div style={{ padding: "13px 14px", background: K.amberBg, borderRadius: 14, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${K.amberEdge}` }}>
            {Ico.clock(K.amber, 16)}
            <span style={{ fontSize: 13, color: K.amber, fontWeight: 500 }}>Remove the connector when you're back</span>
          </div>
        </BottomBar>
      </ScreenScroll>
    );
  }

  // bay freed
  if (connector === "available") {
    return (
      <ScreenScroll>
        <PageHeader />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40, padding: "0 24px" }}>
          <div style={{ width: 96, height: 96, borderRadius: 999, background: K.greenBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            {Ico.check(K.green, 48)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Thanks for unplugging</div>
          <div style={{ fontSize: 14, color: K.text2, marginTop: 8, textAlign: "center", lineHeight: 1.45 }}>The bay is now free for the next driver. See your session summary in Wallet.</div>
        </div>
        <BottomBar>
          <CtaButton tone="purple" label="View session summary" onClick={() => dispatch({ type: "reset" })} />
        </BottomBar>
      </ScreenScroll>
    );
  }

  // ineligible → no nudge feature, just a plain charge-complete screen
  const armed = eligible;
  const offline = connector === "offline";
  const urgent = armed && (sysNudged || log.some((e) => e.kind === "wait"));
  const lastWait = [...log].reverse().find((e) => e.kind === "wait" || e.kind === "system");

  return (
    <ScreenScroll>
      <PageHeader />
      {offline && (
        <div style={{ margin: "0 18px 14px", padding: "12px 14px", background: K.cardLight, border: `1px solid ${K.divider}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          {Ico.offline(K.text2)}
          <div style={{ fontSize: 13, color: K.text2 }}>Charger is offline — reminders are paused.</div>
        </div>
      )}
      {urgent && !offline && (
        <div style={{ margin: "0 18px 14px", padding: "12px 14px", background: K.redBg, border: `1px solid ${K.redEdge}`, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: K.red, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M7 12.5v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: K.red }}>{supportCalled ? "Support is on the line" : "A driver is waiting"}</div>
            <div style={{ fontSize: 12, color: K.text2 }}>Please return and unplug your vehicle.</div>
          </div>
        </div>
      )}

      {/* timer ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: urgent ? 2 : 4, flex: "0 0 auto" }}>
        <div style={{ width: urgent ? 156 : 188, height: urgent ? 156 : 188, borderRadius: 999, background: `radial-gradient(circle, ${urgent ? "rgba(232,75,75,0.22)" : "rgba(245,166,35,0.18)"} 0%, transparent 70%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <svg width={urgent ? 156 : 188} height={urgent ? 156 : 188} viewBox="0 0 196 196" style={{ position: "absolute" }}>
            <circle cx="98" cy="98" r="84" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
            <circle cx="98" cy="98" r="84" stroke={urgent ? K.red : K.amber} strokeWidth="6" fill="none" strokeDasharray={`${2 * Math.PI * 84}`} strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 98 98)" />
          </svg>
          <div style={{ textAlign: "center" }}>
            {urgent ? (
              <>
                <div style={{ fontSize: 13, color: K.text2, marginBottom: 2, letterSpacing: 0.4 }}>IDLE FOR</div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{minLabel(idleSec)}</div>
                <div style={{ fontSize: 12, color: K.text3, marginTop: 4 }}>Kazam Office parking · 100%</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>100%</div>
                <div style={{ fontSize: 13, color: K.text2, marginTop: 4 }}>Charge complete</div>
              </>
            )}
          </div>
        </div>
        {!urgent && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, background: K.amberBg, color: K.amber, padding: "8px 14px", borderRadius: 999, fontSize: 14, fontWeight: 600, border: `1px solid ${K.amberEdge}` }}>
            {Ico.clock(K.amber, 14)}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>Session over · {minLabel(idleSec)} idle</span>
          </div>
        )}
      </div>

      {/* scrollable middle: details + shared conversation */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 0 4px" }}>
        {!armed ? (
          <div style={{ margin: "0 18px", background: K.card, borderRadius: 18, padding: 16, fontSize: 13, color: K.text2 }}>
            Charging is complete. Please unplug when convenient.
          </div>
        ) : (
          <>
            {!urgent && (
              <div style={{ margin: "0 18px", background: K.card, borderRadius: 18, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>Sangeetha charging station</div>
                    <div style={{ fontSize: 13, color: K.text2, marginTop: 2 }}>Kazam Office parking · 7 kW AC Type 2</div>
                  </div>
                  <StatusPill tone="amber" label="Plugged in" />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <InfoCell label="Finished at" value="9:36 AM" />
                  <InfoCell label="Battery" value="100%" />
                </div>
              </div>
            )}

            {/* shared conversation — always-visible thread */}
            {lastWait && (
              <div style={{ margin: "8px 18px 0", background: K.card, borderRadius: 16, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: K.text2, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: K.amberBg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Ico.bell(K.amber)}</span>
                  Conversation <span style={{ fontSize: 11, color: K.text3, marginLeft: 4 }}>· Anonymous</span>
                </div>
                <div style={{ borderTop: `1px solid ${K.divider}`, paddingTop: 6 }}>
                  {log.map((e, i) => <LogEntry key={i} {...e} perspective="occupying" />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* reply area — quick ETA replies, available once a nudge has been sent */}
      <BottomBar>
        {armed && !offline && sysNudged ? (
          <>
            {bReply ? (
              <div style={{ padding: "12px 14px", background: K.greenBg, border: `1px solid rgba(76,217,100,0.35)`, borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: K.green, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{Ico.check("#fff", 14)}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: K.green }}>Reply sent</div>
                  <div style={{ fontSize: 12, color: K.text2, marginTop: 1 }}>"{bReply}"</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: K.text2, padding: "0 4px 10px" }}>Reply to the reminder</div>
                {QUICK_REPLIES.map((t) => {
                  const selected = selectedReply === t;
                  return (
                    <button key={t} onClick={() => setSelectedReply(selected ? null : t)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", marginBottom: 8, background: selected ? K.greenBg : K.card, color: K.text, border: `1px solid ${selected ? "rgba(76,217,100,0.4)" : K.divider}`, borderRadius: 14, fontSize: 15, fontWeight: 500, textAlign: "left", cursor: "pointer", fontFamily: K.font }}>
                      <span>{t}</span>
                      {selected && Ico.check(K.green, 16)}
                    </button>
                  );
                })}
                {selectedReply && (
                  <CtaButton tone="purple" label="Send reply" leftIcon={Ico.zapOutline("#fff", 16)} onClick={() => { dispatch({ type: "b_reply", text: selectedReply }); setConvoOpen(true); }} />
                )}
                {!selectedReply && (
                  <div style={{ fontSize: 12, color: K.text3, padding: "4px 4px 0", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    {Ico.shield(K.text3)}<span>Anonymous · one reply per reminder</span>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <CtaButton disabled label={offline ? "Reminders paused" : "Charging complete"} sub={offline ? "Charger offline" : "We'll let you know if a driver is waiting"} leftIcon={Ico.bellSmall(K.text3)} />
        )}
      </BottomBar>
    </ScreenScroll>
  );
}

// ═════════════════════════════════════════════════════════════
//  SIMULATION — shared clock + reducer driving both roles
// ═════════════════════════════════════════════════════════════
const initialSim = () => ({
  running: true,
  speed: 8,                     // sim seconds advanced per real second
  idleSec: -CHARGE_DURATION,    // negative = still charging; 0 = T (charging stops)
  connector: "charging",        // charging | finishing | available | offline
  eligible: true,
  inRange: true,
  lastMsgSec: 0,
  sysNudged: false,
  supportCalled: false,
  replyNudgeAt: null,
  bReply: null,
  log: [],
});

function simReducer(s, a) {
  switch (a.type) {
    case "tick": {
      if (!s.running) return s;
      const idleSec = s.idleSec + a.dt;
      let next = { ...s, idleSec };
      // charging phase → finishing when idleSec reaches 0 (T)
      if (next.connector === "charging" && idleSec >= 0) {
        next.connector = "finishing";
        next.idleSec = 0;
        next.log = [{ kind: "system", label: "Please remove your charger", time: stamp(0) }];
      }
      if (next.connector !== "finishing") return next; // timeline only runs while plugged & finishing
      // T+5 — automated reminder to the occupying driver
      if (!next.sysNudged && idleSec >= T_SYS_NUDGE) {
        next.sysNudged = true;
        next.lastMsgSec = T_SYS_NUDGE;
        next.log = [...next.log, { kind: "system", label: "Please remove your charger", time: stamp(T_SYS_NUDGE) }];
      }

      return next;
    }
    case "support_call": {
      if (s.supportCalled) return s;
      return { ...s, supportCalled: true,
        log: [...s.log, { kind: "system", label: "A driver is waiting — support will call you", time: stamp(s.idleSec) }] };
    }
    case "nudge": {
      // any of many waiting drivers — sender is not surfaced; shared cooldown
      if (!canWaitingNudge(s)) return s;
      return { ...s, lastMsgSec: s.idleSec, replyNudgeAt: null, bReply: null,
        log: [...s.log, { kind: "wait", label: "Hey! please remove your vehicle", labelReceived: "A driver is waiting please remove your vehicle", time: stamp(s.idleSec) }] };
    }
    case "b_reply": {
      if (s.connector !== "finishing" || !s.eligible) return s;
      return { ...s, bReply: a.text, lastMsgSec: s.idleSec,
        log: [...s.log, { kind: "occupier", label: <>Occupying driver: <span style={{ color: K.green }}>“{a.text}”</span></>, time: stamp(s.idleSec) }] };
    }
    case "setConnector": {
      if (a.value === "available") {
        // gun out → available packet → scrap the chat, remove the button
        return { ...s, connector: "available", running: false, log: [], bReply: null, replyNudgeAt: null };
      }
      if (a.value === "offline") return { ...s, connector: "offline" };
      if (a.value === "charging") return { ...s, connector: "charging", running: true };
      return { ...s, connector: "finishing", running: true };
    }
    case "setEligible":
      return { ...s, eligible: a.value };
    case "setInRange":
      return { ...s, inRange: a.value };
    case "setSpeed":
      return { ...s, speed: a.value };
    case "toggleRun":
      return { ...s, running: !s.running };
    case "reset":
      return initialSim();
    case "jump": {
      const at = a.sec;
      if (at < 0) return { ...initialSim(), idleSec: at };
      const log = [{ kind: "system", label: "Please remove your charger", time: stamp(0) }];
      let st = { ...initialSim(), idleSec: at, connector: "finishing", running: true };
      if (at >= T_SYS_NUDGE) { st.sysNudged = true; st.lastMsgSec = T_SYS_NUDGE; log.push({ kind: "system", label: "Please remove your charger", time: stamp(T_SYS_NUDGE) }); }
      st.log = log;
      return st;
    }
    default:
      return s;
  }
}

// stamp idle seconds onto the 9:36-finish baseline clock (negative = during charging)
function stamp(idleSec) {
  const total = 9 * 60 + 36 + Math.round(idleSec / 60);
  let h = Math.floor(total / 60), m = total % 60;
  const ap = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

// ── Timeline scrubber + controls ─────────────────────────────
function TimelineControl({ sim, dispatch, light }) {
  const ink = light ? "rgba(0,0,0,0.55)" : K.text3;
  const inkActive = light ? "#1A1A1C" : K.text2;
  const btnBase = light
    ? { border: "1px solid rgba(0,0,0,0.15)", background: "rgba(255,255,255,0.5)", color: "#1A1A1C" }
    : { border: `1px solid ${K.divider}`, background: K.card, color: K.text2 };
  const btnActive = { border: `1px solid ${K.purpleEdge}`, background: K.purpleBg, color: K.purple };
  const scrubVal = sim.connector === "available"
    ? SCRUB_MAX
    : Math.max(SCRUB_MIN, Math.min(SCRUB_MAX, Math.round(sim.idleSec)));
  const pct = (scrubVal - SCRUB_MIN) / (SCRUB_MAX - SCRUB_MIN) * 100;

  // which phase label to show
  const phaseLabel =
    sim.connector === "charging"   ? `Charging · ${mmss(-sim.idleSec)} left`
    : sim.connector === "available" ? "Bay free"
    : sim.connector === "offline"   ? "Charger offline"
    : sim.idleSec < T_SYS_NUDGE    ? `T+${mmss(sim.idleSec)} · Remove connector`
    : sim.idleSec < T_WAIT_OPEN    ? `T+${mmss(sim.idleSec)} · Reminder sent`
    : sim.idleSec < T_SUPPORT      ? `T+${mmss(sim.idleSec)} · Nudge open`
    :                                `T+${mmss(sim.idleSec)} · Support ready`;

  const disabled = sim.connector === "available";

  return (
    <div>
      <Label light={light}>Timeline</Label>

      {/* Phase readout */}
      <div style={{ fontSize: 12, fontWeight: 600, color: K.purple, marginBottom: 10, fontVariantNumeric: "tabular-nums", minHeight: 16 }}>
        {phaseLabel}
      </div>

      {/* Scrubber */}
      <div style={{ position: "relative", height: 40, marginBottom: 4 }}>
        {/* Track */}
        <div style={{ position: "absolute", top: "40%", left: 0, right: 0, height: 5, transform: "translateY(-50%)", background: K.cardLight, borderRadius: 99 }}>
          {/* Fill */}
          <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: "100%", background: "linear-gradient(to right, #4D9FFF, #A77BFF)", borderRadius: 99, transition: "width 0.12s linear" }} />
          {/* Milestone ticks */}
          {MILESTONES.map((m) => {
            const mp = (m.sec - SCRUB_MIN) / (SCRUB_MAX - SCRUB_MIN) * 100;
            const past = scrubVal >= m.sec;
            return (
              <div key={m.sec} onClick={() => dispatch({ type: "jump", sec: m.sec })}
                style={{ position: "absolute", left: `${mp}%`, top: "50%", transform: "translate(-50%, -50%)", cursor: "pointer", zIndex: 2 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: past ? "#A77BFF" : K.cardLight, border: `2px solid ${past ? "#E8E0D0" : K.divider}`, transition: "background 0.2s" }} />
              </div>
            );
          })}
        </div>
        {/* Thumb */}
        {!disabled && (
          <div style={{ position: "absolute", top: "40%", left: `${pct}%`, transform: "translate(-50%, -50%)", width: 18, height: 18, borderRadius: 999, background: K.purple, border: "2.5px solid #E8E0D0", boxShadow: "0 0 0 3px rgba(167,123,255,0.3)", pointerEvents: "none", transition: "left 0.12s linear", zIndex: 3 }} />
        )}
        {/* Native input (invisible, handles drag) */}
        <input type="range" min={SCRUB_MIN} max={SCRUB_MAX} step={5}
          value={scrubVal}
          disabled={disabled}
          onChange={(e) => dispatch({ type: "jump", sec: parseInt(e.target.value) })}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: disabled ? "default" : "pointer", width: "100%", height: "100%", zIndex: 4 }}
        />
      </div>

      {/* Milestone labels row */}
      <div style={{ position: "relative", height: 18, marginBottom: 14 }}>
        {MILESTONES.map((m, i) => {
          const mp = (m.sec - SCRUB_MIN) / (SCRUB_MAX - SCRUB_MIN) * 100;
          const past = scrubVal >= m.sec;
          // first label left-align, last right-align, others center
          const transform = i === 0 ? "none" : i === MILESTONES.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
          return (
            <span key={m.sec} onClick={() => dispatch({ type: "jump", sec: m.sec })}
              style={{ position: "absolute", left: `${mp}%`, transform, fontSize: 9, fontWeight: 600, color: past ? inkActive : ink, cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.2s" }}>
              {m.short}
            </span>
          );
        })}
      </div>

      {/* Milestone description pills */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        {MILESTONES.map((m, i) => {
          const nextSec = MILESTONES[i + 1]?.sec ?? Infinity;
          const active = m.sec < 0
            ? sim.connector === "charging"
            : sim.connector === "finishing" && scrubVal >= m.sec && scrubVal < nextSec;
          return (
            <button key={m.sec} onClick={() => dispatch({ type: "jump", sec: m.sec })}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 9, border: `1px solid ${active ? K.purpleEdge : (light ? "rgba(0,0,0,0.12)" : K.divider)}`, background: active ? K.purpleBg : "transparent", color: active ? K.purple : ink, cursor: "pointer", fontFamily: K.font, fontSize: 11, fontWeight: 600, transition: "all 0.15s" }}>
              <span>{m.label}</span>
              <span style={{ fontWeight: 400, opacity: 0.75 }}>{m.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Playback controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => dispatch({ type: "toggleRun" })} style={{ ...(sim.running ? btnActive : btnBase), flex: 1, padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontFamily: K.font, fontSize: 13 }}>{sim.running ? "❚❚" : "▶"}</button>
        <button onClick={() => dispatch({ type: "reset" })} style={{ ...btnBase, padding: "9px 12px", borderRadius: 10, cursor: "pointer", fontFamily: K.font, fontSize: 13 }}>↺</button>
        <div style={{ flex: 1 }} />
        {/* Speed picker */}
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => dispatch({ type: "setSpeed", value: s })}
            style={{ padding: "6px 7px", borderRadius: 8, border: `1px solid ${sim.speed === s ? K.purpleEdge : (light ? "rgba(0,0,0,0.12)" : K.divider)}`, background: sim.speed === s ? K.purpleBg : "transparent", color: sim.speed === s ? K.purple : ink, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: K.font }}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  APP — device + role switch + control rail
// ═════════════════════════════════════════════════════════════
const SCRUB_MIN = -CHARGE_DURATION; // -60
const SCRUB_MAX = 1440;             // T+24 min — enough headroom past support
const MILESTONES = [
  { sec: -CHARGE_DURATION, label: "Charging",  short: "⚡",   desc: "In progress" },
  { sec: 0,                label: "T · Stop",  short: "T",    desc: "Remove connector" },
  { sec: T_SYS_NUDGE,      label: "+5 Remind", short: "+5",   desc: "Auto-reminder sent" },
  { sec: T_WAIT_OPEN,      label: "+10 Nudge", short: "+10",  desc: "Waiting can nudge" },
  { sec: T_SUPPORT,        label: "+20 Supp",  short: "+20",  desc: "Contact support" },
];
const SPEEDS = [1, 4, 8, 16, 32];
const CONNECTORS = [
  { id: "charging", label: "Charging" },
  { id: "finishing", label: "Finishing" },
  { id: "available", label: "Available" },
  { id: "offline", label: "Offline" },
];

export default function App() {
  const [sim, dispatch] = React.useReducer(simReducer, undefined, initialSim);
  const raf = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    let live = true;
    const loop = (t) => {
      if (!live) return;
      const real = (t - last.current) / 1000;
      last.current = t;
      if (sim.running && real > 0) dispatch({ type: "tick", dt: real * sim.speed });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { live = false; cancelAnimationFrame(raf.current); };
  }, [sim.running, sim.speed]);

  const can = canWaitingNudge(sim);
  const sessionStatus =
    sim.connector === "charging" ? { tone: "blue", label: "Charging" }
    : sim.connector === "available" ? { tone: "green", label: "Bay free" }
    : sim.connector === "offline" ? { tone: "grey", label: "Charger offline" }
    : sim.supportCalled ? { tone: "red", label: "Support called" }
    : sim.idleSec >= T_WAIT_OPEN ? { tone: "amber", label: "Nudge open" }
    : { tone: "amber", label: "Grace period" };

  return (
    <div style={{ minHeight: "100vh", background: "#E8E0D0", fontFamily: K.font }}>
      {/* ── control rail — fixed glassmorphic sidebar ── */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 256, padding: "24px 18px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", background: "rgba(232,224,208,0.35)", backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", borderRight: "1px solid rgba(255,255,255,0.5)", boxShadow: "4px 0 32px rgba(0,0,0,0.06)", zIndex: 100 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: K.purple, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.zap("#fff")}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1C", letterSpacing: -0.3 }}>Idle Nudge</div>
          </div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", lineHeight: 1.5 }}>Kazam · OCPP 1.6J pilot</div>
        </div>

        {/* charger signal */}
        <div>
          <Label light>Charger signal</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CONNECTORS.map((cn) => (
              <button key={cn.id} onClick={() => dispatch({ type: "setConnector", value: cn.id })} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${sim.connector === cn.id ? K.purpleEdge : "rgba(0,0,0,0.15)"}`, cursor: "pointer", background: sim.connector === cn.id ? K.purpleBg : "rgba(255,255,255,0.5)", color: sim.connector === cn.id ? K.purple : "#1A1A1C", fontFamily: K.font, fontSize: 13, fontWeight: 600, textAlign: "left" }}>{cn.label}</button>
            ))}
          </div>
          <button
            onClick={() => dispatch({ type: "setConnector", value: "available" })}
            disabled={sim.connector === "available"}
            style={{ marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(232,75,75,0.35)", cursor: sim.connector === "available" ? "default" : "pointer", background: sim.connector === "available" ? K.card : "rgba(232,75,75,0.12)", color: sim.connector === "available" ? K.text3 : "#E84B4B", fontFamily: K.font, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: sim.connector === "available" ? 0.5 : 1 }}
          >
            {Ico.zapOutline("#E84B4B", 15)} Simulate gun removal
          </button>
        </div>

        {/* timeline */}
        <TimelineControl sim={sim} dispatch={dispatch} light />
      </div>

      {/* ── phones side by side ── */}
      <div style={{ marginLeft: 256, minHeight: "100vh", display: "flex", gap: 24, alignItems: "center", justifyContent: "center", padding: "24px 32px" }}>
        {[
          { label: "Waiting driver",   child: <WaitingDriver sim={sim} dispatch={dispatch} /> },
          { label: "Occupying driver", child: <OccupyingDriver sim={sim} dispatch={dispatch} /> },
        ].map(({ label, child }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {/* Scale wrapper: native 390×800 scaled to ~308×632 */}
            <div style={{ width: 390 * 0.79, height: 800 * 0.79, flex: "0 0 auto", overflow: "hidden", borderRadius: 46 * 0.79 }}>
              <div style={{ transform: "scale(0.79)", transformOrigin: "top left", width: 390, height: 800 }}>
                <IOSDevice>{child}</IOSDevice>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#5A5248", letterSpacing: 0.2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const Label = ({ children, nomargin, light }) => (
  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: light ? "rgba(0,0,0,0.38)" : K.text3, marginBottom: nomargin ? 0 : 8 }}>{children}</div>
);
const Stat = ({ label, value, accent }) => (
  <div>
    <div style={{ fontSize: 11, color: K.text3, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: accent || K.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
  </div>
);
const Toggle = ({ label, on, onClick, icon }) => (
  <button onClick={onClick} style={{ flex: 1, padding: "11px 10px", borderRadius: 12, border: `1px solid ${on ? K.purpleEdge : K.divider}`, background: on ? K.purpleBg : K.card, color: on ? K.purple : K.text3, fontFamily: K.font, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
    {icon(on ? K.purple : K.text3, 14)}
    <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: 11, opacity: 0.8 }}>{on ? "On" : "Off"}</span>
  </button>
);
const ctrlBtn = (active) => ({
  flex: 1, padding: "9px 6px", borderRadius: 10,
  border: `1px solid ${active ? K.purpleEdge : K.divider}`,
  background: active ? K.purpleBg : K.card,
  color: active ? K.purple : K.text2,
  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: K.font,
});
