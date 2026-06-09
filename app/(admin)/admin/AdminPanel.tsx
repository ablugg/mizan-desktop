"use client";

import { useState } from "react";
import { AttorneyApplication } from "@/types";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Zap, Lock, RefreshCw } from "lucide-react";

type AppWithUser = AttorneyApplication & { user?: { id: string; email: string; role: string } | null };

const STATUS_STYLES = {
  PENDING: { color: "#d4a84c", bg: "rgba(212,168,76,0.1)", border: "rgba(212,168,76,0.25)", Icon: Clock },
  APPROVED: { color: "#6bc98a", bg: "rgba(107,201,138,0.08)", border: "rgba(107,201,138,0.22)", Icon: CheckCircle },
  REJECTED: { color: "#e07070", bg: "rgba(224,112,112,0.08)", border: "rgba(224,112,112,0.2)", Icon: XCircle },
};

export default function AdminPanel({ applications, totalEnclaveCount, totalSessions }: { applications: AppWithUser[]; totalEnclaveCount: number; totalSessions: number }) {
  const [apps, setApps] = useState<AppWithUser[]>(applications);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [activating, setActivating] = useState(false);
  const [activateStatus, setActivateStatus] = useState<"idle" | "ok" | "error">("idle");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "ok" | "error">("idle");

  async function activateEnclave() {
    setActivating(true);
    setActivateStatus("idle");
    try {
      const res = await fetch("/api/enclave/activate", { method: "POST", credentials: "include" });
      setActivateStatus(res.ok ? "ok" : "error");
    } catch {
      setActivateStatus("error");
    } finally {
      setActivating(false);
    }
  }

  async function syncLaws() {
    setSyncing(true);
    setSyncStatus("idle");
    try {
      const res = await fetch("/api/admin/sync-laws", { method: "POST", credentials: "include" });
      setSyncStatus(res.ok ? "ok" : "error");
    } catch {
      setSyncStatus("error");
    } finally {
      setSyncing(false);
    }
  }

  async function action(id: string, act: "approve" | "reject") {
    setLoading(id + act);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setApps((prev) => prev.map((a) => a.id === id ? { ...a, status: data.application.status } : a));
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  }

  const filtered = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);
  const counts = {
    ALL: apps.length,
    PENDING: apps.filter((a) => a.status === "PENDING").length,
    APPROVED: apps.filter((a) => a.status === "APPROVED").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(74,197,110,0.55)", marginBottom: "6px" }}>
            Mizan · Admin
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "30px", fontWeight: 300, color: "#e8d5a0", letterSpacing: "0.04em" }}>
            Attorney Applications
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "4px" }}>
          <button
            onClick={syncLaws}
            disabled={syncing}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "8px 16px", borderRadius: "8px", fontSize: "12px",
              fontFamily: "var(--font-dm-sans)", cursor: syncing ? "default" : "pointer",
              opacity: syncing ? 0.6 : 1, transition: "all 0.15s",
              background: syncStatus === "ok" ? "rgba(74,197,110,0.12)" : syncStatus === "error" ? "rgba(200,50,50,0.08)" : "rgba(100,140,220,0.08)",
              border: `1px solid ${syncStatus === "ok" ? "rgba(74,197,110,0.3)" : syncStatus === "error" ? "rgba(200,50,50,0.25)" : "rgba(100,140,220,0.25)"}`,
              color: syncStatus === "ok" ? "#6bc98a" : syncStatus === "error" ? "#e07070" : "#7eb8f7",
            }}
          >
            <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Rebuilding…" : syncStatus === "ok" ? "Sync Done" : syncStatus === "error" ? "Sync Failed" : "Sync Laws"}
          </button>
          <button
            onClick={activateEnclave}
            disabled={activating}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              padding: "8px 16px", borderRadius: "8px", fontSize: "12px",
              fontFamily: "var(--font-dm-sans)", cursor: activating ? "default" : "pointer",
              opacity: activating ? 0.6 : 1, transition: "all 0.15s",
              background: activateStatus === "ok" ? "rgba(74,197,110,0.12)" : activateStatus === "error" ? "rgba(200,50,50,0.08)" : "rgba(201,168,76,0.08)",
              border: `1px solid ${activateStatus === "ok" ? "rgba(74,197,110,0.3)" : activateStatus === "error" ? "rgba(200,50,50,0.25)" : "rgba(201,168,76,0.25)"}`,
              color: activateStatus === "ok" ? "#6bc98a" : activateStatus === "error" ? "#e07070" : "#d4a84c",
            }}
          >
            <Zap size={13} />
            {activating ? "Checking…" : activateStatus === "ok" ? "Service Active" : activateStatus === "error" ? "Check Failed" : "Check Service"}
          </button>
        </div>
      </div>

      {/* Platform stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "32px", maxWidth: "480px" }}>
        <div style={{ padding: "16px 20px", borderRadius: "12px", background: "rgba(74,197,110,0.06)", border: "1px solid rgba(74,197,110,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
            <Lock size={11} style={{ color: "rgba(74,197,110,0.7)" }} />
            <span style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(74,197,110,0.55)", fontFamily: "var(--font-dm-sans)" }}>
              Local AI Invocations
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "36px", fontWeight: 300, color: "#6bc98a", lineHeight: 1 }}>
            {totalEnclaveCount}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(74,197,110,0.45)", fontFamily: "var(--font-dm-sans)", marginTop: "4px" }}>
            across all accounts
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderRadius: "12px", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
            <span style={{ fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.55)", fontFamily: "var(--font-dm-sans)" }}>
              Total Sessions
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "36px", fontWeight: 300, color: "#e8d5a0", lineHeight: 1 }}>
            {totalSessions}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(201,168,76,0.4)", fontFamily: "var(--font-dm-sans)", marginTop: "4px" }}>
            all tools · all attorneys
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px", flexWrap: "wrap" }}>
        {(["PENDING", "ALL", "APPROVED", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: "11px", fontFamily: "var(--font-dm-sans)", cursor: "pointer", transition: "all 0.15s",
              background: filter === f ? "rgba(201,168,76,0.12)" : "transparent",
              border: `1px solid ${filter === f ? "rgba(201,168,76,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: filter === f ? "#d4a84c" : "rgba(180,195,220,0.55)",
            }}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Applications list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(180,190,210,0.4)", fontFamily: "var(--font-cormorant)", fontSize: "17px", fontWeight: 300 }}>
          No {filter === "ALL" ? "" : filter.toLowerCase()} applications
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((app) => {
            const s = STATUS_STYLES[app.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.PENDING;
            const isExpanded = expanded === app.id;

            return (
              <div key={app.id} style={{ borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : app.id)}
                  style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", cursor: "pointer" }}
                >
                  {/* Status dot */}
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />

                  {/* Name / email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "15px", color: "#e8d5a0", fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {app.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(180,190,210,0.5)", fontFamily: "var(--font-dm-sans)", marginTop: "1px" }}>
                      {app.email} · {app.jurisdiction}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", background: s.bg, border: `1px solid ${s.border}`, color: s.color, flexShrink: 0 }}>
                    {app.status}
                  </span>

                  {/* Date */}
                  <span style={{ fontSize: "10px", color: "rgba(140,155,180,0.45)", fontFamily: "var(--font-dm-sans)", flexShrink: 0, display: "none" }} className="md:inline">
                    {new Date(app.appliedAt).toLocaleDateString("en-GB")}
                  </span>

                  {isExpanded ? <ChevronUp size={14} style={{ color: "rgba(180,190,210,0.4)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "rgba(180,190,210,0.4)", flexShrink: 0 }} />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "18px 18px 18px 40px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "16px" }}>
                      <Detail label="Bar Number" value={app.barNumber} />
                      <Detail label="Jurisdiction" value={app.jurisdiction} />
                      <Detail label="Firm" value={app.firm || "—"} />
                      <Detail label="Applied" value={new Date(app.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} />
                    </div>

                    {app.specializations?.length > 0 && (
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(180,190,210,0.4)", fontFamily: "var(--font-dm-sans)", marginBottom: "8px" }}>Specialisations</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {app.specializations.map((spec) => (
                            <span key={spec} style={{ padding: "3px 10px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(200,210,230,0.65)", fontSize: "10px", fontFamily: "var(--font-dm-sans)" }}>
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {app.status === "PENDING" && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); action(app.id, "approve"); }}
                          disabled={!!loading}
                          style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(74,197,110,0.12)", border: "1px solid rgba(74,197,110,0.25)", color: "#6bc98a", fontSize: "12px", fontFamily: "var(--font-dm-sans)", cursor: loading ? "default" : "pointer", opacity: loading === app.id + "approve" ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); action(app.id, "reject"); }}
                          disabled={!!loading}
                          style={{ padding: "7px 18px", borderRadius: "8px", background: "rgba(200,50,50,0.08)", border: "1px solid rgba(200,50,50,0.2)", color: "#e07070", fontSize: "12px", fontFamily: "var(--font-dm-sans)", cursor: loading ? "default" : "pointer", opacity: loading === app.id + "reject" ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(180,190,210,0.4)", fontFamily: "var(--font-dm-sans)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "rgba(210,220,235,0.8)", fontFamily: "var(--font-dm-sans)" }}>{value}</div>
    </div>
  );
}
