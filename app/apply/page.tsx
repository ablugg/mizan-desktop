"use client";

import { useState } from "react";
import Link from "next/link";
import { SPECIALIZATIONS, JURISDICTIONS } from "@/types";

type Step = "form" | "submitted";

export default function ApplyPage() {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    barNumber: "",
    jurisdiction: "",
    firm: "",
    specializations: [] as string[],
    message: "",
  });

  function toggle(spec: string) {
    setForm((p) => ({
      ...p,
      specializations: p.specializations.includes(spec)
        ? p.specializations.filter((s) => s !== spec)
        : [...p.specializations, spec],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.barNumber || !form.jurisdiction) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setStep("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#060d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 24px 64px" }}>
      {/* Wordmark */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: "40px" }}>
        <div style={{ fontFamily: "var(--font-cormorant)", fontSize: "28px", fontWeight: 300, letterSpacing: "0.1em", color: "#e8c96d", textAlign: "center" }}>
          Mizan
        </div>
        <div style={{ fontSize: "9px", letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(74,197,110,0.55)", textAlign: "center", marginTop: "4px", fontFamily: "var(--font-dm-sans)" }}>
          Attorney Workspace
        </div>
      </Link>

      {step === "submitted" ? (
        <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(74,197,110,0.1)", border: "1px solid rgba(74,197,110,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4 4 8-8" stroke="#4ac56e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "26px", fontWeight: 300, color: "#e8d5a0", marginBottom: "12px" }}>
            Application Received
          </h1>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "rgba(180,195,220,0.65)", lineHeight: 1.7 }}>
            Thank you for applying to the Mizan Attorney Workspace. Your application will be reviewed manually and you will be notified at <strong style={{ color: "rgba(201,168,76,0.8)" }}>{form.email}</strong> once a decision has been made.
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "rgba(140,160,190,0.4)", marginTop: "20px" }}>
            You do not need to create an account at this stage.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ maxWidth: "560px", width: "100%", display: "flex", flexDirection: "column", gap: "0" }}>
          <div style={{ marginBottom: "32px", textAlign: "center" }}>
            <h1 style={{ fontFamily: "var(--font-cormorant)", fontSize: "26px", fontWeight: 300, color: "#e8d5a0", letterSpacing: "0.04em" }}>
              Apply for Attorney Access
            </h1>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "rgba(140,160,190,0.6)", marginTop: "8px" }}>
              Applications are reviewed manually. You will receive an email once approved.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Name & Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Full Name *" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Khalid Al-Rashid" />
              <Field label="Email Address *" type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="k.alrashid@firm.com" />
            </div>

            {/* Bar & Jurisdiction */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Bar / License Number *" value={form.barNumber} onChange={(v) => setForm((p) => ({ ...p, barNumber: v }))} placeholder="SAR-12345" />
              <SelectField
                label="Primary Jurisdiction *"
                value={form.jurisdiction}
                onChange={(v) => setForm((p) => ({ ...p, jurisdiction: v }))}
                options={[...JURISDICTIONS]}
                placeholder="Select jurisdiction…"
              />
            </div>

            {/* Firm */}
            <Field label="Law Firm / Organisation" value={form.firm} onChange={(v) => setForm((p) => ({ ...p, firm: v }))} placeholder="Optional" />

            {/* Specializations */}
            <div>
              <label style={{ display: "block", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", fontFamily: "var(--font-dm-sans)", marginBottom: "10px" }}>
                Areas of Practice
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                {SPECIALIZATIONS.map((s) => {
                  const active = form.specializations.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(s)}
                      style={{
                        padding: "5px 12px", borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontFamily: "var(--font-dm-sans)", transition: "all 0.15s",
                        background: active ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(201,168,76,0.35)" : "rgba(255,255,255,0.08)"}`,
                        color: active ? "#d4a84c" : "rgba(180,195,220,0.65)",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div>
              <label style={{ display: "block", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", fontFamily: "var(--font-dm-sans)", marginBottom: "8px" }}>
                Brief Message <span style={{ color: "rgba(140,155,180,0.4)" }}>(optional)</span>
              </label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Briefly describe your practice and how you intend to use Mizan…"
                style={{ width: "100%", background: "rgba(5,10,24,0.97)", border: "1px solid rgba(22,58,140,0.22)", borderRadius: "10px", padding: "10px 14px", color: "#dde4f0", fontSize: "13px", fontFamily: "var(--font-dm-sans)", outline: "none", resize: "vertical", minHeight: "80px", boxSizing: "border-box" }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(201,168,76,0.3)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(22,58,140,0.22)"; }}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: "16px", padding: "10px 14px", borderRadius: "8px", background: "rgba(200,50,50,0.08)", border: "1px solid rgba(200,50,50,0.2)", color: "#e07070", fontSize: "12px", fontFamily: "var(--font-dm-sans)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: "24px", width: "100%", padding: "12px", borderRadius: "10px", background: loading ? "rgba(201,168,76,0.3)" : "#c9a84c", border: "none", color: "#0b0b10", fontSize: "13px", fontFamily: "var(--font-dm-sans)", fontWeight: 600, cursor: loading ? "default" : "pointer", transition: "all 0.15s" }}
          >
            {loading ? "Submitting…" : "Submit Application"}
          </button>

          <p style={{ marginTop: "16px", textAlign: "center", fontSize: "11px", color: "rgba(140,160,190,0.4)", fontFamily: "var(--font-dm-sans)" }}>
            Already approved?{" "}
            <Link href="/attorney/login" style={{ color: "rgba(201,168,76,0.7)", textDecoration: "none" }}>Sign in here</Link>
          </p>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", fontFamily: "var(--font-dm-sans)", marginBottom: "8px" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "rgba(5,10,24,0.97)", border: "1px solid rgba(22,58,140,0.22)", borderRadius: "10px", padding: "10px 14px", color: "#dde4f0", fontSize: "13px", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(201,168,76,0.3)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(22,58,140,0.22)"; }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", fontFamily: "var(--font-dm-sans)", marginBottom: "8px" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", appearance: "none", background: "rgba(5,10,24,0.97)", border: "1px solid rgba(22,58,140,0.22)", borderRadius: "10px", padding: "10px 36px 10px 14px", color: value ? "#dde4f0" : "rgba(180,195,220,0.4)", fontSize: "13px", fontFamily: "var(--font-dm-sans)", outline: "none", cursor: "pointer" }}
          onFocus={(e) => { e.target.style.borderColor = "rgba(201,168,76,0.3)"; }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(22,58,140,0.22)"; }}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <path d="M2 4l4 4 4-4" stroke="rgba(180,190,210,0.4)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
