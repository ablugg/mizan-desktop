"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { ConversationSummary } from "@/types";
import { useLocale } from "@/contexts/LocaleContext";

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  opacity: number;
  phase: number;
  hue: number;
}

function makeBubble(w: number, h: number, fromBottom = false): Bubble {
  return {
    x: Math.random() * w,
    y: fromBottom ? h + Math.random() * 200 : Math.random() * h,
    r: 18 + Math.random() * 55,
    speed: 0.07 + Math.random() * 0.12,
    drift: (Math.random() - 0.5) * 0.4,
    opacity: 0.08 + Math.random() * 0.14,
    phase: Math.random() * Math.PI * 2,
    hue: 210 + Math.random() * 30,
  };
}

export function Sidebar() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams();
  const displayName = "Mizan";
  const displayEmail = "Private";
  const routeId = params?.id as string | undefined;
  const [activeId, setActiveId] = useState<string | undefined>(routeId);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Notify chat area when sidebar collapses/expands
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sidebar-collapsed", { detail: { collapsed: isCollapsed } }));
  }, [isCollapsed]);

  // Bubble animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let bubbles: Bubble[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      bubbles = Array.from({ length: 14 }, () =>
        makeBubble(canvas.width, canvas.height, false)
      );
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const b of bubbles) {
        b.y -= b.speed;
        b.x += Math.sin(b.y / 90 + b.phase) * b.drift;

        if (b.y + b.r < 0) {
          Object.assign(b, makeBubble(canvas.width, canvas.height, true));
        }

        const blurRadius = b.r * 0.55;
        ctx.filter = `blur(${blurRadius.toFixed(1)}px)`;

        const g = ctx.createRadialGradient(
          b.x - b.r * 0.25, b.y - b.r * 0.25, 0,
          b.x, b.y, b.r
        );
        g.addColorStop(0, `hsla(${b.hue}, 75%, 62%, ${b.opacity * 1.5})`);
        g.addColorStop(0.6, `hsla(${b.hue}, 65%, 42%, ${b.opacity * 0.7})`);
        g.addColorStop(1, `hsla(${b.hue}, 55%, 25%, 0)`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.filter = "none";
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    setActiveId(routeId);
  }, [routeId]);

  useEffect(() => {
    fetchConversations();

    function handleUpdate(e: Event) {
      const detail = (e as CustomEvent).detail as { id?: string; preview?: string } | undefined;
      if (detail?.id) {
        setActiveId(detail.id);
      }
      if (detail?.id && detail?.preview) {
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === detail.id);
          if (exists) {
            return prev.map((c) =>
              c.id === detail.id
                ? { ...c, updatedAt: new Date(), lastMessage: { content: detail.preview!, role: "user" } }
                : c
            );
          }
          return [
            {
              id: detail.id!,
              title: "New Conversation",
              updatedAt: new Date(),
              lastMessage: { content: detail.preview!, role: "user" },
            } as ConversationSummary,
            ...prev,
          ];
        });
      }
      fetchConversations();
    }

    function handleToggle() {
      setIsOpen((prev) => !prev);
    }

    window.addEventListener("conversations-updated", handleUpdate);
    window.addEventListener("toggle-sidebar", handleToggle);
    return () => {
      window.removeEventListener("conversations-updated", handleUpdate);
      window.removeEventListener("toggle-sidebar", handleToggle);
    };
  }, []);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations", { credentials: "include" });
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {}
  }

  function newConversation() {
    setIsOpen(false);
    if (!activeId || activeId === "new") return;
    if (routeId === "new") {
      window.location.assign("/chat/new");
    } else {
      router.push("/chat/new");
    }
  }

  function requestDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDeleteId(id);
    pendingDeleteTimer.current = setTimeout(() => setPendingDeleteId(null), 3000);
  }

  async function confirmDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDeleteId(null);
    try {
      await fetch("/api/conversations", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setIsOpen(false);
        router.push("/chat/new");
      }
    } catch {}
  }

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const todayLabel = t("sidebar.today");
  const yesterdayLabel = t("sidebar.yesterday");
  const earlierLabel = t("sidebar.earlier");

  const grouped = conversations.reduce(
    (acc, c) => {
      const d = new Date(c.updatedAt).toDateString();
      const key = d === today ? todayLabel : d === yesterday ? yesterdayLabel : earlierLabel;
      acc[key] = acc[key] ?? [];
      acc[key].push(c);
      return acc;
    },
    {} as Record<string, ConversationSummary[]>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={() => setIsOpen(false)}
      />

      {/* Desktop re-open button — shown when collapsed */}
      {isCollapsed && (
        <button
          className="hidden md:flex fixed left-0 top-1/2 z-50 items-center justify-center"
          style={{
            transform: "translateY(-50%)",
            width: "20px",
            height: "52px",
            background: "linear-gradient(180deg, #0f2244 0%, #0d1e38 100%)",
            border: "1px solid rgba(100,140,200,0.14)",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            cursor: "pointer",
            color: "rgba(201,168,76,0.55)",
            transition: "color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#c9a84c";
            e.currentTarget.style.background = "linear-gradient(180deg, #142d52 0%, #102440 100%)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(201,168,76,0.55)";
            e.currentTarget.style.background = "linear-gradient(180deg, #0f2040 0%, #0a1628 100%)";
          }}
          onClick={() => setIsCollapsed(false)}
        >
          <ChevronRight size={12} />
        </button>
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          md:static md:z-auto md:translate-x-0
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          // On mobile the sidebar is a fixed overlay — ignore isCollapsed so it always slides in at 300px.
          // On desktop isCollapsed shrinks it to 0.
          // NOTE: no `position` here — Tailwind `fixed` (mobile) / `md:static` (desktop) must win.
          width: (isCollapsed && !isOpen) ? "0px" : "300px",
          minWidth: (isCollapsed && !isOpen) ? "0px" : undefined,
          height: "100dvh",
          borderRight: (isCollapsed && !isOpen) ? "none" : "1px solid rgba(100,140,200,0.1)",
          overflow: "hidden",
          transition: "transform 0.3s ease-in-out, width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1), border 0.3s ease",
        }}
      >
        {/* Positioned inner wrapper — canvas/glow are absolute within this, not the aside */}
        <div style={{ position: "relative", width: "100%", height: "100%", background: "linear-gradient(180deg, #0d1e38 0%, #0f2244 40%, #0b1a30 100%)", display: "flex", flexDirection: "column" }}>

        {/* Bubble canvas — behind content */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Subtle lapis glow at top */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "200px",
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(46,109,191,0.28) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* All sidebar content — above canvas */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Masthead */}
          <div style={{ padding: "32px 28px 24px", borderBottom: "1px solid rgba(100,140,200,0.08)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "11px",
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    color: "rgba(201,168,76,0.5)",
                    marginBottom: "6px",
                  }}
                >
                  {t("app.tagline")}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "32px",
                    fontWeight: 300,
                    letterSpacing: "0.08em",
                    color: "#e8c96d",
                    lineHeight: 1,
                  }}
                >
                  Mizan
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px", flexShrink: 0 }}>
                {/* Collapse button — desktop only */}
                <button
                  className="hidden md:flex items-center justify-center"
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "1px solid rgba(100,140,200,0.1)",
                    cursor: "pointer",
                    color: "rgba(201,168,76,0.4)",
                    transition: "color 0.15s, background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "rgba(201,168,76,0.8)";
                    e.currentTarget.style.background = "rgba(201,168,76,0.06)";
                    e.currentTarget.style.borderColor = "rgba(201,168,76,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(201,168,76,0.4)";
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "rgba(100,140,200,0.1)";
                  }}
                  onClick={() => setIsCollapsed(true)}
                >
                  <ChevronLeft size={13} />
                </button>

                {/* Enclave status */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "#4ac56e",
                      boxShadow: "0 0 6px rgba(74,197,110,0.7)",
                      flexShrink: 0,
                      animation: "enclavePulse 2.4s ease-in-out infinite",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "8px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(74,197,110,0.65)",
                      fontFamily: "var(--font-dm-sans)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("enclave.status")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* New conversation */}
          <div style={{ padding: "20px 28px 0" }}>
            <button
              onClick={newConversation}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(201,168,76,0.12)",
                padding: "0 0 16px 0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "rgba(201,168,76,0.6)",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e8c96d"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(201,168,76,0.6)"; }}
            >
              <span
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "15px",
                  fontWeight: 400,
                  letterSpacing: "0.06em",
                }}
              >
                {t("sidebar.newChat")}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          {/* Conversation list */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 0",
              scrollbarWidth: "none",
            }}
          >
            {Object.entries(grouped).map(([group, convs]) => (
              <div key={group} style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    padding: "16px 28px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "10px",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.3)",
                      flexShrink: 0,
                    }}
                  >
                    {group}
                  </span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(100,140,200,0.08)" }} />
                </div>

                {convs.map((c, i) => (
                  <div
                    key={c.id}
                    className="group"
                    style={{ position: "relative" }}
                  >
                    <Link
                      href={`/chat/${c.id}`}
                      style={{ textDecoration: "none" }}
                      onClick={() => setIsOpen(false)}
                    >
                      <div
                        style={{
                          padding: "10px 28px",
                          cursor: "pointer",
                          borderLeft: activeId === c.id
                            ? "2px solid #c9a84c"
                            : "2px solid transparent",
                          background: activeId === c.id
                            ? "rgba(201,168,76,0.05)"
                            : "transparent",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (activeId !== c.id) {
                            e.currentTarget.style.background = "rgba(46,109,191,0.06)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeId !== c.id) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <div
                          style={{
                            fontSize: "9px",
                            letterSpacing: "0.2em",
                            color: "rgba(255,255,255,0.3)",
                            marginBottom: "4px",
                            fontFamily: "var(--font-dm-sans)",
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </div>

                        <div
                          style={{
                            fontFamily: "var(--font-cormorant)",
                            fontSize: "15px",
                            fontWeight: activeId === c.id ? 500 : 400,
                            color: activeId === c.id ? "#e8c96d" : "rgba(232,228,218,0.9)",
                            lineHeight: 1.35,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            paddingRight: "24px",
                          }}
                        >
                          {c.title}
                        </div>

                        {c.lastMessage?.content && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "rgba(255,255,255,0.4)",
                              marginTop: "4px",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              fontFamily: "var(--font-dm-sans)",
                              fontWeight: 300,
                              paddingRight: "24px",
                            }}
                          >
                            {c.lastMessage.content.slice(0, 50)}
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Delete / Confirm */}
                    <button
                      onClick={(e) => pendingDeleteId === c.id ? confirmDelete(e, c.id) : requestDelete(e, c.id)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "22px",
                        height: "22px",
                        borderRadius: "4px",
                        border: "none",
                        background: pendingDeleteId === c.id ? "rgba(74,197,110,0.1)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: pendingDeleteId === c.id ? "#4ac56e" : "rgba(255,255,255,0.35)",
                        opacity: pendingDeleteId === c.id ? 1 : 0,
                        transition: "all 0.15s",
                      }}
                      className="delete-btn"
                      onMouseEnter={(e) => {
                        if (pendingDeleteId === c.id) return;
                        e.currentTarget.style.color = "#e05555";
                        e.currentTarget.style.background = "rgba(224,85,85,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        if (pendingDeleteId === c.id) return;
                        e.currentTarget.style.color = "rgba(255,255,255,0.15)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {pendingDeleteId === c.id
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <Trash2 size={11} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 28px max(24px, env(safe-area-inset-bottom))",
              borderTop: "1px solid rgba(100,140,200,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "14px",
                    color: "rgba(232,228,218,0.6)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.28)",
                    marginTop: "1px",
                    fontFamily: "var(--font-dm-sans)",
                    maxWidth: "140px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayEmail}
                </div>
              </div>
            </div>
          </div>

        </div>

        <style>{`
          .group:hover .delete-btn {
            opacity: 1 !important;
          }
          @media (hover: none) {
            .delete-btn {
              opacity: 0.45 !important;
            }
          }
        `}</style>
        </div>{/* end positioned inner wrapper */}
      </aside>
    </>
  );
}
