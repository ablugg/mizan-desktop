"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AttorneySignUpPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/attorney/research");
  }, [router]);
  return null;
}
