"use client";

import { createEventUpload } from "@/app/admin/(panel)/actions";
import { createClient } from "@/lib/supabase/client";

/** Uploads a file straight from the browser to the event-media bucket. Throws an Error with a plain message. */
export async function uploadEventFile(eventId: string | null, file: File, want: "image" | "media") {
  const ticket = await createEventUpload(eventId, file.name, file.type, file.size, want);
  if ("error" in ticket) throw new Error(ticket.error);
  const { error } = await createClient()
    .storage.from("event-media")
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.contentType, upsert: false });
  if (error) {
    const msg = String(error.message || "");
    if (/size|large|exceed/i.test(msg)) throw new Error("That file is too big. The limit is 50 MB.");
    if (/mime|type/i.test(msg)) throw new Error("That file type isn't allowed.");
    throw new Error("The upload didn't finish. Check your connection and try again.");
  }
  return { url: ticket.publicUrl, kind: ticket.kind };
}

/** How long a song or video is, read by the browser (0 if it can't tell). */
export function readDuration(file: File, kind: "audio" | "video"): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    const src = URL.createObjectURL(file);
    let done = false;
    const finish = (n: number) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(src);
      el.removeAttribute("src");
      resolve(Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => finish(el.duration);
    el.onerror = () => finish(0);
    setTimeout(() => finish(0), 10_000);
    el.src = src;
  });
}

export const fileTitle = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim().slice(0, 120) || "Untitled";

export function formatDuration(sec: number) {
  if (!sec) return "–:––";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
