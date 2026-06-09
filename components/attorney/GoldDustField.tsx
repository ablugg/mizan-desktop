"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  vy: number;       // upward drift speed
  vx: number;       // horizontal wobble velocity
  phase: number;    // sine wave phase offset
  wobble: number;   // wobble amplitude
  opacity: number;
  maxOpacity: number;
  fadeZone: number; // fraction of screen height for fade in/out
};

function makeParticle(canvasH: number): Particle {
  const r = 0.6 + Math.random() * 1.4;
  return {
    x: Math.random() * window.innerWidth,
    y: canvasH + Math.random() * canvasH * 0.3,
    r,
    vy: 0.18 + Math.random() * 0.32,
    vx: 0,
    phase: Math.random() * Math.PI * 2,
    wobble: 0.08 + Math.random() * 0.18,
    opacity: 0,
    maxOpacity: 0.25 + Math.random() * 0.45,
    fadeZone: 0.18 + Math.random() * 0.1,
  };
}

export function GoldDustField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const COUNT = 110;
    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const p = makeParticle(H);
      // Scatter initial y across the full screen so it doesn't look like a wave
      p.y = Math.random() * H * 1.3;
      return p;
    });

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = W;
      canvas!.height = H;
    }
    window.addEventListener("resize", resize);

    let frame = 0;

    function tick() {
      ctx!.clearRect(0, 0, W, H);
      frame++;

      for (const p of particles) {
        // Wobble horizontal drift via sine
        p.phase += 0.012;
        p.vx = Math.sin(p.phase) * p.wobble;
        p.x += p.vx;
        p.y -= p.vy;

        // Fade in near bottom, fade out near top
        const progress = 1 - p.y / H; // 0 at bottom, 1 at top
        if (progress < p.fadeZone) {
          p.opacity = p.maxOpacity * (progress / p.fadeZone);
        } else if (progress > 1 - p.fadeZone) {
          p.opacity = p.maxOpacity * ((1 - progress) / p.fadeZone);
        } else {
          p.opacity = p.maxOpacity;
        }

        // Reset when off screen
        if (p.y < -10) {
          const fresh = makeParticle(H);
          Object.assign(p, fresh);
        }

        // Draw
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);

        // Slightly vary the gold hue per particle size
        const hue = p.r > 1.5 ? "rgba(201,158,50," : p.r > 1.0 ? "rgba(192,145,38," : "rgba(180,130,28,";
        ctx!.fillStyle = hue + p.opacity + ")";
        ctx!.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
