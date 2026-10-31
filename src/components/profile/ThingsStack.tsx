"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronRight, Pencil, Plus, X } from "lucide-react";
import { promptOf, splitOwn, type Thing } from "@/lib/things";
import { tapFeedback } from "@/components/ui/Button";

/** A card's two colours, from its prompt: a bright one for the tint, a deep one for the words */
function colours(tone: string) {
  const hex = tone.match(/#[0-9a-f]{6}/gi) ?? [];
  return { light: hex[0] ?? "#6d4ff0", deep: hex[hex.length - 1] ?? "#3a2896" };
}

/** Answer size from its length only (nothing measured, so it shows the same on every phone) */
function answerSize(text: string, big: boolean) {
  const n = text.trim().length;
  if (big) return n <= 30 ? 27 : n <= 80 ? 23 : n <= 140 ? 20 : 18;
  return n <= 30 ? 22 : n <= 80 ? 19 : n <= 140 ? 17 : 16;
}

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The answer, with words you both used marked */
function Answer({ text, shared, deep }: { text: string; shared?: string[]; deep: string }) {
  const words = (shared ?? []).filter((w) => w.length > 2);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(\\b(?:${words.map(escape).join("|")})\\w*)`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="-mx-0.5 rounded-md px-0.5 text-inherit" style={{ background: `${deep}1f`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * One "thing about me": the question on top, the full answer underneath. The card is as tall as
 * its answer needs, so nothing is ever cut off.
 */
export function ThingCard({
  thing,
  big,
  shared,
  onTap,
  editable,
  className,
}: {
  thing: Thing;
  big?: boolean;
  /** Words you both used: marked in the answer */
  shared?: string[];
  onTap?: () => void;
  /** Your own card: shows a pencil */
  editable?: boolean;
  className?: string;
}) {
  const p = promptOf(thing.p);
  const { light, deep } = colours(p.tone);
  // "Something else about me": their own question on top, their answer underneath
  const own = splitOwn(thing);
  const Tag = onTap ? "button" : "article";
  return (
    <Tag
      {...(onTap ? { type: "button" as const, onClick: () => (tapFeedback(), onTap()) } : {})}
      className={clsx(
        "relative flex w-full flex-col overflow-hidden rounded-[22px] border text-left",
        big ? "p-5" : "p-4",
        onTap && "transition active:scale-[0.98]",
        className,
      )}
      style={{ background: `linear-gradient(155deg, ${light}26 0%, ${light}0d 100%), var(--color-surface)`, borderColor: `${light}40` }}
    >
      {/* A big quote mark in the card's colour */}
      <span aria-hidden className={clsx("pointer-events-none absolute font-display leading-none font-bold", big ? "-top-2 right-4 text-[96px]" : "-top-1 right-3 text-[72px]")} style={{ color: `${light}33` }}>
        &rdquo;
      </span>
      <p className={clsx("relative pr-10 font-semibold", big ? "text-[14px]" : "text-[13px]")} style={{ color: deep }}>
        {own.q ?? p.text}
      </p>
      <p
        className={clsx("relative font-display leading-[1.25] font-semibold break-words whitespace-pre-line text-ink", big ? "mt-3" : "mt-2")}
        style={{ fontSize: answerSize(own.a, !!big) }}
      >
        <Answer text={own.a} shared={shared} deep={deep} />
      </p>
      {editable && (
        <span className="relative mt-3 inline-flex items-center gap-1 self-start rounded-full bg-surface/80 px-2.5 py-1 text-[12px] font-semibold" style={{ color: deep }}>
          <Pencil size={12} /> Edit
        </span>
      )}
    </Tag>
  );
}

/** One card on its own (Break the ice shows the card you're replying to) */
export function CardFace({ thing, big, shared }: { thing: Thing; big?: boolean; wide?: boolean; shared?: string[] }) {
  return <ThingCard thing={thing} big={big} shared={shared} className="h-full rounded-none border-0" />;
}

/**
 * "Things about…": the cards side by side. Swipe through them (the next one peeks in from the
 * right), or See all for every card in one list. `onEdit`/`onAdd` are for your own profile.
 */
export function ThingsStack({
  things,
  title,
  onEdit,
  onAdd,
  addLabel,
  shared,
}: {
  things: Thing[];
  title: string;
  /** Your own cards: tap one to change it */
  onEdit?: (i: number) => void;
  /** Your own cards: add another */
  onAdd?: () => void;
  addLabel?: string;
  /** Words you both used: marked on the cards */
  shared?: string[];
}) {
  const [all, setAll] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const n = things.length;
  if (n === 0) return null;
  const single = n === 1 && !onAdd;

  return (
    <div className="mt-2">
      <div
        ref={row}
        onScroll={(e) => {
          const el = e.currentTarget;
          const first = el.firstElementChild as HTMLElement | null;
          const step = (first?.offsetWidth ?? el.clientWidth) + 12;
          setAt(Math.min(n - 1, Math.round(el.scrollLeft / step)));
        }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 no-scrollbar"
        aria-label={title}
      >
        {things.map((t, i) => (
          <div key={i} className={clsx("flex shrink-0 snap-start", single ? "w-full" : "w-[84%] max-w-[320px]")}>
            <ThingCard thing={t} shared={shared} editable={!!onEdit} onTap={() => (onEdit ? onEdit(i) : setAll(i))} />
          </div>
        ))}
        {onAdd && (
          <div className="flex w-[40%] max-w-[160px] shrink-0 snap-start">
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                onAdd();
              }}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[22px] border-2 border-dashed border-line-strong px-3 py-6 text-center text-[13px] font-semibold text-muted transition active:scale-[0.98]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand">
                <Plus size={20} />
              </span>
              {addLabel ?? "Add"}
            </button>
          </div>
        )}
      </div>

      {n > 1 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-1" aria-hidden>
            {things.slice(0, 12).map((_, i) => (
              <span key={i} className={clsx("h-1.5 rounded-full transition-all", i === at ? "w-4 bg-brand" : "w-1.5 bg-ink/15")} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setAll(at);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full px-1 text-[13px] font-semibold text-brand"
          >
            See all {n} <ChevronRight size={16} />
          </button>
        </div>
      )}

      {all !== null && (
        <ThingsViewer
          things={things}
          start={all}
          title={title}
          shared={shared}
          onClose={() => setAll(null)}
          onEdit={
            onEdit &&
            ((i) => {
              setAll(null);
              onEdit(i);
            })
          }
          onAdd={
            onAdd &&
            (() => {
              setAll(null);
              onAdd();
            })
          }
          addLabel={addLabel}
        />
      )}
    </div>
  );
}

/** Every card in one list, full screen, starting at the one you tapped */
export function ThingsViewer({
  things,
  start,
  title,
  onClose,
  onEdit,
  onAdd,
  addLabel,
  shared,
}: {
  things: Thing[];
  start: number;
  title: string;
  onClose: () => void;
  onEdit?: (i: number) => void;
  onAdd?: () => void;
  addLabel?: string;
  shared?: string[];
}) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Start at the card you tapped
    const el = list.current?.children[start] as HTMLElement | undefined;
    if (el && start > 0) list.current?.parentElement?.scrollTo({ top: el.offsetTop - 12 });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-cream animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex w-full max-w-md items-center gap-3 border-b border-line px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{title}</p>
          <p className="text-[13px] text-muted">
            {things.length} {things.length === 1 ? "card" : "cards"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-ink/[0.06] text-ink">
          <X size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={list} className="relative mx-auto w-full max-w-md space-y-3 px-4 pt-3 pb-4">
          {things.map((t, i) => (
            <ThingCard key={i} thing={t} big shared={shared} editable={!!onEdit} onTap={onEdit ? () => onEdit(i) : undefined} />
          ))}
        </div>
        {onAdd && (
          <div className="mx-auto w-full max-w-md px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                onAdd();
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white transition active:scale-[0.98]"
            >
              <Plus size={18} /> {addLabel ?? "Add"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
