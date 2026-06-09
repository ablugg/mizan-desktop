"use client";

import { useEffect, useState } from "react";
import { GoldDustField } from "./GoldDustField";

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const rand = seededRand(0xd0c3a7);
const STARS = Array.from({ length: 190 }, () => {
  const tier = rand();
  const r = tier < 0.60
    ? 0.15 + rand() * 0.25
    : tier < 0.90
    ? 0.45 + rand() * 0.50
    : 0.75 + rand() * 0.30;
  return {
    x: rand() * 100,
    y: rand() * 100,
    r,
    opacity: r > 0.95 ? 0.12 + rand() * 0.22 : 0.06 + rand() * 0.18,
    duration: 2.5 + rand() * 5,
    delay: -(rand() * 7),
  };
});

const extraRand = seededRand(0x3a7c0d);
const EXTRA_STARS = Array.from({ length: 175 }, () => {
  const r = 0.30 + extraRand() * 0.55;
  return {
    x: extraRand() * 100,
    y: extraRand() * 100,
    r,
    opacity: 0.05 + extraRand() * 0.16,
    duration: 3 + extraRand() * 5,
    delay: -(extraRand() * 8),
  };
});

export function DocStarField() {
  const [collapsed, setCollapsed] = useState(false);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    setIsLight(localStorage.getItem("attorney-light-mode") === "true");

    const onCollapse = (e: Event) => {
      setCollapsed((e as CustomEvent<{ collapsed: boolean }>).detail.collapsed);
    };
    const onTheme = (e: Event) => {
      setIsLight((e as CustomEvent<{ light: boolean }>).detail.light);
    };
    window.addEventListener("sidebar-collapsed-change", onCollapse);
    window.addEventListener("attorney-theme-change", onTheme);
    return () => {
      window.removeEventListener("sidebar-collapsed-change", onCollapse);
      window.removeEventListener("attorney-theme-change", onTheme);
    };
  }, []);

  useEffect(() => {
    const id = "doc-starfield-kf";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `@keyframes docStarPulse {
      0%,100%{opacity:var(--ds-op);transform:scale(1)}
      50%{opacity:calc(var(--ds-op) * 2.8);transform:scale(1.5)}
    }`;
    document.head.appendChild(s);
  }, []);

  if (isLight) return <GoldDustField />;
  const starColor = "white";
  const opacityScale = 1;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Collapse darkness/warmth overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: isLight
          ? "rgba(180,140,60,0.06)"   // warm gold tint when light + collapsed
          : "rgba(0,0,0,0.72)",        // near-black tint on dark mode collapse
        opacity: collapsed ? 1 : 0,
        transition: "opacity 0.6s ease",
      }} />

      {/* Base stars */}
      {STARS.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.r * 2}px`,
            height: `${star.r * 2}px`,
            borderRadius: "50%",
            background: starColor,
            filter: star.r > 0.95 ? "blur(0.5px)" : "blur(0.3px)",
            ["--ds-op" as string]: Math.min(star.opacity * opacityScale, 1),
            opacity: Math.min(star.opacity * opacityScale, 1),
            animation: `docStarPulse ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}

      {/* Extra stars — fade in on collapse */}
      {EXTRA_STARS.map((star, i) => (
        <div
          key={`x${i}`}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.r * 2}px`,
            height: `${star.r * 2}px`,
            borderRadius: "50%",
            background: starColor,
            filter: "blur(0.3px)",
            ["--ds-op" as string]: Math.min(star.opacity * opacityScale, 1),
            opacity: collapsed ? Math.min(star.opacity * opacityScale, 1) : 0,
            transition: `opacity ${0.4 + (i % 10) * 0.04}s ease ${(i % 8) * 0.03}s`,
            animation: collapsed ? `docStarPulse ${star.duration}s ease-in-out ${star.delay}s infinite` : "none",
          }}
        />
      ))}
    </div>
  );
}
