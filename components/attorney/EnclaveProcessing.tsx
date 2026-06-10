"use client";

import { useEffect, useState } from "react";

export function EnclaveProcessing({
  label,
  sublabel,
}: {
  label?: string;
  sublabel?: string;
}) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(localStorage.getItem("attorney-light-mode") === "true");
    const handler = (e: Event) => setIsLight((e as CustomEvent<{ light: boolean }>).detail.light);
    window.addEventListener("attorney-theme-change", handler);
    return () => window.removeEventListener("attorney-theme-change", handler);
  }, []);

  return (
    <div style={{ textAlign: "center", padding: "64px 0 48px" }}>
      {/* Animated enclave icon */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
        <div style={{ position: "relative", width: "96px", height: "96px", flexShrink: 0 }}>
          {/* Single SVG — spinning ring + pulsing hex+lock as one unit */}
          <svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            overflow="visible"
            style={{ position: "absolute", inset: 0 }}
          >
            {/* Outer spinning dashed ring */}
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke="rgba(74,197,110,0.18)"
              strokeWidth="1"
              strokeDasharray="5 7"
              style={{ animation: "enclaveRing 6s linear infinite", transformOrigin: "48px 48px" }}
            />
            {/* Hexagon + lock pulsing together as a group */}
            <g style={{ animation: "enclavePulse 2.6s ease-in-out infinite", transformBox: "fill-box", transformOrigin: "center" }}>
              {/* Hexagon — pointy-top, r=32, center=(48,48) */}
              <polygon
                points="48,16 75.7,32 75.7,64 48,80 20.3,64 20.3,32"
                fill="rgba(74,197,110,0.06)"
                stroke="rgba(74,197,110,0.3)"
                strokeWidth="1.5"
              />
              {/* Lock body */}
              <rect x="38" y="46" width="20" height="15" rx="2.5" fill="none" stroke="rgba(74,197,110,0.8)" strokeWidth="1.5" />
              {/* Lock shackle */}
              <path d="M42 46v-6a6 6 0 0 1 12 0v6" fill="none" stroke="rgba(74,197,110,0.8)" strokeWidth="1.5" strokeLinecap="round" />
              {/* Keyhole dot */}
              <circle cx="48" cy="53.5" r="2.2" fill="rgba(74,197,110,0.8)" />
            </g>
          </svg>
        </div>
      </div>

      <p
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontSize: "18px",
          fontWeight: 300,
          color: isLight ? "rgba(10,15,25,0.9)" : "rgba(200,215,235,0.75)",
          letterSpacing: "0.03em",
        }}
      >
        {label ?? "Processing locally"}
      </p>

      <p
        style={{
          fontSize: "11px",
          color: "rgba(74,197,110,0.55)",
          marginTop: "6px",
          fontFamily: "var(--font-dm-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        0 bytes leave your device
      </p>

      <p
        style={{
          fontSize: "11px",
          color: "rgba(140,160,190,0.4)",
          marginTop: "4px",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {sublabel ?? "This may take 20–40 seconds"}
      </p>

      {/* Pulsing dots */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "7px",
          marginTop: "22px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "#4ac56e",
              display: "inline-block",
              animation: `enclaveDot 1.4s ease-in-out ${i * 0.22}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
