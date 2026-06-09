"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<"idle" | "out" | "in">("idle");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleNav(e: Event) {
      const href = (e as CustomEvent<{ href: string }>).detail.href;
      if (phaseRef.current !== "idle") return;
      phaseRef.current = "out";
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = overlayRef.current;
          if (el) el.style.opacity = "1";
          setTimeout(() => router.push(href), 200);
        });
      });
    }
    window.addEventListener("attorney-nav", handleNav);
    return () => window.removeEventListener("attorney-nav", handleNav);
  }, [router]);

  // pathname changed → new page mounted → fade overlay back out
  useEffect(() => {
    if (phaseRef.current !== "out") return;
    phaseRef.current = "in";
    requestAnimationFrame(() => {
      const el = overlayRef.current;
      if (el) el.style.opacity = "0";
    });
    const t = setTimeout(() => {
      phaseRef.current = "idle";
      setVisible(false);
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ position: "relative" }}>
      {children}
      {visible && (
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9989,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            background: "rgba(6,13,26,0.35)",
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 200ms ease",
          }}
        />
      )}
    </div>
  );
}
