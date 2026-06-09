"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDocTask } from "@/contexts/DocTaskContext";
import { CheckCircle, X } from "lucide-react";

const TOOL_PATHS: Record<string, string> = {
  DRAFT: "/attorney/draft",
  REDLINE: "/attorney/redline",
  REVIEW: "/attorney/review",
};

const TOOL_LABELS: Record<string, string> = {
  DRAFT: "Draft ready",
  REDLINE: "Redline complete",
  REVIEW: "Review complete",
};

type Notification = { tool: string; title: string; id: string };

export function TaskNotificationBar() {
  const { tasks, onTaskComplete } = useDocTask();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const cleanups = (["DRAFT", "REDLINE", "REVIEW"] as const).map((tool) =>
      onTaskComplete(tool, () => {
        setNotifications((prev) => {
          if (prev.some((n) => n.tool === tool)) return prev;
          return [
            ...prev,
            {
              tool,
              title: tasks[tool]?.title ?? TOOL_LABELS[tool],
              id: `${tool}-${Date.now()}`,
            },
          ];
        });
      })
    );
    return () => cleanups.forEach((fn) => fn());
  }, [onTaskComplete, tasks]);

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {notifications.map((notif) => (
        <div
          key={notif.id}
          onClick={() => {
            router.push(TOOL_PATHS[notif.tool]);
            setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "rgba(5,12,28,0.97)",
            border: "1px solid rgba(74,197,110,0.3)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            cursor: "pointer",
            animation: "fadeUp 0.3s ease both",
            maxWidth: "300px",
          }}
        >
          <CheckCircle size={14} style={{ color: "#4ac56e", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "10px",
                color: "rgba(74,197,110,0.9)",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {TOOL_LABELS[notif.tool]}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "rgba(200,210,230,0.65)",
                fontFamily: "var(--font-dm-sans)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: "2px",
              }}
            >
              {notif.title}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(180,190,210,0.35)",
              padding: "2px",
              flexShrink: 0,
              display: "flex",
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
