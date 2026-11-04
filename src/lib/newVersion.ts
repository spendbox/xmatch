"use client";

/**
 * "Loading chunk … failed": the app was updated while this page was open, so the files it asks
 * for are gone. Not a bug — loading the page again picks up the new version.
 */
export function isOldVersionError(error: unknown) {
  const e = error as { name?: string; message?: string } | null;
  return /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${e?.name ?? ""} ${e?.message ?? ""}`);
}

/** Reloads once to get the new version. False if it already tried just now (so it never loops). */
export function reloadForNewVersion() {
  try {
    const KEY = "dp_new_version_reload";
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}
