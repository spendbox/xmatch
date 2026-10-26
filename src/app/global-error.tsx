"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

/** Last resort, when even the page frame fails */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, "app"), [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8f5f0", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 32, color: "#1a1530" }}>
        <p style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 15, color: "#6b6580", marginTop: 8 }}>We&apos;ve been told about it.</p>
        <button type="button" onClick={reset} style={{ marginTop: 24, height: 52, width: 260, borderRadius: 16, border: 0, background: "#5b3fd9", color: "#fff", fontSize: 16, fontWeight: 700 }}>
          Try again
        </button>
        <a href="/home" style={{ marginTop: 10, color: "#5b3fd9", fontWeight: 700, fontSize: 15 }}>
          Go home
        </a>
      </body>
    </html>
  );
}
