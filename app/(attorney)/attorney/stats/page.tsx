"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DocStarField } from "@/components/attorney/DocStarField";
import { Search, FileSearch, FileText, Scissors, Languages, BookOpen, CalendarClock, Lock, LogIn, LockOpen } from "lucide-react";

const TOOLS = [
  { key: "RESEARCH",  label: "Research",    icon: Search,       color: "#7eb8f7" },
  { key: "REVIEW",    label: "Review",      icon: FileSearch,   color: "#6bc98a" },
  { key: "DRAFT",     label: "Draft",       icon: FileText,     color: "#c9a84c" },
  { key: "REDLINE",   label: "Redline",     icon: Scissors,     color: "#e0906a" },
  { key: "TRANSLATE", label: "Translate",   icon: Languages,    color: "#b07aef" },
  { key: "CLAUSES",   label: "Clauses",     icon: BookOpen,     color: "#5fc8b8" },
  { key: "DEADLINES", label: "Deadlines",   icon: CalendarClock,color: "#e07aaa" },
] as const;

const ENCLAVE_TOOLS = new Set(["REVIEW", "REDLINE", "DRAFT", "TRANSLATE", "DEADLINES", "CLAUSES"]);

interface LoginEvent {
  loggedAt: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  ip?: string;
}

interface LockEvent {
  type: "LOCKED" | "UNLOCKED";
  trigger: "MANUAL" | "AUTO";
  createdAt: string;
}

interface StatsData {
  toolCounts: Record<string, number>;
  daily: { date: string; count: number }[];
  enclaveCount: number;
  totalCount: number;
  loginEvents: LoginEvent[];
  lockEvents: LockEvent[];
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function countryFlag(code: string): string {
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

function locationString(e: LoginEvent): { flag: string; text: string } {
  const flag = e.countryCode ? countryFlag(e.countryCode) : "";
  const parts = [e.city, e.country].filter(Boolean);
  const text = parts.length > 0 ? parts.join(", ") : (e.ip ?? "Unknown location");
  return { flag, text };
}

function StatCard({ label, value, sub, isLight }: { label: string; value: string | number; sub?: string; isLight: boolean }) {
  return (
    <div style={{
      padding: "18px 22px", borderRadius: "14px",
      background: isLight ? "rgba(238,233,222,0.92)" : "rgba(4,8,20,0.7)",
      border: `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.07)"}`,
    }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: isLight ? "rgba(50,60,84,0.55)" : "rgba(255,255,255,0.85)", fontFamily: "var(--font-dm-sans)", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "34px", fontWeight: 300, color: isLight ? "#6b500e" : "#e8d5a0", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "10px", color: isLight ? "rgba(50,60,84,0.45)" : "rgba(255,255,255,0.7)", fontFamily: "var(--font-dm-sans)", marginTop: "5px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, isLight }: { children: React.ReactNode; isLight: boolean }) {
  return (
    <div style={{ fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: isLight ? "rgba(50,60,84,0.5)" : "rgba(255,255,255,0.85)", fontFamily: "var(--font-dm-sans)", marginBottom: "14px" }}>
      {children}
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(localStorage.getItem("attorney-light-mode") === "true");
    const handler = (e: Event) => setIsLight((e as CustomEvent<{ light: boolean }>).detail.light);
    window.addEventListener("attorney-theme-change", handler);
    return () => window.removeEventListener("attorney-theme-change", handler);
  }, []);

  useEffect(() => {
    fetch("/api/attorney/stats", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const total = data?.totalCount ?? 0;
  const mostUsed = data
    ? (Object.entries(data.toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—")
    : "—";
  const mostUsedLabel = TOOLS.find((t) => t.key === mostUsed)?.label ?? mostUsed;

  const chartGold = isLight ? "#9a6e10" : "#c9a84c";
  const tooltipBg = isLight ? "#f0ece2" : "#0c1628";
  const tooltipBorder = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const tooltipText = isLight ? "rgba(28,34,52,0.9)" : "#d4dcea";

  return (
    <div className="flex flex-col h-full" style={{ background: isLight ? "#fafaf7" : "#060d1a", position: "relative" }}>
      <DocStarField />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, padding: "20px 32px 16px", borderBottom: `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}`, flexShrink: 0 }}>
        <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "22px", fontWeight: 300, color: isLight ? "#6b500e" : "#e8d5a0", letterSpacing: "0.04em" }}>
          Your Activity
        </h1>
        <p style={{ fontSize: "11px", color: isLight ? "rgba(50,60,84,0.6)" : "#ffffff", marginTop: "2px", fontFamily: "var(--font-dm-sans)" }}>
          Session history across all Mizan tools
        </p>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 1, padding: "28px 32px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent", display: "flex", flexDirection: "column" }}>
        <div style={{ maxWidth: "900px", margin: "auto", width: "100%", padding: "28px 0" }}>

          {!data ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontFamily: "var(--font-cormorant)", fontSize: "17px", fontWeight: 300, color: isLight ? "rgba(40,55,80,0.45)" : "rgba(200,210,230,0.4)" }}>
                Loading…
              </p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "36px" }}>
                <StatCard label="Total Sessions" value={total} isLight={isLight} />
                <StatCard label="Enclave Invocations" value={data.enclaveCount} sub="Review · Draft · Redline · Translate · Deadlines · Playbook" isLight={isLight} />
                <StatCard label="Most Used Tool" value={total > 0 ? mostUsedLabel : "—"} isLight={isLight} />
              </div>

