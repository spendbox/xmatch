/**
 * Unsent messages: what you typed in a chat stays there if you leave and come back
 * (on this phone, for 3 days).
 */
const PREFIX = "dp_draft_";
const KEEP = 3 * 24 * 3600_000;

export function loadDraft(key: string | undefined): string {
  if (!key) return "";
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return "";
    const d = JSON.parse(raw) as { t: string; at: number };
    if (!d?.t || Date.now() - d.at > KEEP) {
      localStorage.removeItem(PREFIX + key);
      return "";
    }
    return d.t;
  } catch {
    return "";
  }
}

export function saveDraft(key: string | undefined, text: string) {
  if (!key) return;
  try {
    if (text.trim()) localStorage.setItem(PREFIX + key, JSON.stringify({ t: text.slice(0, 4000), at: Date.now() }));
    else localStorage.removeItem(PREFIX + key);
  } catch {
    /* private mode */
  }
}

/** Old drafts are tidied away now and then */
export function sweepDrafts() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      const d = JSON.parse(localStorage.getItem(k) ?? "null") as { at?: number } | null;
      if (!d?.at || Date.now() - d.at > KEEP) localStorage.removeItem(k);
    }
  } catch {
    /* private mode */
  }
}
