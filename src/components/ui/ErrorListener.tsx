"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

// Noise from browsers and extensions, not from Dashpad
const IGNORE = /ResizeObserver loop|Script error\.?$|extension:\/\/|Load failed|Failed to fetch|NetworkError|AbortError|The operation was aborted|Non-Error promise rejection|ChunkLoadError|Loading chunk/i;

/** Catches errors that don't crash a screen (a broken button, a failed background job) */
export function ErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const err = e.error ?? new Error(e.message);
      if (IGNORE.test(String(e.message)) || IGNORE.test(String(e.filename ?? ""))) return;
      reportError(err, "hidden");
    };
    const onReject = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg = r instanceof Error ? r.message : typeof r === "string" ? r : "";
      if (!msg || IGNORE.test(msg) || (r instanceof Error && IGNORE.test(r.name))) return;
      reportError(r instanceof Error ? r : new Error(msg), "hidden");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}
