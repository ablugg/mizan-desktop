"use client";

import { useEffect } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  twinkle: boolean;
  duration: number;
  delay: number;
}

// Seeded pseudo-random — SSR and client produce identical values (no hydration mismatch)
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const TWINKLE_DURATIONS = [2, 3, 4.5, 6]; // 4 buckets → browser reuses animation instances

function generateStars(count: number): Star[] {
  const rand = seededRand(0xba5e1);
  return Array.from({ length: count }, () => {
    const twinkle = rand() > 0.75; // ~25% twinkle
    return {
      x: rand() * 100,
      y: rand() * 100,
      r: 0.2 + rand() * 0.5,
      opacity: 0.15 + rand() * 0.65,
      twinkle,
      duration: TWINKLE_DURATIONS[Math.floor(rand() * TWINKLE_DURATIONS.length)],
      delay: -(rand() * 8),
    };
  });
}

const STARS = generateStars(505);

export function StarField() {
  // Inject keyframes once — opacity only (no scale; avoids per-star repaints)
  useEffect(() => {
    const id = "starfield-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes starPulse{0%,100%{opacity:var(--so)}50%{opacity:0.05}}`;
    document.head.appendChild(style);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        contain: "strict",
      }}
    >
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
            background: "white",
            ["--so" as string]: star.opacity,
            opacity: star.opacity,
            ...(star.twinkle ? {
              animation: `starPulse ${star.duration}s ease-in-out ${star.delay}s infinite`,
              willChange: "opacity",
            } : {}),
          }}
        />
      ))}
    </div>
  );
}
