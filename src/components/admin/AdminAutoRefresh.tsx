"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps an admin page fresh while something is running (like matching) */
export function AdminAutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
