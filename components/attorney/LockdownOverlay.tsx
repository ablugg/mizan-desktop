"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useMemo } from "react";
import { Lock } from "lucide-react";

interface Props {
  trigger: "MANUAL" | "AUTO";
  onUnlock: () => void;
  isLight: boolean;
}

function useStarfield() {
  const stars = useMemo(() => Array.from({ length: 450 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 0.4 + Math.random() * 1.4,
    opacity: 0.15 + Math.random() * 0.85,
    // ~25% twinkle — reduces concurrent opacity animations without visible quality loss
    twinkle: Math.random() > 0.75,
    // Bucketed into 4 durations so the browser reuses animation instances
    twinkleDur: [2, 3, 4.5, 6][Math.floor(Math.random() * 4)],
    twinkleDelay: Math.random() * 10,
  })), []);

  const shooters = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const angle = 8 + Math.random() * 52;
    const dist = 500 + Math.random() * 600;
    const totalDur = 40 + Math.random() * 45;
    const shootDur = 5 + Math.random() * 6;
    const shootPct = (shootDur / totalDur) * 100;
    return {
      id: i,
      startX: -8 + Math.random() * 85,
      startY: -8 + Math.random() * 60,
      dist,
      tailLen: 90 + Math.random() * 160,
      angle,
      totalDur,
      shootPct,
      delay: Math.random() * 35,
    };
  }), []);

  const css = useMemo(() => {
    const twinkle = `@keyframes lk-twinkle{0%,100%{opacity:1}50%{opacity:0}}`;
    // Shoot immediately — no hold at origin, just travel and fade out
    const shoots = shooters.map(s => `
      @keyframes lk-shoot${s.id}{
        0%{opacity:0.9;transform:rotate(${s.angle}deg) translate(0,0)}
        ${s.shootPct.toFixed(2)}%{opacity:0;transform:rotate(${s.angle}deg) translate(${s.dist.toFixed(1)}px,0)}
        100%{opacity:0;transform:rotate(${s.angle}deg) translate(${s.dist.toFixed(1)}px,0)}
      }
    `).join("");
    return twinkle + shoots;
  }, [shooters]);

  return { stars, shooters, css };
}

export function LockdownOverlay({ trigger, onUnlock, isLight }: Props) {
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { stars, shooters, css } = useStarfield();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const logUnlock = () => {
    fetch("/api/attorney/lock-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "UNLOCKED", trigger: "MANUAL" }),
      credentials: "include",
    }).catch(() => {});
  };

  const post = async (path: string, body: Record<string, string>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    return res.json() as Promise<{ ok: boolean; error?: string }>;
  };

  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await post("/api/attorney/unlock/password", { password });
      if (data.ok) { logUnlock(); onUnlock(); }
      else setError(data.error ?? "Incorrect password.");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: "10px",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${error ? "rgba(210,70,70,0.5)" : "rgba(255,255,255,0.12)"}`,
    color: "#d4dcea", fontFamily: "var(--font-dm-sans)", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
    marginBottom: error ? "8px" : "12px",
  };

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    width: "100%", padding: "12px", borderRadius: "10px", border: "none",
    background: disabled ? "rgba(255,255,255,0.06)" : "rgba(201,168,76,0.85)",
    color: disabled ? "rgba(140,160,190,0.35)" : "#1a1200",
    fontFamily: "var(--font-dm-sans)", fontSize: "12px", fontWeight: 500,
    letterSpacing: "0.08em", cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s",
  });

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#030810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>

      {/* Injected keyframes */}
      <style>{css}</style>

      {/* Star layer — behind content, isolated paint layer for GPU compositing */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none", contain: "strict" }}>
        {/* Static + twinkling stars */}
        {stars.map(s => (
          <div
            key={s.id}
            style={{
              position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
              width: `${s.size}px`, height: `${s.size}px`, borderRadius: "50%",
              background: "white", opacity: s.opacity,
              // Only add will-change on elements that actually animate
              ...(s.twinkle ? {
                animation: `lk-twinkle ${s.twinkleDur}s ease-in-out ${s.twinkleDelay}s infinite`,
                willChange: "opacity",
              } : {}),
            }}
          />
        ))}

        {/* Shooting stars — GPU-composited, shoot immediately */}
        {shooters.map(s => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.startX}%`,
              top: `${s.startY}%`,
              display: "flex",
              alignItems: "center",
              animation: `lk-shoot${s.id} ${s.totalDur}s linear ${s.delay}s infinite`,
              opacity: 0,
              willChange: "transform, opacity",
              transform: "translateZ(0)",   // promote to own GPU layer
            }}
          >
            {/* Trail — bright at head, dissolves behind */}
            <div style={{
              width: `${s.tailLen}px`,
              height: "2px",
              background: "linear-gradient(to right, transparent 0%, rgba(201,168,76,0.04) 35%, rgba(201,168,76,0.28) 65%, rgba(255,235,130,0.8) 90%, rgba(255,248,200,0.95) 100%)",
              borderRadius: "0 1px 1px 0",
            }} />
            {/* Head — small gold circle with soft glow */}
            <div style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "radial-gradient(circle, #fffbe0 0%, #ffd04d 60%, rgba(201,168,76,0) 100%)",
              boxShadow: "0 0 5px 2px rgba(201,168,76,0.85), 0 0 10px 4px rgba(201,168,76,0.3)",
              flexShrink: 0,
            }} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Lock icon */}
        <div style={{ width: "60px", height: "60px", borderRadius: "18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "28px", boxShadow: "0 0 40px rgba(201,168,76,0.08)" }}>
          <Lock size={24} style={{ color: "#c9a84c" }} />
        </div>

        <h2 style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 300, color: "#e8d5a0", marginBottom: "8px", letterSpacing: "0.04em" }}>
          Mizan is locked
        </h2>
        <p style={{ fontSize: "12px", color: "rgba(140,160,190,0.65)", fontFamily: "var(--font-dm-sans)", marginBottom: "8px", textAlign: "center", maxWidth: "280px" }}>
          {trigger === "AUTO" ? "Locked due to inactivity. " : ""}Enter your PIN to resume.
        </p>

        <div style={{ width: "100%", maxWidth: "300px", marginTop: "24px" }}>
          <form onSubmit={handlePasswordUnlock}>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} placeholder="PIN" autoFocus style={inputStyle} />
            {error && <p style={{ fontSize: "11px", color: "rgba(210,70,70,0.85)", fontFamily: "var(--font-dm-sans)", marginBottom: "10px" }}>{error}</p>}
            <button type="submit" disabled={loading || !password} style={primaryBtn(loading || !password)}>
              {loading ? "Verifying..." : "Unlock"}
            </button>
          </form>
        </div>

        {/* Sign-out failsafe */}
        <button
          onClick={() => {
            localStorage.removeItem("attorney-locked");
            localStorage.removeItem("attorney-lock-trigger");
            localStorage.removeItem("mizan-signed-in");
          }}
          style={{ marginTop: "32px", background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-dm-sans)", fontSize: "10px", letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase", transition: "color 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
        >
          Clear lock and return
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
