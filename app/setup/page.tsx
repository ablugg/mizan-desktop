"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SetupStatus {
  dbReady: boolean;
  modelReady: boolean;
  embeddingReady: boolean;
  vectorsReady: boolean;
  defaultModel?: string;
  embeddingModel?: string;
}

interface ModelState {
  status: "idle" | "pulling" | "done" | "error";
  label: string;
  total: number;
  completed: number;
  currentStatus: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      width: "100%", height: "4px", borderRadius: "2px",
      background: "rgba(255,255,255,0.07)", overflow: "hidden",
    }}>
      <div style={{
        height: "100%", borderRadius: "2px",
        width: `${Math.min(100, pct)}%`,
        background: color,
        transition: "width 0.3s ease",
      }} />
    </div>
  );
}

function ModelCard({
  name,
  size,
  state,
  onDownload,
  isLight,
}: {
  name: string;
  size: string;
  state: ModelState;
  onDownload: () => void;
  isLight: boolean;
}) {
  const gold = isLight ? "#7a5410" : "#c9a84c";
  const cardBg = isLight ? "rgba(238,233,222,0.92)" : "rgba(255,255,255,0.04)";
  const border = isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.07)";
  const textMain = isLight ? "rgba(28,34,52,0.92)" : "rgba(220,228,242,0.9)";
  const textMuted = isLight ? "rgba(50,60,84,0.6)" : "rgba(140,160,190,0.7)";
  const greenColor = isLight ? "#1a7a40" : "#4ac56e";

  const pct = state.total > 0 ? (state.completed / state.total) * 100 : 0;

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${border}`,
      borderRadius: "12px",
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-dm-sans)", fontSize: "13px", fontWeight: 500, color: textMain, letterSpacing: "0.02em" }}>
            {name}
          </p>
          <p style={{ margin: "3px 0 0", fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: textMuted }}>
            {size}
          </p>
        </div>

        {/* Status badge / button */}
        {state.status === "done" && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "4px 10px", borderRadius: "6px",
            background: isLight ? "rgba(18,110,50,0.1)" : "rgba(74,197,110,0.12)",
            border: `1px solid ${isLight ? "rgba(18,110,50,0.2)" : "rgba(74,197,110,0.2)"}`,
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5L4 7.5L8.5 2.5" stroke={greenColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: greenColor, letterSpacing: "0.04em" }}>
              Ready
            </span>
          </div>
        )}

        {state.status === "idle" && (
          <button
            onClick={onDownload}
            style={{
              padding: "5px 14px", borderRadius: "6px",
              border: `1px solid ${isLight ? "rgba(107,80,14,0.35)" : "rgba(201,168,76,0.3)"}`,
              background: "transparent", color: gold,
              fontFamily: "var(--font-dm-sans)", fontSize: "11px",
              cursor: "pointer", letterSpacing: "0.04em",
            }}
          >
            Download
          </button>
        )}

        {state.status === "pulling" && (
          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: gold, letterSpacing: "0.04em" }}>
            {pct > 0 ? `${pct.toFixed(1)}%` : "Starting..."}
          </span>
        )}

        {state.status === "error" && (
          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "#e05252", letterSpacing: "0.04em" }}>
            Error
          </span>
        )}
      </div>

      {/* Progress */}
      {state.status === "pulling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <ProgressBar pct={pct} color={gold} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "10px", color: textMuted }}>
              {state.currentStatus || "Connecting to Ollama..."}
            </span>
            {state.total > 0 && (
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "10px", color: textMuted }}>
                {formatBytes(state.completed)} / {formatBytes(state.total)}
              </span>
            )}
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "#e05252" }}>
            {state.error ?? "Failed to download model. Make sure Ollama is running."}
          </p>
          <button
            onClick={onDownload}
            style={{
              alignSelf: "flex-start", padding: "5px 14px", borderRadius: "6px",
              border: "1px solid rgba(224,82,82,0.3)",
              background: "transparent", color: "#e05252",
              fontFamily: "var(--font-dm-sans)", fontSize: "11px",
              cursor: "pointer", letterSpacing: "0.04em",
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [isLight] = useState(false);

  const defaultModel = status?.defaultModel ?? "qwen2.5:14b";
  const embeddingModel = status?.embeddingModel ?? "nomic-embed-text";

  const [mainModel, setMainModel] = useState<ModelState>({
    status: "idle", label: defaultModel,
    total: 0, completed: 0, currentStatus: "",
  });
  const [embedModel, setEmbedModel] = useState<ModelState>({
    status: "idle", label: embeddingModel,
    total: 0, completed: 0, currentStatus: "",
  });

  const pullingMain = useRef(false);
  const pullingEmbed = useRef(false);

  // On mount: check setup status
  useEffect(() => {
    check();
  }, []);

  async function check() {
    setChecking(true);
    try {
      const res = await fetch("/api/setup/status");
      const data: SetupStatus = await res.json();
      setStatus(data);

      if (data.modelReady) setMainModel(s => ({ ...s, status: "done" }));
      if (data.embeddingReady) setEmbedModel(s => ({ ...s, status: "done" }));

      if (data.dbReady && data.modelReady && data.embeddingReady) {
        router.replace("/attorney/research");
        return;
      }
    } catch {
      // Ollama or server not ready yet, stay on setup
    }
    setChecking(false);
  }

  async function pullModel(
    model: string,
    setter: React.Dispatch<React.SetStateAction<ModelState>>,
    pullingRef: React.MutableRefObject<boolean>
  ) {
    if (pullingRef.current) return;
    pullingRef.current = true;

    setter(s => ({ ...s, status: "pulling", total: 0, completed: 0, currentStatus: "Connecting..." }));

    try {
      const res = await fetch("/api/setup/pull-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Ollama not reachable (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed) as {
              status?: string;
              total?: number;
              completed?: number;
              error?: string;
            };

            if (chunk.error) {
              throw new Error(chunk.error);
            }

            setter(s => ({
              ...s,
              currentStatus: chunk.status ?? s.currentStatus,
              total: chunk.total ?? s.total,
              completed: chunk.completed ?? s.completed,
            }));

            if (chunk.status === "success") {
              setter(s => ({ ...s, status: "done" }));
              pullingRef.current = false;
              // Re-check overall status after a model is done
              setTimeout(check, 500);
              return;
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected token") {
              throw parseErr;
            }
          }
        }
      }

      setter(s => ({ ...s, status: "done" }));
      pullingRef.current = false;
      setTimeout(check, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setter(s => ({ ...s, status: "error", error: msg }));
      pullingRef.current = false;
    }
  }

  function downloadMainModel() {
    pullModel(defaultModel, setMainModel, pullingMain);
  }

  function downloadEmbedModel() {
    pullModel(embeddingModel, setEmbedModel, pullingEmbed);
  }

  function downloadAll() {
    if (mainModel.status === "idle" || mainModel.status === "error") downloadMainModel();
    if (embedModel.status === "idle" || embedModel.status === "error") downloadEmbedModel();
  }

  const allReady = mainModel.status === "done" && embedModel.status === "done";
  const anyPulling = mainModel.status === "pulling" || embedModel.status === "pulling";
  const anyPending = mainModel.status !== "done" || embedModel.status !== "done";

  const bg = isLight ? "#fafaf7" : "#060d1a";
  const gold = isLight ? "#7a5410" : "#c9a84c";
  const textMain = isLight ? "rgba(28,34,52,0.92)" : "rgba(220,228,242,0.9)";
  const textMuted = isLight ? "rgba(50,60,84,0.6)" : "rgba(140,160,190,0.7)";
  const cardBg = isLight ? "rgba(238,233,222,0.92)" : "rgba(255,255,255,0.03)";
  const border = isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.06)";

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          border: `2px solid rgba(201,168,76,0.15)`,
          borderTopColor: gold,
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-dm-sans)",
      padding: "40px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "32px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{
            margin: 0, fontSize: "28px", fontFamily: "var(--font-cormorant)",
            fontWeight: 300, letterSpacing: "0.12em",
            color: gold,
          }}>
            MIZAN
          </h1>
          <p style={{
            margin: "6px 0 0", fontSize: "11px", letterSpacing: "0.14em",
            color: textMuted, textTransform: "uppercase",
          }}>
            Legal Intelligence
          </p>
        </div>

        {/* Status card */}
        <div style={{
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: "16px",
          padding: "28px",
          display: "flex", flexDirection: "column", gap: "24px",
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: "16px", fontWeight: 500,
              color: textMain, letterSpacing: "0.02em",
            }}>
              First-time setup
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: textMuted, lineHeight: "1.6" }}>
              Mizan runs entirely on your device. The AI models below must be downloaded
              once before you can use the assistant. No data leaves your machine.
            </p>
          </div>

          {/* DB status row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: status?.dbReady ? "#4ac56e" : "#e05252",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "12px", color: textMuted }}>
              {status?.dbReady ? "Database ready" : "Database initialising..."}
            </span>
          </div>

          {/* Model cards */}
          <ModelCard
            name={defaultModel}
            size="~4.7 GB  |  Main language model"
            state={mainModel}
            onDownload={downloadMainModel}
            isLight={isLight}
          />
          <ModelCard
            name={embeddingModel}
            size="~274 MB  |  Document search and retrieval"
            state={embedModel}
            onDownload={downloadEmbedModel}
            isLight={isLight}
          />

          {/* Vector store status */}
          {!status?.vectorsReady && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "rgba(201,168,76,0.5)",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: "12px", color: textMuted }}>
                Legal knowledge base not found. Run{" "}
                <code style={{
                  fontFamily: "monospace", fontSize: "11px",
                  background: "rgba(255,255,255,0.06)",
                  padding: "1px 5px", borderRadius: "3px",
                  color: gold,
                }}>
                  npm run build:vectors
                </code>
                {" "}to build it.
              </span>
            </div>
          )}

          {/* Action buttons */}
          {anyPending && !anyPulling && (
            <button
              onClick={downloadAll}
              disabled={anyPulling}
              style={{
                width: "100%", padding: "11px",
                borderRadius: "8px",
                border: `1px solid ${isLight ? "rgba(107,80,14,0.35)" : "rgba(201,168,76,0.3)"}`,
                background: isLight ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.07)",
                color: gold,
                fontFamily: "var(--font-dm-sans)", fontSize: "12px",
                fontWeight: 500, letterSpacing: "0.06em",
                cursor: "pointer",
                textTransform: "uppercase" as const,
              }}
            >
              Download All Models
            </button>
          )}

          {anyPulling && (
            <p style={{ margin: 0, fontSize: "11px", color: textMuted, textAlign: "center" }}>
              Downloading from local Ollama at 127.0.0.1:11434 ...
            </p>
          )}

          {allReady && (
            <button
              onClick={() => router.replace("/attorney/research")}
              style={{
                width: "100%", padding: "11px",
                borderRadius: "8px",
                border: "none",
                background: isLight ? "#7a5410" : "#c9a84c",
                color: isLight ? "#fff" : "#060d1a",
                fontFamily: "var(--font-dm-sans)", fontSize: "12px",
                fontWeight: 500, letterSpacing: "0.06em",
                cursor: "pointer",
                textTransform: "uppercase" as const,
              }}
            >
              Open Mizan
            </button>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "10px", color: textMuted, margin: 0, letterSpacing: "0.04em" }}>
          All processing is local. Nothing is sent to external servers.
        </p>
      </div>
    </div>
  );
}
