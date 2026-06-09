"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Desktop: no external login. The lockdown overlay in the attorney layout
// handles PIN verification. Redirect straight to the workspace.
export default function AttorneyLoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/attorney/research");
  }, [router]);
  return null;
}
