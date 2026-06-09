"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Listens for "attorney-nav" custom events dispatched by sidebar links.
 * Fades the screen to dark, navigates, then fades back out — giving a
 * clean cross-dissolve between tool pages.
 */
export function NavTransitionOverlay() {
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

      // Give React one frame to mount the overlay at opacity 0 before transitioning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = overlayRef.current;
          if (el) el.style.opacity = "1";
          // Navigate after fade-out completes
          setTimeout(() => {
            router.push(href);
          }, 180);
        });
      });
    }

    window.addEventListener("attorney-nav", handleNav);
    return () => window.removeEventListener("attorney-nav", handleNav);
  }, [router]);

  // When pathname changes the new page is mounted — start fade-in (overlay fades out)
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
    }, 220);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9989,
        background: "#060d1a",
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity 180ms ease",
      }}
    />
  );
}
