"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, ChevronLeft, Dices, PartyPopper, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_ANSWER, MAX_THINGS, NEEDED, nextPrompt, promptOf, type Thing } from "@/lib/things";
import { tapFeedback, Spinner } from "@/components/ui/Button";

/**
 * "Tell us things about you", one card at a time. Each card is a prompt you finish
 * ("My comfort food is… Jollof rice"). Saves after every card, so nothing is lost.
 * `edit` opens one of your things to change or remove it.
 */
export function ThingsDeck({
  open,
  onClose,
  things: initial,
  onSaved,
  edit = null,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  things: Thing[];
  onSaved: (things: Thing[]) => void;
  edit?: number | null;
  /** Design previews: don't save */
  demo?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [things, setThings] = useState<Thing[]>(initial);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [promptId, setPromptId] = useState<string>(() => (edit !== null ? initial[edit]?.p : nextPrompt(initial).id) ?? "else");
  const [answer, setAnswer] = useState(edit !== null ? (initial[edit]?.a ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [n, setN] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  // Which saved card is open (going back to change one), or null for a new card
  const [cursor, setCursor] = useState<number | null>(edit);
  const editing = cursor !== null && cursor < things.length;
  // Opened from Profile to change one card: saving closes it
  const single = edit !== null;
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);
  // Fresh start each time it opens
  useEffect(() => {
    if (!open) return;
    setThings(initial);
    setSkipped([]);
    setCelebrate(false);
    setError(null);
    setCursor(edit);
    setPromptId(edit !== null ? (initial[edit]?.p ?? "else") : nextPrompt(initial).id);
    setAnswer(edit !== null ? (initial[edit]?.a ?? "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  /** Open one of the cards you've already filled in */
  function go(i: number, list = things) {
    setCursor(i);
    setPromptId(list[i].p);
    setAnswer(list[i].a);
    setError(null);
    setN((x) => x + 1);
  }
  /** A fresh card */
  function fresh(list = things) {
    setCursor(null);
    setPromptId(nextPrompt(list, skipped).id);
    setAnswer("");
    setError(null);
    setN((x) => x + 1);
  }

  // Back to the card before (the last one you filled in, from a new card)
  const canBack = !single && !celebrate && (cursor === null ? things.length > 0 : cursor > 0);
  function back() {
    if (!canBack) return;
    tapFeedback();
    go(cursor === null ? things.length - 1 : cursor - 1);
  }

  const prompt = promptOf(promptId);
  const count = things.length;

  async function save(list: Thing[]) {
    if (demo) return list;
    const { data, error: err } = await supabase.rpc("set_things", { p_things: list });
    if (err) throw new Error("Couldn't save. Check your connection and try again.");
    return ((data as { things: Thing[] }).things ?? list) as Thing[];
  }

  async function next() {
    const a = answer.trim();
    if (!a || busy) return;
    // Going back through your cards without changing one: just move on
    if (editing && !single && things[cursor!].a === a) {
      tapFeedback();
      return cursor! + 1 < things.length ? go(cursor! + 1) : fresh();
    }
    setBusy(true);
    setError(null);
    tapFeedback();
    const list = editing ? things.map((t, i) => (i === cursor ? { p: promptId, a } : t)) : [...things, { p: promptId, a }];
    try {
      const saved = await save(list.slice(0, MAX_THINGS));
      setThings(saved);
      onSaved(saved);
      if (single) return onClose();
      if (editing) return cursor! + 1 < saved.length ? go(cursor! + 1, saved) : fresh(saved);
      setAnswer("");
      setN((x) => x + 1);
      if (saved.length === NEEDED) setCelebrate(true);
      else if (saved.length >= MAX_THINGS) onClose();
      else setPromptId(nextPrompt(saved, skipped).id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const saved = await save(things.filter((_, i) => i !== cursor));
      setThings(saved);
      onSaved(saved);
      if (single) return onClose();
      fresh(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function shuffle() {
    tapFeedback();
    const skip = [...skipped, promptId];
    const p = nextPrompt(things, skip);
    // Went through them all: start the skipped ones again
    setSkipped(p.id === "else" && promptId === "else" ? [] : skip);
    setPromptId(p.id === promptId ? nextPrompt(things, []).id : p.id);
    setAnswer("");
    setN((x) => x + 1);
  }

  if (!open || !mounted) return null;
  const left = Math.max(0, NEEDED - count);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/55 p-3 backdrop-blur-sm animate-fade-in sm:items-center" role="dialog" aria-modal="true" aria-label="Things about you">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-sm pb-[env(safe-area-inset-bottom)]">
        {/* The deck behind */}
        <div aria-hidden className="absolute inset-x-6 -top-3 h-full rotate-[-3deg] rounded-[30px] bg-white/25" />
        <div aria-hidden className="absolute inset-x-3 -top-1.5 h-full rotate-[2deg] rounded-[30px] bg-white/40" />

        <div
          key={celebrate ? "done" : `${promptId}-${n}`}
          // Swipe right to go back a card, left for another question
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const st = swipe.current;
            swipe.current = null;
            if (!st || celebrate) return;
            const dx = e.clientX - st.x;
            if (Math.abs(dx) < 70 || Math.abs(e.clientY - st.y) > 50) return;
            if (dx > 0) back();
            else if (!editing && !single) shuffle();
          }}
          className="relative animate-fade-up touch-pan-y overflow-hidden rounded-[30px] p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]"
          style={{ background: celebrate ? "linear-gradient(150deg, #6d4ff0 0%, #c2306b 100%)" : prompt.tone }}
        >
          <div aria-hidden className="absolute -top-16 -right-14 h-44 w-44 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-black/10" />

          <div className="relative flex items-center gap-2">
            {canBack && (
              <button type="button" onClick={back} aria-label="Back to the card before" className="-ml-1 grid h-9 w-9 place-items-center rounded-full bg-white/15">
                <ChevronLeft size={20} />
              </button>
            )}
            <p className="flex-1 text-[12px] font-bold tracking-[0.14em] text-white/80 uppercase">
              {single
                ? "Edit"
                : editing
                  ? `${cursor! + 1} of ${Math.max(NEEDED, count)} · editing`
                  : count < NEEDED
                    ? `${count + 1} of ${NEEDED}`
                    : `Thing ${count + 1}`}
            </p>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
              <X size={18} />
            </button>
          </div>
          {!single && count < NEEDED && (
            <div className="relative mt-2.5 flex gap-1" aria-hidden>
              {Array.from({ length: NEEDED }, (_, i) => (
                <span
                  key={i}
                  className={clsx("h-1.5 flex-1 rounded-full transition", i === (cursor ?? count) ? "bg-white" : i < count ? "bg-white/60" : "bg-white/25")}
                />
              ))}
            </div>
          )}

          {celebrate ? (
            <div className="relative py-6 text-center">
              <span className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-2xl bg-white/20">
                <PartyPopper size={30} />
              </span>
              <p className="mt-4 font-display text-[30px] leading-tight font-semibold">That&apos;s {NEEDED}!</p>
              <p className="mx-auto mt-2 max-w-[260px] text-[14px] leading-relaxed text-white/85">
                We&apos;ll use these to pair you with people you click with. Add as many more as you like.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCelebrate(false);
                    setPromptId(nextPrompt(things, skipped).id);
                  }}
                  className="h-12 rounded-2xl bg-white/15 text-[15px] font-semibold"
                >
                  Add more
                </button>
                <button type="button" onClick={onClose} className="h-12 rounded-2xl bg-white text-[15px] font-bold text-ink">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                void next();
              }}
            >
              <p className="mt-6 font-display text-[30px] leading-[1.1] font-semibold">{prompt.text}</p>
              <textarea
                ref={input}
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/\n/g, " "))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void next();
                  }
                }}
                maxLength={MAX_ANSWER}
                rows={2}
                placeholder="Type your answer"
                autoFocus
                className="mt-4 w-full resize-none rounded-2xl bg-white/15 px-4 py-3 text-[18px] font-semibold text-white outline-none placeholder:font-normal placeholder:text-white/55 focus:bg-white/20"
              />
              {prompt.ideas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {prompt.ideas.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => {
                        tapFeedback();
                        setAnswer(idea);
                        input.current?.focus();
                      }}
                      className={clsx(
                        "rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95",
                        answer === idea ? "bg-white text-ink" : "bg-white/15 text-white",
                      )}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-[13px] font-medium">{error}</p>}

              <div className="mt-6 flex items-center gap-2.5">
                {editing ? (
                  <button type="button" onClick={remove} disabled={busy} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15" aria-label="Remove this one">
                    <Trash2 size={19} />
                  </button>
                ) : (
                  <button type="button" onClick={shuffle} disabled={busy} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white/15 px-4 text-[14px] font-semibold">
                    <Dices size={18} /> Another
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!answer.trim() || busy}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-ink transition active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? <Spinner className="h-4 w-4" /> : <Check size={18} />}
                  {single ? "Save" : editing ? (things[cursor!]?.a === answer.trim() ? "Next" : "Save & next") : left > 1 ? `Next · ${left - 1} to go` : left === 1 ? "Finish" : "Add"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
