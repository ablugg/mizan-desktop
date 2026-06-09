"use client";

import { useEffect } from "react";

interface Props {
  redirectUrl: string;
}

export function TabSessionGuard({ redirectUrl: _redirectUrl }: Props) {
  useEffect(() => {
    sessionStorage.setItem("mizan-tab-active", "1");
    localStorage.setItem("mizan-signed-in", "1");
  }, []);

  return null;
}
