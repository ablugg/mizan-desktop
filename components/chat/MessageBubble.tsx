"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "@/types";
import { MizanIcon } from "@/components/ui/MizanIcon";
import { User, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

interface Chunk {
  id: number;
  text: string;
}

function StreamingText({ content }: { content: string }) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const prevContentRef = useRef("");
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (content.length > prevContentRef.current.length) {
      const newText = content.slice(prevContentRef.current.length);
      prevContentRef.current = content;
      setChunks((prev) => [...prev, { id: nextIdRef.current++, text: newText }]);
    }
  }, [content]);

  return (
    <>
      {chunks.map((chunk) => (
        <span key={chunk.id} style={{ animation: "fadeIn 0.5s ease both" }}>
          {chunk.text}
        </span>
      ))}
    </>
  );
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [isTyping, setIsTyping] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isStreaming || isUser) return;
    setIsTyping(true);
    const t = setTimeout(() => setIsTyping(false), 400);
    return () => clearTimeout(t);
  }, [message.content, isStreaming, isUser]);

  return (
    <div
      className={`flex gap-4 items-start ${isUser ? "flex-row-reverse" : ""}`}
      style={{ animation: "fadeUp 0.3s ease both" }}
    >
      {/* Avatar */}
      {isUser ? (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
          style={{
            background: isMobile ? "rgba(4, 10, 26, 0.98)" : "rgba(10, 22, 48, 0.95)",
            border: isMobile ? "1px solid rgba(22, 60, 148, 0.42)" : "1px solid rgba(100,140,200,0.2)",
          }}
        >
          <User size={13} style={{ color: isMobile ? "#3a62b8" : "#5a7aaa" }} />
        </div>
      ) : (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
          style={{
            background: "rgba(10, 18, 35, 0.9)",
            border: "1px solid rgba(201,168,76,0.18)",
          }}
        >
          <MizanIcon size={17} />
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? "ml-12" : ""}`}>
        {isUser ? (
          <div
            style={{
              background: isMobile ? "rgba(5, 12, 32, 0.96)" : "rgba(10, 22, 46, 0.85)",
              border: isMobile ? "1px solid rgba(22, 62, 158, 0.44)" : "1px solid rgba(100,140,200,0.16)",
              borderRadius: "16px 4px 16px 16px",
              padding: "14px 18px",
              color: "#dde4f0",
              wordBreak: "break-word",
              fontSize: "15px",
              lineHeight: "1.65",
              fontWeight: 300,
            }}
          >
            {message.attachedFiles && message.attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {message.attachedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
                    style={{
                      background: "rgba(201,168,76,0.08)",
                      border: "1px solid rgba(201,168,76,0.22)",
                      color: "rgba(201,168,76,0.8)",
                      maxWidth: "200px",
                    }}
                  >
                    <FileText size={10} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {f.name}
                    </span>
                    <span style={{ color: "rgba(201,168,76,0.45)", flexShrink: 0 }}>
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
          </div>
        ) : (
          <div
            style={{
              borderLeft: isMobile ? "1.5px solid rgba(201,168,76,0.22)" : "1.5px solid rgba(201,168,76,0.12)",
              paddingLeft: "16px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "15px",
              lineHeight: "1.75",
              color: "#d4dcea",
              fontFamily: "var(--font-cormorant), serif",
              fontWeight: 300,
            }}
          >
            {isStreaming && !isUser && message.content === "" ? (
              <span className="inline-flex items-center gap-2.5" style={{ color: "rgba(201,168,76,0.65)" }}>
                <svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ flexShrink: 0, animation: "enclavePulse 2s ease-in-out infinite" }}>
                  <path d="M5.5 0L11 2.6V6C11 9.08 8.59 11.96 5.5 13C2.41 11.96 0 9.08 0 6V2.6L5.5 0Z" fill="rgba(201,168,76,0.5)" />
                </svg>
                <span className="tracking-wide" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px" }}>
                  Processing in secure enclave
                </span>
                <span className="inline-flex items-end gap-[3px]" style={{ marginBottom: "1px" }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span
                      key={i}
                      className="inline-block w-[3px] h-[3px] rounded-full bg-[#c9a84c]"
                      style={{ animation: `enclaveDot 1.2s ease-in-out ${delay}s infinite` }}
                    />
                  ))}
                </span>
              </span>
            ) : !isUser && isStreaming ? (
              <StreamingText content={message.content} />
            ) : (
              message.content
            )}
            {isStreaming && !isUser && message.content !== "" && !isTyping && (
              <span
                className="inline-block w-0.5 h-3.5 bg-[#c9a84c] ml-0.5 align-middle"
                style={{ animation: "blink 1s step-end infinite" }}
              />
            )}
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {message.citations.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer transition-all duration-150"
                style={{
                  background: "rgba(201,168,76,0.08)",
                  border: "1px solid rgba(201,168,76,0.18)",
                  color: "rgba(201,168,76,0.6)",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                {c.source}
              </span>
            ))}
          </div>
        )}

        <div
          className={`mt-1.5 tracking-wide ${isUser ? "text-right" : ""}`}
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.22)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {new Date(message.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
