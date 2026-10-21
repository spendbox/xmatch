"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signedUrl } from "@/lib/chatMedia";

/** Turns a private file path into a link that works for the next hour. */
export function useSignedUrl(path: string | null | undefined, localUrl?: string) {
  const [url, setUrl] = useState<string | null>(localUrl ?? null);
  useEffect(() => {
    if (localUrl) return setUrl(localUrl);
    if (!path) return setUrl(null);
    let alive = true;
    signedUrl(createClient(), path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path, localUrl]);
  return url;
}
