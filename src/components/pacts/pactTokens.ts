// Private links to pacts taken on this phone before having an account. They're attached to the account after sign-up.
const TOKENS = "dp_pacts";

export function savedPactTokens(): { slug: string; token: string }[] {
  try {
    const v = JSON.parse(localStorage.getItem(TOKENS) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function rememberToken(slug: string, token: string) {
  try {
    const list = savedPactTokens().filter((t) => t.slug !== slug);
    localStorage.setItem(TOKENS, JSON.stringify([...list, { slug, token }].slice(-20)));
  } catch {
    /* private mode */
  }
}

/** Once signed in: attach this phone's pacts to the account, then forget them */
export async function claimSavedPacts() {
  const list = savedPactTokens();
  if (!list.length) return;
  try {
    const res = await fetch("/api/pacts/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokens: list.map((t) => t.token) }) });
    if (res.ok) localStorage.removeItem(TOKENS);
  } catch {
    /* try again next time */
  }
}
