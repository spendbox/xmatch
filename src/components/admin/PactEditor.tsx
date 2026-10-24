"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, ExternalLink, Eye, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { deletePact, retryPactReveal, revealPactNow, savePactDetails, savePactQuestions, setPactStatus, type PactDetails } from "@/app/admin/(panel)/pacts/actions";
import { ART_LIBRARY, INTENTS, KIND_LABEL, art, MAX_QUESTIONS, SEED_QUESTIONS, WEIGHT_LABEL, pactPhase, people, plural, type Pact, type PactIntent, type PactQuestion, type QuestionKind, type Weight } from "@/lib/pacts";
import { uploadEventFile } from "./eventUpload";
import { AdminAutoRefresh } from "./AdminAutoRefresh";

const ACCENTS = ["#f2c45a", "#ff7ab0", "#2ee88b", "#7cc8ff", "#c48bff", "#ff8a4c", "#ffffff"];
// Reveal times are set in Lagos time (no daylight saving, always UTC+1)
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 16);
const fromLocal = (v: string) => new Date(`${v}:00+01:00`).toISOString();
const newId = () => Math.random().toString(36).slice(2, 8);
const field = "h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] outline-none focus:border-brand";

function blank(kind: QuestionKind): PactQuestion {
  const two = [{ id: "a", label: "" }, { id: "b", label: "" }];
  return {
    id: `new-${newId()}`,
    position: 0,
    kind,
    title: "",
    subtitle: "",
    options: kind === "choose_many" || kind === "choose_one" ? [...two, { id: "c", label: "" }] : kind === "scale" ? [{ id: "a", label: "Not at all" }, { id: "b", label: "Totally" }] : two,
    min_pick: 1,
    max_pick: kind === "choose_many" ? 3 : 1,
    weight: "normal",
  };
}

