"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { deletePact, revealPactNow, savePactDetails, savePactQuestions, setPactStatus, type PactDetails } from "@/app/admin/(panel)/pacts/actions";
import { INTENTS, KIND_LABEL, MAX_QUESTIONS, SEED_QUESTIONS, WEIGHT_LABEL, pactPhase, type Pact, type PactIntent, type PactQuestion, type QuestionKind, type Weight } from "@/lib/pacts";
import { uploadEventFile } from "./eventUpload";

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
  const { reveal_step: step, reveal_stats: st = {} } = pact as Pact & { reveal_step?: string | null; reveal_stats?: Record<string, number> };
  const progress =
    pact.status === "revealed" && step && step !== "done"
      ? `${(st.pairs ?? 0).toLocaleString()} matches made. ${step === "chats" ? "Starting masked chats…" : `Telling everyone: ${(st.told ?? 0).toLocaleString()} notified, ${(st.emailed ?? 0).toLocaleString()} emailed so far…`}`
      : pact.status === "revealed" && step === "done"
        ? `${(st.pairs ?? 0).toLocaleString()} matches from ${(st.people ?? count).toLocaleString()} people · ${(st.told ?? 0).toLocaleString()} notified · ${(st.emailed ?? 0).toLocaleString()} emailed`
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
    closes_at: pact.closes_at,
    reveal_at: pact.reveal_at,
  });
  const [qs, setQs] = useState<PactQuestion[]>(initial);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
      <Link href="/admin/pacts" className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted"><ArrowLeft size={16} /> Pacts</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] leading-tight font-semibold">{pact.name}</h1>
          <p className="mt-1 text-[15px] text-muted">
            <b className="text-ink tabular-nums">{count.toLocaleString()}</b> answered{matches ? <> · <b className="text-ink tabular-nums">{matches.toLocaleString()}</b> matches</> : null} ·{" "}
            {{ draft: "Draft: only you can see it", open: "Live: taking answers", closed: "Answers closed: waiting for reveal night", matching: "Reveal night: matching everyone now", revealed: "Revealed" }[phase]}
          </p>
          {progress && <p className="mt-1 text-[13.5px] font-semibold text-brand">{progress}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {pact.status !== "draft" && (
            <a href={`/pact/${pact.slug}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-[14px] font-semibold"><ExternalLink size={16} /> Open page</a>
          )}
          {pact.status === "draft" && (
            <button disabled={!!busy} onClick={() => run("publish", () => setPactStatus(pact.id, "live"), "Published. The pact is live.")} className="h-11 rounded-full bg-brand px-5 text-[14px] font-semibold text-white disabled:opacity-60">Publish pact</button>
          )}
          {pact.status === "live" && (
            <button disabled={!!busy} onClick={() => run("draft", () => setPactStatus(pact.id, "draft"), "Moved back to draft.")} className="h-11 rounded-full border border-line-strong bg-white px-4 text-[14px] font-semibold disabled:opacity-60">Unpublish</button>
          )}
          {pact.status === "live" && (
            <button
              disabled={!!busy}
              onClick={() => {
                if (busy !== "sure-reveal") return setBusy("sure-reveal");
                run("reveal", () => revealPactNow(pact.id), "Revealed.");
              }}
              onBlur={() => busy === "sure-reveal" && setBusy(null)}
              className={clsx("h-11 rounded-full px-4 text-[14px] font-semibold", busy === "sure-reveal" ? "bg-chili text-white" : "bg-ink text-white")}
            >
              {busy === "sure-reveal" ? "Tap again to reveal now" : busy === "reveal" ? "Matching…" : "Reveal now"}
            </button>
          )}
          {pact.status === "draft" && count === 0 && (
            <button disabled={!!busy} onClick={async () => { const r = await deletePact(pact.id); if (r.error) return say(r.error, true); router.push("/admin/pacts"); }} className="grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-white text-chili" aria-label="Delete pact"><Trash2 size={17} /></button>
          )}
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[17px] font-semibold">Details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">Name</span><input id="d-name" className={field} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Link</span>
            <span className="flex h-11 items-center overflow-hidden rounded-xl border border-line-strong bg-white focus-within:border-brand">
              <span className="pl-3.5 text-[14px] text-muted">/pact/</span>
              <input id="d-slug" className="h-full min-w-0 flex-1 px-1 text-[15px] font-semibold text-brand outline-none" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
            </span>
          </label>
          <label className="grid gap-1.5 md:col-span-2"><span className="text-[13px] font-semibold">Tagline</span><input id="d-tagline" className={field} value={d.tagline} maxLength={160} placeholder="Answer 10 questions. On reveal night, meet the one person most like you." onChange={(e) => setD({ ...d, tagline: e.target.value })} /></label>

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
            <span className="text-[13px] font-semibold">Areas people pick from</span>
            <input id="d-areas" className={field} value={d.areas.join(", ")} placeholder="Island, Mainland" onChange={(e) => setD({ ...d, areas: e.target.value.split(",").map((x) => x.trimStart()) })} />
            <span className="text-[12px] text-muted">Separate with commas. Same area counts a little extra. Leave empty to skip.</span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Only for emails ending in (optional)</span>
            <input id="d-domain" className={field} value={d.email_domain ?? ""} placeholder="e.g. school.edu.ng" onChange={(e) => setD({ ...d, email_domain: e.target.value })} />
            <span className="text-[12px] text-muted">For school or company pacts. People log in with that email to take part.</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button disabled={!!busy} onClick={() => run("details", () => savePactDetails(pact.id, { ...d, areas: d.areas.map((a) => a.trim()).filter(Boolean) }), "Details saved.")} className="h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white disabled:opacity-60">
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
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-lift">
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
        {count > 0 && <p className="mt-3 rounded-2xl bg-gold-soft px-4 py-2.5 text-[13px] text-[#7a5208]">{count.toLocaleString()} people have answered. Editing answers is fine, but removing a question or answer means earlier answers to it won&apos;t count.</p>}

        <ol className="mt-4 grid gap-2">
          {qs.map((q, i) => {
            const open = openQ === q.id;
            return (
              <li key={q.id} className="rounded-2xl border border-line">
                <div className="flex items-center gap-3 px-3 py-2.5">
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
        <div className="mt-5 flex justify-end">
          <button disabled={!!busy} onClick={() => run("questions", () => savePactQuestions(pact.id, qs), "Questions saved.")} className="h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white disabled:opacity-60">
            {busy === "questions" ? "Saving…" : "Save questions"}
          </button>
        </div>
      </section>

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
  const setOpt = (id: string, p: Partial<PactQuestion["options"][number]>) => patch({ options: q.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  return (
    <div className="grid gap-4 border-t border-line px-4 py-4 md:grid-cols-2">
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
          <option value="strong">Strong: counts double</option>
          <option value="dealbreaker">Deal-breaker: different answers never match for love or spicy</option>
        </select>
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
              <label className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-line-strong bg-white text-muted" aria-label="Add a picture">
                {o.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={16} />
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0], (url) => setOpt(o.id, { image: url }))} />
              </label>
            )}
            <input className={field} value={o.label} maxLength={60} placeholder={q.kind === "scale" ? (i === 0 ? "Homebody" : "Life of the party") : `Answer ${i + 1}`} onChange={(e) => setOpt(o.id, { label: e.target.value })} />
            {o.image && <button type="button" onClick={() => setOpt(o.id, { image: null })} className="shrink-0 text-[12px] font-semibold text-muted">No picture</button>}
            {!fixed && q.options.length > 2 && (
              <button type="button" onClick={() => patch({ options: q.options.filter((x) => x.id !== o.id) })} aria-label="Remove answer" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-chili hover:bg-chili-soft"><X size={16} /></button>
            )}
          </div>
        ))}
        {!fixed && q.options.length < 40 && (
          <button type="button" onClick={() => patch({ options: [...q.options, { id: newId(), label: "" }] })} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 text-[13.5px] font-semibold text-ink-soft"><Plus size={15} /> Add an answer</button>
        )}
      </div>
    </div>
  );
}
