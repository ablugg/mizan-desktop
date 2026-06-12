"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type Jurisdiction = "sa" | "uk";

export interface JurisdictionConfig {
  label: string;
  flag: string;
  systemName: string;
  // dark mode
  accent: string;
  accentRgb: string;
  pageBg: string;
  sidebarBg: string;
  sidebarGlow: string;
  // light mode
  lightAccent: string;
  lightAccentRgb: string;
  lightPageBg: string;
  lightSidebarBg: string;
  lightSidebarGlow: string;
  // overlay colours for the theme-switch ripple animation
  darkOverlay: string;
  lightOverlay: string;
}

export const JURISDICTIONS: Record<Jurisdiction, JurisdictionConfig> = {
  sa: {
    label: "Saudi Arabia",
    flag: "🇸🇦",
    systemName: "Saudi & GCC Law",
    accent: "#c9a84c",
    accentRgb: "201,168,76",
    pageBg: "#060d1a",
    sidebarBg: "linear-gradient(180deg, #060d1a 0%, #08121f 60%, #050c18 100%)",
    sidebarGlow: "rgba(22,90,52,0.22)",
    lightAccent: "#7a5410",
    lightAccentRgb: "122,84,16",
    lightPageBg: "#fafaf7",
    lightSidebarBg: "linear-gradient(180deg, #f5f0e8 0%, #ede7d8 60%, #e6deca 100%)",
    lightSidebarGlow: "rgba(180,140,50,0.10)",
    darkOverlay: "rgba(6,13,26,0.88)",
    lightOverlay: "rgba(250,250,247,0.88)",
  },
  uk: {
    label: "United Kingdom",
    flag: "🇬🇧",
    systemName: "English & Welsh Law",
    accent: "#3e8f62",
    accentRgb: "62,143,98",
    pageBg: "#040c07",
    sidebarBg: "linear-gradient(180deg, #040c07 0%, #060f09 60%, #030b05 100%)",
    sidebarGlow: "rgba(30,100,55,0.22)",
    lightAccent: "#1f5e3a",
    lightAccentRgb: "31,94,58",
    lightPageBg: "#f5faf6",
    lightSidebarBg: "linear-gradient(180deg, #edf5ef 0%, #e3f0e6 60%, #daeadd 100%)",
    lightSidebarGlow: "rgba(50,130,80,0.10)",
    darkOverlay: "rgba(4,12,7,0.88)",
    lightOverlay: "rgba(245,250,246,0.88)",
  },
};

interface JurisdictionContextValue {
  activeJurisdiction: Jurisdiction;
  installedJurisdictions: Jurisdiction[];
  jConfig: JurisdictionConfig;
  setActiveJurisdiction: (j: Jurisdiction) => void;
}

const JurisdictionContext = createContext<JurisdictionContextValue | null>(null);

export function useJurisdiction() {
  const ctx = useContext(JurisdictionContext);
  if (!ctx) throw new Error("useJurisdiction must be used inside JurisdictionProvider");
  return ctx;
}

export function JurisdictionProvider({ children }: { children: React.ReactNode }) {
  // Read from localStorage synchronously to avoid flash of SA theme for UK users
  const [activeJurisdiction, setActiveState] = useState<Jurisdiction>(() => {
    if (typeof window === "undefined") return "sa";
    return (localStorage.getItem("mizan-jurisdiction") as Jurisdiction) ?? "sa";
  });
  const [installedJurisdictions, setInstalled] = useState<Jurisdiction[]>(() => {
    if (typeof window === "undefined") return ["sa"];
    try {
      const raw = localStorage.getItem("mizan-jurisdictions");
      return raw ? (JSON.parse(raw) as Jurisdiction[]) : ["sa"];
    } catch { return ["sa"]; }
  });

  useEffect(() => {
    function onJurisdictionChange(e: Event) {
      const j = (e as CustomEvent<{ jurisdiction: Jurisdiction }>).detail.jurisdiction;
      setActiveState(j);
    }
    window.addEventListener("mizan-jurisdiction-change", onJurisdictionChange);
    return () => window.removeEventListener("mizan-jurisdiction-change", onJurisdictionChange);
  }, []);

  function setActiveJurisdiction(j: Jurisdiction) {
    setActiveState(j);
    localStorage.setItem("mizan-jurisdiction", j);
    window.dispatchEvent(new CustomEvent("mizan-jurisdiction-change", { detail: { jurisdiction: j } }));
  }

  return (
    <JurisdictionContext.Provider value={{
      activeJurisdiction,
      installedJurisdictions,
      jConfig: JURISDICTIONS[activeJurisdiction],
      setActiveJurisdiction,
    }}>
      {children}
    </JurisdictionContext.Provider>
  );
}
