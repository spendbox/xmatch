"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { createPact } from "@/app/admin/(panel)/pacts/actions";
import { pactPhase } from "@/lib/pacts";
import { pactDate } from "@/components/pacts/PactBits";
import { AdminTitle } from "./AdminShell";

export type AdminPact = {
  id: string;
  slug: string;
  name: string;
  accent: string;
  logo_url: string | null;
  status: "draft" | "live" | "revealed";
  closes_at: string;
  reveal_at: string;
  matched_at: string | null;
  created_at: string;
  count: number;
  matches: number;
};

const slugify = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function PactsAdmin({ pacts }: { pacts: AdminPact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(pacts.length === 0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await createPact(name, slug);
    setBusy(false);
    if (r.error || !r.id) return setError(r.error ?? "Couldn't create the pact.");
    router.push(`/admin/pacts/${r.id}`);
  }

  return (
    <div>
      <AdminTitle
        title="Pacts"
        subtitle="Questionnaire events. People answer, and on reveal night everyone gets their one best match."
        action={
          <button onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white">
            <Plus size={18} /> New pact
          </button>
        }
      />
      {open && (
        <form onSubmit={create} className="mb-6 grid gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Name</span>
            <input
              id="pact-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!edited) setSlug(slugify(e.target.value));
              }}
              placeholder="The Lagos Pact"
              className="h-11 rounded-xl border border-line-strong bg-white px-3.5 text-[15px] outline-none focus:border-brand"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Link</span>
            <span className="flex h-11 items-center overflow-hidden rounded-xl border border-line-strong bg-white focus-within:border-brand">
              <span className="pl-3.5 text-[14px] text-muted">/pact/</span>
              <input
                id="pact-slug"
                value={slug}
                onChange={(e) => {
                  setEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="lagos"
                className="h-full min-w-0 flex-1 px-1 text-[15px] font-semibold text-brand outline-none"
              />
            </span>
          </label>
          <button disabled={busy} className="h-11 rounded-full bg-ink px-5 text-[14px] font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create"}</button>
          {error && <p className="text-[14px] font-medium text-chili sm:col-span-3">{error}</p>}
          <p className="text-[13px] text-muted sm:col-span-3">It starts as a draft with 10 ready-made questions. Nobody can see it until you publish.</p>
        </form>
      )}
      {pacts.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-[15px] text-muted">No pacts yet. Create the first one above.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pacts.map((p) => {
            const phase = p.status === "draft" ? "draft" : pactPhase(p);
            const badge = { draft: ["Draft", "bg-cream text-ink-soft"], open: ["Live", "bg-mint text-white"], closed: ["Answers closed", "bg-gold-soft text-[#9a6a0c]"], revealed: ["Revealed", "bg-line text-muted"] }[phase];
            return (
              <li key={p.id}>
                <Link href={`/admin/pacts/${p.id}`} className="flex gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition hover:border-brand/40">
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full font-display text-[18px] font-bold text-[#1c1310]" style={{ background: p.accent }}>
                    {p.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      p.name.replace(/^the\s+/i, "").slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-semibold">{p.name}</span>
                      <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", badge[1])}>{badge[0]}</span>
                    </span>
                    <span className="block truncate text-[13px] text-brand">/pact/{p.slug}</span>
                    <span className="mt-1 block text-[13px] text-muted">
                      <b className="text-ink tabular-nums">{p.count.toLocaleString()}</b> answered
                      {p.matches ? <> · <b className="text-ink tabular-nums">{p.matches.toLocaleString()}</b> matches</> : null} · reveal {pactDate(p.reveal_at)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