export function PactEditor({ pact, questions: initial, count, matches }: { pact: Pact; questions: PactQuestion[]; count: number; matches: number }) {
  const router = useRouter();
  const phase = pact.status === "draft" ? "draft" : pactPhase(pact);
  // Reveal night runs in steps; show where it's up to
  const { reveal_step: step, reveal_stats: st = {} } = pact as Pact & { reveal_step?: string | null; reveal_stats?: Record<string, number> & { error?: string; failed_at?: string } };
  const progress =
    pact.status !== "revealed" && step === "match"
      ? "Matching everyone… (this can take a few minutes for a big Link-Up)"
      : pact.status !== "revealed" && step === "ready"
        ? `${plural(st.pairs ?? 0, "match", "matches")} ready from ${people(st.people ?? count)}. Hidden until reveal night.`
        : pact.status === "revealed" && step && step !== "done"
      ? `${plural(st.pairs ?? 0, "match", "matches")} made. ${step === "chats" ? "Starting masked chats…" : `Telling everyone: ${(st.told ?? 0).toLocaleString()} notified, ${(st.emailed ?? 0).toLocaleString()} emailed so far…`}`
      : pact.status === "revealed" && step === "done"
        ? `${plural(st.pairs ?? 0, "match", "matches")} from ${people(st.people ?? count)} · ${(st.told ?? 0).toLocaleString()} notified · ${(st.emailed ?? 0).toLocaleString()} emailed`
        : null;
  const [d, setD] = useState<PactDetails>({
    name: pact.name,
    slug: pact.slug,
    tagline: pact.tagline,
    logo_url: pact.logo_url,
    header_url: pact.header_url,
    accent: pact.accent,
    intents: pact.intents,
    areas: pact.areas,
    email_domain: pact.email_domain,
    button_text: pact.button_text ?? "",
    closes_at: pact.closes_at,
    reveal_at: pact.reveal_at,
  });
  const [qs, setQs] = useState<PactQuestion[]>(initial);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // The areas box keeps exactly what's typed; it's split into a list only when saved
  const [areasText, setAreasText] = useState(pact.areas.join(", "));
  const [sureReveal, setSureReveal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const say = (text: string, bad = false) => {
    setMsg({ text, bad });
    setTimeout(() => setMsg(null), 4000);
  };

  async function run(label: string, fn: () => Promise<{ error?: string; summary?: string }>, ok: string) {
    setBusy(label);
    const r = await fn();
    setBusy(null);
    if (r.error) return say(r.error, true);
    say(r.summary ?? ok);
    router.refresh();
  }

  async function upload(file: File | undefined, set: (url: string) => void) {
    if (!file) return;
    setBusy("upload");
    try {
      const { url } = await uploadEventFile(null, file, "image");
      set(url);
    } catch (e) {
      say(e instanceof Error ? e.message : "The upload didn't finish.", true);
    }
    setBusy(null);
  }

  const patchQ = (id: string, p: Partial<PactQuestion>) => setQs((l) => l.map((q) => (q.id === id ? { ...q, ...p } : q)));
  const move = (i: number, by: number) => setQs((l) => {
    const j = i + by;
    if (j < 0 || j >= l.length) return l;
    const c = l.slice();
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });
  const unusedSeeds = SEED_QUESTIONS.filter((s) => !qs.some((q) => q.title === s.title));

  return (
    <div className="pb-24">
      {pact.status !== "draft" && new Date(pact.closes_at).getTime() <= Date.now() && step !== "done" && <AdminAutoRefresh seconds={10} />}
      <Link href="/admin/pacts" className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted"><ArrowLeft size={16} /> Link-Ups</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] leading-tight font-semibold">{pact.name}</h1>
          <p className="mt-1 text-[15px] text-muted">
            <b className="text-ink tabular-nums">{count.toLocaleString()}</b> answered{matches ? <> · <b className="text-ink tabular-nums">{matches.toLocaleString()}</b> {matches === 1 ? "match" : "matches"}</> : null} ·{" "}
            {{ draft: "Draft: only you can see it", open: "Live: taking answers", closed: "Answers closed: matching people before reveal night", matching: "Reveal night: finishing the matches", revealed: "Revealed" }[phase]}
          </p>
          {progress && <p className="mt-1 text-[13.5px] font-semibold text-brand">{progress}</p>}
          {st.error && step !== "done" && (
            <div className="mt-3 max-w-xl rounded-2xl bg-chili-soft px-4 py-3 text-[13.5px] text-chili">
              <b>Matching hit a problem</b>{st.failed_at ? ` at ${new Date(st.failed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}` : ""}: {st.error}
              <p className="mt-1 text-ink-soft">Nothing is lost. It tries again by itself every minute and carries on from where it stopped.</p>
              <button disabled={!!busy} onClick={() => run("retry", () => retryPactReveal(pact.id), "Running.")} className="mt-2 h-10 rounded-full bg-chili px-4 text-[13.5px] font-semibold text-white disabled:opacity-60">
                {busy === "retry" ? "Trying…" : "Try again now"}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/pacts/${pact.id}/answers`} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-semibold"><BarChart3 size={16} /> Answers</Link>
          <a href={`/link-up/${pact.slug}?preview=1`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-semibold"><Eye size={16} /> Preview</a>
          {pact.status !== "draft" && (
            <a href={`/link-up/${pact.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-semibold"><ExternalLink size={16} /> Open page</a>
          )}
          {pact.status === "draft" && (
            <button disabled={!!busy} onClick={() => run("publish", () => setPactStatus(pact.id, "live"), "Published. The Link-Up is live.")} className="h-11 rounded-full bg-brand px-5 text-[14px] font-semibold text-white disabled:opacity-60">Publish Link-Up</button>
          )}
          {pact.status === "live" && (
            <button disabled={!!busy} onClick={() => run("draft", () => setPactStatus(pact.id, "draft"), "Moved back to draft.")} className="h-11 rounded-full border border-line-strong bg-white px-4 text-[14px] font-semibold disabled:opacity-60">Unpublish</button>
          )}
          {pact.status === "live" && (
            <button
              disabled={!!busy}
              onClick={() => {
                // First tap asks to be sure; the second reveals. It resets after a few seconds.
                if (!sureReveal) {
                  setSureReveal(true);
                  setTimeout(() => setSureReveal(false), 5000);
                  return;
                }
                setSureReveal(false);
                run("reveal", () => revealPactNow(pact.id), "Revealed.");
              }}
              className={clsx("h-11 rounded-full px-4 text-[14px] font-semibold text-white disabled:opacity-60", sureReveal ? "bg-chili" : "bg-ink")}
            >
              {busy === "reveal" ? "Matching…" : sureReveal ? "Tap again to reveal now" : "Reveal now"}
            </button>
          )}
          <button disabled={!!busy} onClick={() => setDeleting(true)} className="grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-white text-chili disabled:opacity-60" aria-label="Delete Link-Up" title="Delete Link-Up"><Trash2 size={17} /></button>
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[17px] font-semibold">Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">Name</span><input id="d-name" className={field} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Link</span>
            <span className="flex h-11 items-center overflow-hidden rounded-xl border border-line-strong bg-white focus-within:border-brand">
              <span className="pl-3.5 text-[14px] text-muted">/link-up/</span>
              <input id="d-slug" className="h-full min-w-0 flex-1 px-1 text-[15px] font-semibold text-brand outline-none" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
            </span>
          </label>
          <label className="grid gap-1.5 md:col-span-2"><span className="text-[13px] font-semibold">Tagline</span><input id="d-tagline" className={field} value={d.tagline} maxLength={160} placeholder="Answer a few questions. On reveal night, meet the one person most like you." onChange={(e) => setD({ ...d, tagline: e.target.value })} /></label>

          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-[13px] font-semibold">Main button text (optional)</span>
            <input id="d-button" className={field} value={d.button_text} maxLength={30} placeholder="Join the Link-Up" onChange={(e) => setD({ ...d, button_text: e.target.value })} />
            <span className="text-[12px] text-muted">The big button on the Link-Up page. Leave empty for &quot;Join the Link-Up&quot;.</span>
          </label>

          <ImageField label="Logo" hint="Square, at least 400 × 400" value={d.logo_url} round busy={busy === "upload"} onFile={(f) => upload(f, (url) => setD((x) => ({ ...x, logo_url: url })))} onClear={() => setD({ ...d, logo_url: null })} />
          <ImageField label="Header image" hint="Wide, about 1200 × 700" value={d.header_url} busy={busy === "upload"} onFile={(f) => upload(f, (url) => setD((x) => ({ ...x, header_url: url })))} onClear={() => setD({ ...d, header_url: null })} />

          <div className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Accent colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => (
                <button key={c} type="button" onClick={() => setD({ ...d, accent: c })} aria-label={c} className={clsx("h-9 w-9 rounded-full border border-line-strong", d.accent === c && "ring-2 ring-brand ring-offset-2")} style={{ background: c }} />
              ))}
              <input type="color" value={d.accent} onChange={(e) => setD({ ...d, accent: e.target.value })} aria-label="Pick any colour" className="h-9 w-12 cursor-pointer rounded-lg border border-line-strong" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-semibold">People can be matched for</span>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((i) => {
                const on = d.intents.includes(i.id);
                return (
                  <button key={i.id} type="button" onClick={() => setD({ ...d, intents: on ? d.intents.filter((x) => x !== i.id) : [...d.intents, i.id as PactIntent] })} className={clsx("h-10 rounded-full border px-4 text-[14px] font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-white text-ink-soft")}>
                    {i.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">Answers close (Lagos time)</span><input id="d-closes" type="datetime-local" className={field} value={toLocal(d.closes_at)} onChange={(e) => e.target.value && setD({ ...d, closes_at: fromLocal(e.target.value) })} /></label>
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">Reveal night (Lagos time)</span><input id="d-reveal" type="datetime-local" className={field} value={toLocal(d.reveal_at)} onChange={(e) => e.target.value && setD({ ...d, reveal_at: fromLocal(e.target.value) })} /></label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Areas people pick from (optional)</span>
            <input id="d-areas" className={field} value={areasText} placeholder="Optional, e.g. Island, Mainland" onChange={(e) => setAreasText(e.target.value)} />
            <span className="text-[12px] text-muted">Optional. Separate with commas. People can skip it, and the same area counts a little extra. Leave empty to not ask.</span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Only for emails ending in (optional)</span>
            <input id="d-domain" className={field} value={d.email_domain ?? ""} placeholder="e.g. school.edu.ng" onChange={(e) => setD({ ...d, email_domain: e.target.value })} />
            <span className="text-[12px] text-muted">For school or company Link-Ups. People log in with that email to take part.</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button disabled={!!busy} onClick={() => run("details", () => savePactDetails(pact.id, { ...d, areas: areasText.split(",").map((a) => a.trim()).filter(Boolean) }), "Details saved.")} className="h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white disabled:opacity-60">
            {busy === "details" ? "Saving…" : "Save details"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">Questions</h2>
            <p className="mt-0.5 text-[13.5px] text-muted">{qs.length} of up to {MAX_QUESTIONS}. People answer them in this order, then tell us about themselves.</p>
          </div>
          <div className="relative">
            <button onClick={() => setAdding((v) => !v)} disabled={qs.length >= MAX_QUESTIONS} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-soft px-4 text-[14px] font-semibold text-brand disabled:opacity-50"><Plus size={16} /> Add a question</button>
            {adding && (
              <div className="absolute left-0 z-10 mt-2 w-72 max-w-[calc(100vw-3rem)] sm:right-0 sm:left-auto rounded-2xl border border-line bg-white p-2 shadow-lift">
                {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => (
                  <button key={k} onClick={() => { const q = blank(k); setQs((l) => [...l, q]); setOpenQ(q.id); setAdding(false); }} className="block w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold hover:bg-cream">
                    {KIND_LABEL[k]}
                    <span className="block text-[12px] font-normal text-muted">{{ this_or_that: "Two choices, side by side, with pictures", choose_one: "One answer from a list", choose_many: "Pick a few, like top 5 artists", scale: "1 to 5 between two ends" }[k]}</span>
                  </button>
                ))}
                {unusedSeeds.length > 0 && <p className="mt-1 border-t border-line px-3 pt-2 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">Ready-made</p>}
                {unusedSeeds.map((s) => (
                  <button key={s.title} onClick={() => { setQs((l) => [...l, { ...s, id: `new-${newId()}`, position: 0 }]); setAdding(false); }} className="block w-full rounded-xl px-3 py-2 text-left text-[13.5px] hover:bg-cream">{s.title}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        {count > 0 && <p className="mt-3 rounded-2xl bg-gold-soft px-4 py-2.5 text-[13px] text-[#7a5208]">{people(count)} {count === 1 ? "has" : "have"} answered. Editing answers is fine, but removing a question or answer means earlier answers to it won&apos;t count.</p>}

        <ol className="mt-4 grid grid-cols-1 gap-2">
          {qs.map((q, i) => {
            const open = openQ === q.id;
            return (
              <li key={q.id} className="min-w-0 rounded-2xl border border-line">
                <div className="flex items-center gap-1.5 px-2 py-2.5 sm:gap-3 sm:px-3">
                  <span className="w-6 text-center text-[13px] font-bold text-muted tabular-nums">{i + 1}</span>
                  <button onClick={() => setOpenQ(open ? null : q.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-semibold">{q.title || <span className="text-muted">Untitled question</span>}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {KIND_LABEL[q.kind]} · {q.options.map((o) => o.label).filter(Boolean).slice(0, 4).join(" / ")}{q.options.length > 4 ? ` +${q.options.length - 4}` : ""}
                    </span>
                  </button>
                  <span className={clsx("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold sm:block", q.weight === "dealbreaker" ? "bg-chili-soft text-chili" : q.weight === "strong" ? "bg-gold-soft text-[#9a6a0c]" : "bg-cream text-muted")}>{WEIGHT_LABEL[q.weight]}</span>
                  <button onClick={() => move(i, -1)} aria-label="Move up" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream"><ArrowUp size={15} /></button>
                  <button onClick={() => move(i, 1)} aria-label="Move down" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream"><ArrowDown size={15} /></button>
                  <button onClick={() => setQs((l) => l.filter((x) => x.id !== q.id))} aria-label="Remove question" className="grid h-8 w-8 place-items-center rounded-lg text-chili hover:bg-chili-soft"><Trash2 size={15} /></button>
                </div>
                {open && <QuestionForm q={q} patch={(p) => patchQ(q.id, p)} upload={upload} busy={busy === "upload"} />}
              </li>
            );
          })}
        </ol>
        <div className="sticky bottom-4 z-10 mt-5 flex justify-end">
          <button disabled={!!busy} onClick={() => run("questions", () => savePactQuestions(pact.id, qs), "Questions saved.")} className="h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white shadow-lift disabled:opacity-60">
            {busy === "questions" ? "Saving…" : "Save questions"}
          </button>
        </div>
      </section>

      {deleting && <DeletePact pact={pact} count={count} onClose={() => setDeleting(false)} onDeleted={() => router.push("/admin/pacts")} />}

      {msg && (
        <div className={clsx("fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-[14px] font-semibold text-white shadow-lift", msg.bad ? "bg-chili" : "bg-ink")} role="status">{msg.text}</div>
      )}
    </div>
  );
}

function ImageField({ label, hint, value, round, busy, onFile, onClear }: { label: string; hint: string; value: string | null; round?: boolean; busy: boolean; onFile: (f: File | undefined) => void; onClear: () => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-cream/50 p-3">
        <span className={clsx("relative grid shrink-0 place-items-center overflow-hidden bg-white text-muted", round ? "h-16 w-16 rounded-full" : "h-16 w-28 rounded-xl")}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={20} />
          )}
        </span>
        <span className="min-w-0 flex-1 text-[13px] text-muted">{hint}</span>
        <label className="cursor-pointer rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink shadow-card">
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {value && <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"><X size={15} /></button>}
      </div>
    </div>
  );
}

function QuestionForm({ q, patch, upload, busy }: { q: PactQuestion; patch: (p: Partial<PactQuestion>) => void; upload: (f: File | undefined, set: (url: string) => void) => void; busy: boolean }) {
  const fixed = q.kind === "this_or_that" || q.kind === "scale";
  const [picking, setPicking] = useState<string | null>(null);
  const setOpt = (id: string, p: Partial<PactQuestion["options"][number]>) => patch({ options: q.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-line px-3 py-4 sm:px-4 md:grid-cols-2">
      <label className="grid gap-1.5 md:col-span-2"><span className="text-[13px] font-semibold">Question</span><input className={field} value={q.title} maxLength={90} placeholder="Your ideal Friday night" onChange={(e) => patch({ title: e.target.value })} /></label>
      <label className="grid gap-1.5">
        <span className="text-[13px] font-semibold">Type</span>
        <select className={field} value={q.kind} onChange={(e) => {
          const kind = e.target.value as QuestionKind;
          const b = blank(kind);
          const keep = q.options.filter((o) => o.label);
          patch({ kind, options: kind === "this_or_that" || kind === "scale" ? (keep.length >= 2 ? keep.slice(0, 2) : b.options) : keep.length >= 2 ? keep : b.options, max_pick: b.max_pick, min_pick: 1 });
        }}>
          {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13px] font-semibold">How much it counts</span>
        <select className={field} value={q.weight} onChange={(e) => patch({ weight: e.target.value as Weight })}>
          <option value="normal">Normal</option>
          <option value="strong">Strong (counts double)</option>
          <option value="dealbreaker">Deal-breaker (love and spicy)</option>
        </select>
        {q.weight === "dealbreaker" && <span className="text-[12px] text-muted">People who answer differently are never matched for love or something spicy.</span>}
      </label>
      {q.kind === "choose_many" && (
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">Pick at least</span><input type="number" min={1} max={q.options.length} className={field} value={q.min_pick} onChange={(e) => patch({ min_pick: Number(e.target.value) })} /></label>
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">Pick up to</span><input type="number" min={1} max={q.options.length} className={field} value={q.max_pick} onChange={(e) => patch({ max_pick: Number(e.target.value) })} /></label>
        </div>
      )}
      <div className="grid gap-2 md:col-span-2">
        <span className="text-[13px] font-semibold">{q.kind === "scale" ? "The two ends" : "Answers"}{q.kind !== "scale" && " · a picture is optional"}</span>
        {q.options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            {q.kind !== "scale" && (
              <button type="button" onClick={() => setPicking(o.id)} className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line-strong bg-white text-muted" aria-label={o.image ? "Change picture" : "Add a picture"}>
                {o.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={16} />
                )}
              </button>
            )}
            <input className={clsx(field, "min-w-0")} value={o.label} maxLength={60} placeholder={q.kind === "scale" ? (i === 0 ? "Homebody" : "Life of the party") : `Answer ${i + 1}`} onChange={(e) => setOpt(o.id, { label: e.target.value })} />
            {!fixed && q.options.length > 2 && (
              <button type="button" onClick={() => patch({ options: q.options.filter((x) => x.id !== o.id) })} aria-label="Remove answer" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-chili hover:bg-chili-soft"><X size={16} /></button>
            )}
          </div>
        ))}
        {!fixed && q.options.length < 40 && (
          <button type="button" onClick={() => patch({ options: [...q.options, { id: newId(), label: "" }] })} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 text-[13.5px] font-semibold text-ink-soft"><Plus size={15} /> Add an answer</button>
        )}
      </div>
      {picking && (
        <PicturePicker
          busy={busy}
          has={!!q.options.find((o) => o.id === picking)?.image}
          onClose={() => setPicking(null)}
          onPick={(image) => {
            setOpt(picking, { image });
            setPicking(null);
          }}
          onUpload={(file) => {
            const id = picking;
            setPicking(null);
            upload(file, (url) => setOpt(id, { image: url }));
          }}
        />
      )}
    </div>
  );
}

/** Choose an answer's picture: upload a photo, pick one of Dashpad's drawings, or none */
function PicturePicker({ busy, has, onClose, onPick, onUpload }: { busy: boolean; has: boolean; onClose: () => void; onPick: (image: string | null) => void; onUpload: (file: File | undefined) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Choose a picture" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-xl sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Choose a picture</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream"><X size={18} /></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white">
            <ImagePlus size={16} /> Upload a photo
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
          {has && <button type="button" onClick={() => onPick(null)} className="h-10 rounded-full border border-line-strong px-4 text-[14px] font-semibold">No picture</button>}
        </div>
        <p className="mt-4 mb-2 text-[12px] font-bold tracking-wide text-muted uppercase">Or pick a drawing</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {ART_LIBRARY.map((d) => (
            <button key={d.name} type="button" onClick={() => onPick(art(d.name))} className="group text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art(d.name)} alt="" className="aspect-square w-full rounded-xl transition group-hover:scale-[1.03] group-active:scale-95" loading="lazy" />
              <span className="mt-1 block truncate text-[11.5px] text-muted">{d.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Deleting needs two steps: confirm, then type the pact's name */
function DeletePact({ pact, count, onClose, onDeleted }: { pact: Pact; count: number; onClose: () => void; onDeleted: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = typed.trim().toLowerCase() === pact.name.trim().toLowerCase();
  async function go() {
    if (!match) return;
    setBusy(true);
    setError(null);
    const r = await deletePact(pact.id, typed);
    setBusy(false);
    if (r.error) return setError(r.error);
    onDeleted();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-label="Delete Link-Up" className="w-full rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-chili-soft text-chili"><Trash2 size={20} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[18px] font-semibold">Delete {pact.name}?</h3>
            <p className="mt-1 text-[13.5px] text-muted">
              {count > 0 ? `This deletes the Link-Up, its questions, and the answers and matches of ${people(count)}. ` : "This deletes the Link-Up and its questions. "}
              Masked chats people already started stay open. This can&apos;t be undone.
            </p>
          </div>
        </div>
        {step === 1 ? (
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-full border border-line-strong bg-white px-5 text-[14px] font-semibold">Cancel</button>
            <button type="button" onClick={() => setStep(2)} className="h-11 rounded-full bg-chili px-5 text-[14px] font-semibold text-white">Yes, delete</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); go(); }} className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[13px] font-semibold">To confirm, type <b className="select-all text-chili">{pact.name}</b></span>
              <input autoFocus className={field} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={pact.name} autoComplete="off" />
            </label>
            {error && <p className="text-[13.5px] font-medium text-chili">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={onClose} className="h-11 rounded-full border border-line-strong bg-white px-5 text-[14px] font-semibold disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={!match || busy} className="h-11 rounded-full bg-chili px-5 text-[14px] font-semibold text-white disabled:opacity-40">{busy ? "Deleting…" : "Delete forever"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
