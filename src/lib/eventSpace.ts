/**
 * Helpers for Spotlight Nights and Listening Parties (the "you choose" events):
 * friendly error text, blurred photo previews and the shared playlist clock.
 */
import type { EventMedia } from "./events";

/** Turn a database error into plain words. */
export function eventError(msg: string | undefined | null, opts: { maxChats?: number; slowMode?: number } = {}) {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("NOT_ENOUGH_KEYS")) return "You're out of Keys. Top up to keep revealing photos.";
  if (msg.includes("MAX_CHATS"))
    return `You've started ${opts.maxChats ?? "the most"} chats tonight — that's the limit. Others can still say hi to you.`;
  if (msg.includes("SLOW_MODE")) return `Slow mode is on — one message every ${opts.slowMode ?? "few"} seconds.`;
  if (msg.includes("SLOW_DOWN")) return "Easy there — one reaction every couple of seconds.";
  if (msg.includes("EVENT_FULL")) return "This event is full.";
  if (msg.includes("Too late")) return "It's too late to decide on this chat now.";
  if (msg.includes("row-level security")) return "You can't send messages here any more.";
  return msg;
}

/**
 * Make a tiny, low-quality copy of a photo to show (blurred with CSS) until
 * someone taps to reveal it. Returns null if the browser can't read the photo.
 */
export function makeBlur(url: string, width = 24): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = (v: string | null) => resolve(v);
    const timer = setTimeout(() => done(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = width;
        const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w)) || w;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return done(null);
        ctx.drawImage(img, 0, 0, w, h);
        const out = c.toDataURL("image/jpeg", 0.5);
        done(out.startsWith("data:image/") && out.length < 8000 ? out : null);
      } catch {
        done(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = url;
  });
}

/** Seconds an item lasts on the shared clock (unknown lengths count as 3 minutes). */
export const itemSeconds = (m: EventMedia) => (m.duration_sec > 0 ? m.duration_sec : 180);

/** Where everyone should be in the playlist right now: which item and how far into it. */
export function playlistPosition(media: EventMedia[], startsAt: string, now = Date.now()) {
  if (!media.length) return null;
  const total = media.reduce((s, m) => s + itemSeconds(m), 0);
  const elapsed = Math.max(0, (now - new Date(startsAt).getTime()) / 1000);
  let t = elapsed % total;
  for (let i = 0; i < media.length; i++) {
    const len = itemSeconds(media[i]);
    if (t < len) return { index: i, offset: t };
    t -= len;
  }
  return { index: 0, offset: 0 };
}

/** The YouTube video id in a link, if it is one. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|live|shorts|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch {
    /* not a link */
  }
  return null;
}

export type StreamType = "youtube" | "hls" | "audio" | "video";

/** What sort of link the event's stream is. */
export function streamType(url: string): StreamType {
  if (youtubeId(url)) return "youtube";
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".m3u8")) return "hls";
  if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/.test(path)) return "audio";
  return "video";
}

/** A stable colour for a person's name in the room. */
export function nameColor(id: string | null) {
  const colors = ["#5b3fd9", "#c2306b", "#0f6b4f", "#c06f12", "#2563eb", "#9333ea", "#0e7490", "#b45309"];
  if (!id) return colors[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

/** "Female", "Male" or "Other" — shown even while someone is masked. */
export function sexLabel(g?: string | null) {
  return g === "woman" ? "Female" : g === "man" ? "Male" : g === "other" ? "Other" : "";
}