              {/* Per-tool cards */}
              <SectionLabel isLight={isLight}>Tool Breakdown</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px", marginBottom: "36px" }}>
                {TOOLS.map(({ key, label, icon: Icon, color }) => {
                  const count = data.toolCounts[key] ?? 0;
                  const pct = total > 0 ? count / total : 0;
                  const isEnclave = ENCLAVE_TOOLS.has(key);
                  return (
                    <div
                      key={key}
                      style={{
                        padding: "14px 16px", borderRadius: "12px",
                        background: isLight ? "rgba(238,233,222,0.92)" : "rgba(4,8,20,0.7)",
                        border: `1px solid ${isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <Icon size={14} style={{ color }} />
                        {isEnclave && (
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}
                            onMouseEnter={(e) => { const t = e.currentTarget.querySelector(".enclave-tip") as HTMLElement; if (t) t.style.opacity = "1"; }}
                            onMouseLeave={(e) => { const t = e.currentTarget.querySelector(".enclave-tip") as HTMLElement; if (t) t.style.opacity = "0"; }}
                          >
                            <Lock size={11} style={{ color: isLight ? "rgba(122,84,16,0.7)" : "rgba(201,168,76,0.6)", cursor: "default" }} />
                            <div className="enclave-tip" style={{
                              position: "absolute", bottom: "calc(100% + 7px)", right: 0,
                              background: isLight ? "rgba(238,233,222,0.98)" : "rgba(6,13,26,0.97)",
                              border: `1px solid ${isLight ? "rgba(122,84,16,0.2)" : "rgba(201,168,76,0.2)"}`,
                              borderRadius: "8px", padding: "7px 10px",
                              fontSize: "10px", fontFamily: "var(--font-dm-sans)",
                              color: isLight ? "rgba(50,40,20,0.85)" : "rgba(201,168,76,0.85)",
                              whiteSpace: "nowrap", pointerEvents: "none",
                              opacity: 0, transition: "opacity 0.15s ease",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                              zIndex: 10,
                            }}>
                              This tool is processed in Mizan&apos;s Secure Enclave
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 300, color: isLight ? "#1c2034" : "#ffffff", lineHeight: 1, marginBottom: "4px" }}>
                        {count}
                      </div>
                      <div style={{ fontSize: "10px", color: isLight ? "rgba(50,60,84,0.6)" : "#ffffff", fontFamily: "var(--font-dm-sans)", marginBottom: "10px" }}>
                        {label}
                      </div>
                      {/* Mini proportion bar */}
                      <div style={{ height: "2px", borderRadius: "2px", background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)" }}>
                        <div style={{ height: "100%", width: `${pct * 100}%`, borderRadius: "2px", background: color, transition: "width 0.6s ease", minWidth: count > 0 ? "4px" : "0" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daily activity chart */}
              <SectionLabel isLight={isLight}>Daily Activity — Last 30 Days</SectionLabel>
              <div style={{
                padding: "20px 20px 10px", borderRadius: "14px",
                background: isLight ? "rgba(238,233,222,0.92)" : "rgba(4,8,20,0.7)",
                border: `1px solid ${isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.06)"}`,
                marginBottom: "36px",
              }}>
                {data.daily.every((d) => d.count === 0) ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: isLight ? "rgba(50,60,84,0.35)" : "rgba(140,160,190,0.3)", fontFamily: "var(--font-cormorant)", fontSize: "15px", fontWeight: 300 }}>
                    No sessions in the last 30 days
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.daily} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: isLight ? "rgba(50,60,84,0.45)" : "rgba(140,160,190,0.4)", fontFamily: "var(--font-dm-sans)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + "T00:00:00");
                          return d.getDate() === 1 || d.getDate() % 7 === 1 ? formatDate(v) : "";
                        }}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 9, fill: isLight ? "rgba(50,60,84,0.45)" : "rgba(140,160,190,0.4)", fontFamily: "var(--font-dm-sans)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)" }}
                        contentStyle={{
                          background: tooltipBg,
                          border: `1px solid ${tooltipBorder}`,
                          borderRadius: "8px",
                          padding: "7px 12px",
                          fontSize: "11px",
                          fontFamily: "var(--font-dm-sans)",
                          color: tooltipText,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                        }}
                        labelFormatter={(v: string) => formatDate(v)}
                        formatter={(v: number) => [v, "sessions"]}
                      />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {data.daily.map((entry, i) => (
                          <Cell key={i} fill={entry.count > 0 ? chartGold : (isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.04)")} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Tool usage over time — stacked breakdown bar */}
              {total > 0 && (
                <>
                  <SectionLabel isLight={isLight}>Session Distribution</SectionLabel>
                  <div style={{
                    padding: "18px 20px", borderRadius: "14px",
                    background: isLight ? "rgba(238,233,222,0.92)" : "rgba(4,8,20,0.7)",
                    border: `1px solid ${isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.06)"}`,
                    marginBottom: "36px",
                  }}>
                    {/* Segmented bar */}
                    <div style={{ display: "flex", height: "10px", borderRadius: "6px", overflow: "hidden", marginBottom: "16px" }}>
                      {TOOLS.filter(({ key }) => (data.toolCounts[key] ?? 0) > 0).map(({ key, color }) => (
                        <div
                          key={key}
                          style={{
                            height: "100%",
                            width: `${((data.toolCounts[key] ?? 0) / total) * 100}%`,
                            background: color,
                            transition: "width 0.6s ease",
                          }}
                        />
                      ))}
                    </div>
                    {/* Legend */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                      {TOOLS.filter(({ key }) => (data.toolCounts[key] ?? 0) > 0).map(({ key, label, color }) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: "10px", color: isLight ? "rgba(40,55,80,0.65)" : "#ffffff", fontFamily: "var(--font-dm-sans)" }}>
                            {label} · {Math.round(((data.toolCounts[key] ?? 0) / total) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Security Log — logins + lock/unlock events merged */}
              {(() => {
                type LogEntry =
                  | { kind: "login"; ts: number; ev: LoginEvent }
                  | { kind: "lock"; ts: number; ev: LockEvent };

                const entries: LogEntry[] = [
                  ...(data.loginEvents ?? []).map(ev => ({ kind: "login" as const, ts: new Date(ev.loggedAt).getTime(), ev })),
                  ...(data.lockEvents ?? []).map(ev => ({ kind: "lock" as const, ts: new Date(ev.createdAt).getTime(), ev })),
                ].sort((a, b) => b.ts - a.ts).slice(0, 60);

                const dividerColor = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";

                return (
                  <>
                    <SectionLabel isLight={isLight}>Security Log</SectionLabel>
                    <div style={{
                      borderRadius: "14px",
                      background: isLight ? "rgba(238,233,222,0.92)" : "rgba(4,8,20,0.7)",
                      border: `1px solid ${isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.06)"}`,
                      overflow: "hidden",
                      marginBottom: "40px",
                    }}>
                      {entries.length === 0 ? (
                        <div style={{ padding: "32px 20px", textAlign: "center", color: isLight ? "rgba(50,60,84,0.35)" : "rgba(140,160,190,0.3)", fontFamily: "var(--font-cormorant)", fontSize: "15px", fontWeight: 300 }}>
                          No security events recorded
                        </div>
                      ) : entries.map((entry, i) => {
                        const isLast = i === entries.length - 1;
                        if (entry.kind === "login") {
                          const { flag, text } = locationString(entry.ev);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: isLast ? "none" : `1px solid ${dividerColor}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <LogIn size={11} style={{ color: isLight ? "rgba(50,100,80,0.5)" : "rgba(74,197,110,0.5)", flexShrink: 0 }} />
                                {flag && <span style={{ fontSize: "14px", lineHeight: 1, flexShrink: 0 }}>{flag}</span>}
                                <div>
                                  <span style={{ fontSize: "11px", color: isLight ? "rgba(28,34,52,0.75)" : "#ffffff", fontFamily: "var(--font-dm-sans)" }}>{text}</span>
                                  <span style={{ fontSize: "9px", color: isLight ? "rgba(50,60,84,0.4)" : "rgba(140,160,190,0.35)", fontFamily: "var(--font-dm-sans)", marginLeft: "8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Login</span>
                                </div>
                              </div>
                              <span style={{ fontSize: "10px", color: isLight ? "rgba(50,60,84,0.4)" : "rgba(140,160,190,0.35)", fontFamily: "var(--font-dm-sans)", flexShrink: 0, marginLeft: "16px" }}>{relativeTime(entry.ev.loggedAt)}</span>
                            </div>
                          );
                        } else {
                          const locked = entry.ev.type === "LOCKED";
                          const Icon = locked ? Lock : LockOpen;
                          const iconColor = locked
                            ? (isLight ? "rgba(180,80,50,0.55)" : "rgba(220,120,80,0.55)")
                            : (isLight ? "rgba(50,100,80,0.5)" : "rgba(74,197,110,0.45)");
                          const label = locked
                            ? (entry.ev.trigger === "AUTO" ? "Auto-locked" : "Locked")
                            : "Unlocked";
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: isLast ? "none" : `1px solid ${dividerColor}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <Icon size={11} style={{ color: iconColor, flexShrink: 0 }} />
                                <span style={{ fontSize: "11px", color: isLight ? "rgba(28,34,52,0.75)" : "#ffffff", fontFamily: "var(--font-dm-sans)" }}>{label}</span>
                              </div>
                              <span style={{ fontSize: "10px", color: isLight ? "rgba(50,60,84,0.4)" : "rgba(140,160,190,0.35)", fontFamily: "var(--font-dm-sans)", flexShrink: 0, marginLeft: "16px" }}>{relativeTime(entry.ev.createdAt)}</span>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
