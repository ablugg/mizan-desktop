"use client";

import { useEffect, useState } from "react";

function detectInAppBrowser(): { inApp: boolean; name: string } {
  if (typeof navigator === "undefined") return { inApp: false, name: "" };
  const ua = navigator.userAgent;
  if (/LinkedInApp/i.test(ua)) return { inApp: true, name: "LinkedIn" };
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return { inApp: true, name: "Facebook" };
  if (/Instagram/i.test(ua)) return { inApp: true, name: "Instagram" };
  if (/Twitter/i.test(ua)) return { inApp: true, name: "Twitter" };
  if (/Line\//i.test(ua)) return { inApp: true, name: "Line" };
  if (/GSA\//i.test(ua)) return { inApp: true, name: "Google App" };
  // Generic Android WebView
  if (/Android/.test(ua) && /wv\)/.test(ua)) return { inApp: true, name: "an in-app browser" };
  return { inApp: false, name: "" };
}

export function InAppBrowserWarning() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appName, setAppName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    const { inApp, name } = detectInAppBrowser();
    if (inApp) {
      setShow(true);
      setAppName(name);
      setUrl(window.location.href);
    }
  }, []);

  if (!show) return null;

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10,16,26,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: "2.5rem", marginBottom: "1.25rem" }}>🌐</div>

      <h2
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontWeight: 400,
          fontSize: "1.5rem",
          color: "#c9a84c",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Open in your browser
      </h2>

      <p
        style={{
          fontSize: "14px",
          color: "#7a8aaa",
          lineHeight: 1.6,
          maxWidth: "300px",
          marginBottom: "2rem",
        }}
      >
        Google sign-in doesn't work inside {appName}. Please open this page in Safari or Chrome to continue.
      </p>

      {/* Copy link button */}
      <button
        onClick={copyLink}
        style={{
          background: copied ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.1)",
          border: "1px solid rgba(201,168,76,0.35)",
          borderRadius: "8px",
          color: "#c9a84c",
          fontSize: "14px",
          fontFamily: "var(--font-dm-sans), sans-serif",
          padding: "0.75rem 1.5rem",
          cursor: "pointer",
          width: "100%",
          maxWidth: "300px",
          marginBottom: "0.75rem",
          transition: "background 0.2s",
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>

      <p style={{ fontSize: "12px", color: "#3d4f6e" }}>
        Paste it in Safari or Chrome to sign in
      </p>
    </div>
  );
}
