"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

interface Props {
  onComplete: () => void;
}

export function PinSetupModal({ onComplete }: Props) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mismatch = confirm.length > 0 && pin !== confirm;
  const canSubmit = pin.length >= 4 && pin === confirm && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/attorney/unlock/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pin }),
        credentials: "include",
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        onComplete();
      } else {
        setError(data.error ?? "Failed to set PIN. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputWrap: React.CSSProperties = {
    position: "relative",
    marginBottom: "14px",
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "11px 40px 11px 14px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${hasError ? "rgba(210,70,70,0.5)" : "rgba(255,255,255,0.1)"}`,
    color: "#d4dcea",
    fontFamily: "var(--font-dm-sans)",
    fontSize: "15px",
    letterSpacing: "0.2em",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  });

  const eyeBtn: React.CSSProperties = {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "rgba(140,160,190,0.5)",
    display: "flex",
    alignItems: "center",
    padding: "0",
  };

  const modal = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(3,8,16,0.92)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: "360px",
        background: "linear-gradient(160deg, #0a1628 0%, #060d1a 100%)",
        border: "1px solid rgba(201,168,76,0.15)",
        borderRadius: "20px",
        padding: "36px 32px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      }}>
        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={24} style={{ color: "#c9a84c" }} />
          </div>
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily: "var(--font-cormorant)",
          fontSize: "24px", fontWeight: 300,
          color: "#e8d5a0", textAlign: "center",
          marginBottom: "8px", letterSpacing: "0.04em",
        }}>
          Set Your Lockdown PIN
        </h2>
        <p style={{
          fontSize: "12px", color: "rgba(140,160,190,0.6)",
          fontFamily: "var(--font-dm-sans)",
          textAlign: "center", lineHeight: 1.6,
          marginBottom: "28px",
        }}>
          Mizan locks automatically after inactivity. Choose a PIN to resume your session. Any length works.
        </p>

        <form onSubmit={handleSubmit}>
          {/* PIN */}
          <label style={{ display: "block", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(180,190,210,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "6px" }}>
            PIN
          </label>
          <div style={inputWrap}>
            <input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="choose a PIN"
              autoFocus
              style={{ ...inputStyle(false), letterSpacing: pin ? "0.3em" : "0.05em" }}
            />
            <button type="button" style={eyeBtn} onClick={() => setShowPin(v => !v)} tabIndex={-1}>
              {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Confirm */}
          <label style={{ display: "block", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(180,190,210,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "6px" }}>
            Confirm PIN
          </label>
          <div style={{ ...inputWrap, marginBottom: error ? "6px" : "20px" }}>
            <input
              type={showConfirm ? "text" : "password"}
              inputMode="numeric"
              value={confirm}
              onChange={e => { setConfirm(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="confirm PIN"
              style={{ ...inputStyle(mismatch), letterSpacing: confirm ? "0.3em" : "0.05em" }}
            />
            <button type="button" style={eyeBtn} onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
              {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {mismatch && !error && (
            <p style={{ fontSize: "11px", color: "rgba(210,70,70,0.85)", fontFamily: "var(--font-dm-sans)", marginBottom: "10px" }}>
              PINs do not match.
            </p>
          )}
          {error && (
            <p style={{ fontSize: "11px", color: "rgba(210,70,70,0.85)", fontFamily: "var(--font-dm-sans)", marginBottom: "10px" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%", padding: "12px",
              borderRadius: "10px", border: "none",
              background: canSubmit ? "rgba(201,168,76,0.85)" : "rgba(255,255,255,0.06)",
              color: canSubmit ? "#1a1200" : "rgba(140,160,190,0.3)",
              fontFamily: "var(--font-dm-sans)", fontSize: "12px",
              fontWeight: 500, letterSpacing: "0.1em",
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            {loading ? "Saving…" : "Set PIN and Continue"}
          </button>
        </form>

        <p style={{ marginTop: "16px", fontSize: "10px", color: "rgba(140,160,190,0.35)", fontFamily: "var(--font-dm-sans)", textAlign: "center", lineHeight: 1.5 }}>
          You can change your PIN later in Settings.
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
