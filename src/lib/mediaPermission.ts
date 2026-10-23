"use client";

/**
 * Microphone and camera permission. Websites can't switch these on themselves
 * or open the phone's settings; the best we can do is ask (which shows the
 * phone's own "Allow?" pop-up) and, if it was blocked before, show the exact
 * steps for this phone.
 */
export type MediaKind = "audio" | "video";
export type MediaState = "granted" | "denied" | "prompt" | "unknown";
export type Device = "iphone" | "iphone-app" | "android" | "android-app" | "computer";

export function device(): Device {
  if (typeof navigator === "undefined") return "computer";
  const ua = navigator.userAgent;
  const app =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return app ? "iphone-app" : "iphone";
  if (/android/i.test(ua)) return app ? "android-app" : "android";
  return "computer";
}

/** What the browser says right now (iPhones can't tell us until we ask) */
export async function mediaState(kind: MediaKind): Promise<MediaState> {
  try {
    const names = kind === "video" ? ["microphone", "camera"] : ["microphone"];
    const results = await Promise.all(names.map((n) => navigator.permissions.query({ name: n as PermissionName })));
    if (results.some((r) => r.state === "denied")) return "denied";
    if (results.every((r) => r.state === "granted")) return "granted";
    return "prompt";
  } catch {
    return "unknown";
  }
}

/** Ask for access (shows the phone's pop-up if it hasn't been answered yet) */
export async function requestMedia(kind: MediaKind): Promise<"granted" | "denied" | "unsupported"> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
    s.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return name === "NotFoundError" || name === "OverconstrainedError" ? "unsupported" : "denied";
  }
}

/** Open the "let Dashpad use your microphone/camera" help from anywhere */
export function showMediaHelp(kind: MediaKind = "audio") {
  window.dispatchEvent(new CustomEvent("dp:media-help", { detail: { kind } }));
}
