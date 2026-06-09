"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface Props {
  isLight: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LockdownConfirm({ isLight, onConfirm, onCancel }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const bg = isLight ? "rgba(250,250,247,0.92)" : "rgba(4,8,20,0.88)";
  const cardBg = isLight ? "rgba(238,233,222,0.96)" : "rgba(8,14,30,0.98)";
  const cardBorder = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.07)";
  const sub = isLight ? "rgba(50,60,84,0.65)" : "rgba(160,175,200,0.6)";

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: bg, backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onCancel}
    >
      <div
        style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "22px", padding: "52px 48px", maxWidth: "480px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontFamily: "var(--font-cormorant)", fontSize: "38px", fontWeight: 400, color: isLight ? "rgba(180,30,30,0.85)" : "rgba(220,70,60,0.9)", letterSpacing: "0.06em", margin: "0 0 18px", textTransform: "uppercase" }}>
          Are you sure?
        </p>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: sub, lineHeight: 1.8, margin: "0 0 36px" }}>
          This will trigger Mizan&rsquo;s lockdown mode. You will need to verify your identity to resume your session.
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "14px", borderRadius: "10px", border: `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)"}`, background: "transparent", color: sub, fontFamily: "var(--font-dm-sans)", fontSize: "12px", letterSpacing: "0.06em", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "14px", borderRadius: "10px", border: "1px solid rgba(200,50,40,0.35)", background: isLight ? "rgba(200,50,40,0.08)" : "rgba(200,50,40,0.12)", color: isLight ? "rgba(180,30,30,0.85)" : "rgba(230,80,70,0.9)", fontFamily: "var(--font-dm-sans)", fontSize: "12px", letterSpacing: "0.06em", cursor: "pointer", fontWeight: 500 }}
          >
            Lock session
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
