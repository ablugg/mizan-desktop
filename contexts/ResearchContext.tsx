"use client";

import { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { Message } from "@/types";
import {
  loadOrGenerateKeypair,
  exportPublicKeyBase64,
  decryptEnclaveResponse,
} from "@/lib/enclave-activation";

type ResearchContextValue = {
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (content: string) => void;
  stopStreaming: () => void;
  reset: () => void;
  restoreMessages: (msgs: Message[]) => void;
};

const ResearchContext = createContext<ResearchContextValue | null>(null);

export function useResearch() {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error("useResearch must be used inside ResearchProvider");
  return ctx;
}

export function ResearchProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const clientKeypairRef = useRef<CryptoKeyPair | null>(null);
  const enclavePublicKeyRef = useRef<string | null>(null);
  // Keep a stable ref to current messages for use inside async callbacks
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    (async () => {
      try {
        clientKeypairRef.current = await loadOrGenerateKeypair();
        const res = await fetch("/api/enclave/public-key");
        if (res.ok) {
          const data = await res.json();
          enclavePublicKeyRef.current = data.public_key ?? null;
        }
      } catch {}
    })();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const aiId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: aiId, role: "assistant", content: "", createdAt: new Date() },
    ]);

    try {
      abortRef.current = new AbortController();

      let clientPublicKey: string | undefined;
      if (clientKeypairRef.current) {
        clientPublicKey = await exportPublicKeyBase64(clientKeypairRef.current.publicKey);
      }

      // Snapshot messages at time of send (excluding the new assistant placeholder)
      const history = messagesRef.current
        .filter((m) => m.id !== aiId)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: null,
          messages: [...history, { role: "user", content }],
          clientPublicKey,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error("Request failed");

      const contentType = response.headers.get("Content-Type") ?? "";
      let accumulated = "";
      let displayed = "";
      let animating = false;

      function animateNext() {
        if (displayed.length >= accumulated.length) {
          animating = false;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: accumulated } : m))
          );
          return;
        }
        displayed += accumulated.slice(displayed.length, displayed.length + 4);
        const snap = displayed;
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: snap } : m))
        );
        requestAnimationFrame(animateNext);
      }

      if (contentType.includes("application/x-ndjson")) {
        if (!response.body) throw new Error("No body");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const chunk = JSON.parse(t);
              if (clientKeypairRef.current && enclavePublicKeyRef.current) {
                const plain = await decryptEnclaveResponse(
                  chunk,
                  clientKeypairRef.current.privateKey,
                  enclavePublicKeyRef.current
                );
                accumulated += plain;
                if (!animating) {
                  animating = true;
                  requestAnimationFrame(animateNext);
                }
              }
            } catch {}
          }
        }
        displayed = accumulated;
        if (!animating)
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: accumulated } : m))
          );
      } else {
        if (!response.body) throw new Error("No body");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          if (!animating) {
            animating = true;
            requestAnimationFrame(animateNext);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, content: "Something went wrong. Please try again." } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const stopStreaming = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setMessages([]), []);
  const restoreMessages = useCallback((msgs: Message[]) => setMessages(msgs), []);

  return (
    <ResearchContext.Provider value={{ messages, isStreaming, sendMessage, stopStreaming, reset, restoreMessages }}>
      {children}
    </ResearchContext.Provider>
  );
}
