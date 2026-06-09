"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

interface Props {
  onFile: (f: File) => void;
  accept?: string;
  file?: File | null;
  disabled?: boolean;
}

const CORNER = "rgba(201,168,76,0.22)";
const CORNER_ACTIVE = "rgba(74,197,110,0.4)";
const CORNER_DRAG = "rgba(201,168,76,0.55)";
const CORNER_HOVER = "rgba(201,168,76,0.45)";

export function DocumentUploadZone({ onFile, accept = ".pdf,.docx,.txt", file, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(localStorage.getItem("attorney-light-mode") === "true");
    const handler = (e: Event) => {
      setIsLight((e as CustomEvent<{ light: boolean }>).detail.light);
    };
    window.addEventListener("attorney-theme-change", handler);
    return () => window.removeEventListener("attorney-theme-change", handler);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  const isHoverActive = hovering && !dragging && !file && !disabled;

  const accentColor = dragging ? CORNER_DRAG : file ? CORNER_ACTIVE : isHoverActive ? CORNER_HOVER : CORNER;
  const borderColor = dragging
    ? "rgba(201,168,76,0.4)"
    : file
    ? "rgba(74,197,110,0.22)"
    : isHoverActive
    ? "rgba(201,168,76,0.35)"
    : isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.07)";
  const bgColor = dragging
    ? isLight ? "rgba(201,168,76,0.07)" : "rgba(201,168,76,0.04)"
    : file
    ? isLight ? "rgba(74,197,110,0.05)" : "rgba(74,197,110,0.025)"
    : isHoverActive
    ? isLight ? "rgba(201,168,76,0.05)" : "rgba(201,168,76,0.03)"
    : isLight ? "rgba(238,233,222,0.92)" : "rgba(4,8,20,0.55)";
  const glowColor = dragging
    ? "rgba(201,168,76,0.12)"
    : file
    ? "rgba(74,197,110,0.07)"
    : isHoverActive
    ? "rgba(201,168,76,0.11)"
    : isLight ? "rgba(180,140,60,0.06)" : "rgba(20,50,100,0.1)";

  const corner = (pos: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    width: "16px",
    height: "16px",
    ...pos,
    borderColor: accentColor,
    transition: "border-color 0.25s",
  });

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setDragging(false); }}
      style={{
        position: "relative",
        borderRadius: "16px",
        padding: "52px 32px 40px",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        transition: "all 0.25s",
        opacity: disabled ? 0.5 : 1,
        overflow: "hidden",
        boxShadow: isHoverActive || dragging
          ? "0 0 32px rgba(201,168,76,0.08), inset 0 0 24px rgba(201,168,76,0.03)"
          : "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
      />

      {/* Inner radial glow */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 55% at 50% 0%, ${glowColor} 0%, transparent 70%)`,
        transition: "background 0.25s",
      }} />

      {/* Corner accents */}
      <div aria-hidden style={corner({ top: "12px", left: "12px", borderTop: `1px solid`, borderLeft: `1px solid`, borderRadius: "3px 0 0 0" })} />
      <div aria-hidden style={corner({ top: "12px", right: "12px", borderTop: `1px solid`, borderRight: `1px solid`, borderRadius: "0 3px 0 0" })} />
      <div aria-hidden style={corner({ bottom: "12px", left: "12px", borderBottom: `1px solid`, borderLeft: `1px solid`, borderRadius: "0 0 0 3px" })} />
      <div aria-hidden style={corner({ bottom: "12px", right: "12px", borderBottom: `1px solid`, borderRight: `1px solid`, borderRadius: "0 0 3px 0" })} />

      {/* Upload icon */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", position: "relative", zIndex: 1 }}>
        <div style={{
          width: "52px", height: "52px", borderRadius: "13px",
          background: file ? "rgba(74,197,110,0.07)" : (dragging || isHoverActive) ? "rgba(201,168,76,0.07)" : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${file ? "rgba(74,197,110,0.18)" : (dragging || isHoverActive) ? "rgba(201,168,76,0.22)" : isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.07)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s",
        }}>
          <Upload
            size={20}
            style={{
              color: file ? "#4ac56e" : (dragging || isHoverActive) ? "#c9a84c" : isLight ? "rgba(60,75,100,0.4)" : "rgba(180,190,210,0.3)",
              transition: "color 0.25s",
            }}
          />
        </div>
      </div>

      {/* Text */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {file ? (
          <>
            <p style={{
              fontFamily: "var(--font-cormorant), serif",
              fontSize: "17px",
              color: isLight ? "#6b500e" : "#e8d5a0",
              fontWeight: 300,
              marginBottom: "5px",
              letterSpacing: "0.02em",
            }}>
              {file.name}
            </p>
            <p style={{
              fontSize: "11px",
              color: isLight ? "rgba(50,60,84,0.6)" : "rgba(140,160,190,0.55)",
              fontFamily: "var(--font-dm-sans)",
            }}>
              {(file.size / 1024).toFixed(0)} KB · Click to change
            </p>
          </>
        ) : (
          <>
            <p style={{
              fontFamily: "var(--font-cormorant), serif",
              fontSize: "18px",
              color: dragging
                ? isLight ? "rgba(120,80,10,0.8)" : "rgba(220,195,140,0.7)"
                : isHoverActive
                ? isLight ? "rgba(110,75,10,0.75)" : "rgba(220,195,130,0.65)"
                : isLight ? "rgba(40,55,80,0.55)" : "rgba(255,255,255,1)",
              fontWeight: 300,
              marginBottom: "7px",
              letterSpacing: "0.02em",
              transition: "color 0.25s",
            }}>
              {dragging ? "Release to upload" : "Drop a document or click to upload"}
            </p>
            <p style={{
              fontSize: "10px",
              color: isLight ? "rgba(50,60,84,0.45)" : "rgba(255,255,255,0.55)",
              fontFamily: "var(--font-dm-sans)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}>
              PDF · DOCX · TXT
            </p>
          </>
        )}
      </div>

      {/* Encrypted footer */}
      <div style={{
        marginTop: "20px",
        paddingTop: "16px",
        borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        position: "relative",
        zIndex: 1,
      }}>
        <svg width="9" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(74,197,110,0.75)" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{
          fontSize: "9px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(74,197,110,0.75)",
          fontFamily: "var(--font-dm-sans)",
        }}>
          End-to-end encrypted
        </span>
      </div>
    </div>
  );
}
