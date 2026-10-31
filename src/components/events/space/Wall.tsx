"use client";

import { sexLabel } from "@/lib/eventSpace";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Eye, MessageCircle, RefreshCw, Shapes, Users } from "lucide-react";
import type { WallPerson } from "@/lib/events";
import { BlurPhoto } from "./common";

const AGE_BANDS = [
  { key: "all", label: "All ages", test: () => true },
  { key: "u25", label: "Under 25", test: (a: number) => a < 25 },
  { key: "25", label: "25–34", test: (a: number) => a >= 25 && a < 35 },
  { key: "35", label: "35+", test: (a: number) => a >= 35 },
] as const;

/** Everyone at the event, photos blurred until you reveal them. */
export function Wall({
  people,
  onOpen,
  onRefresh,
  refreshing,
}: {
  people: WallPerson[] | null;
  onOpen: (p: WallPerson) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [band, setBand] = useState<string>("all");
  const bands = useMemo(
    () => AGE_BANDS.filter((b) => b.key === "all" || (people ?? []).some((p) => p.age != null && b.test(p.age))),
    [people],
  );
  const test = AGE_BANDS.find((b) => b.key === band)?.test ?? (() => true);
  const shown = (people ?? []).filter((p) => band === "all" || (p.age != null && test(p.age)));

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">Who&apos;s here</h2>
          <p className="text-[13px] text-muted">Most in common first · tap someone to say hi</p>
        </div>
        <button
          onClick={onRefresh}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-card transition active:scale-95"
          aria-label="Refresh"
        >
          <RefreshCw size={17} className={clsx(refreshing && "animate-spin")} />
        </button>
      </div>

      {bands.length > 2 && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {bands.map((b) => (
            <button
              key={b.key}
              onClick={() => setBand(b.key)}
              className={clsx(
                "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition",
                band === b.key ? "bg-ink text-white" : "border border-line bg-surface text-ink-soft",
              )}
              aria-pressed={band === b.key}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {people === null ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-line/60" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-line bg-surface px-6 py-10 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Users size={26} />
          </span>
          <p className="mt-4 text-[16px] font-semibold">{people.length ? "Nobody in this age range" : "No one else here yet"}</p>
          <p className="mt-1 text-[14px] text-muted">{people.length ? "Try another filter." : "People are arriving — check back in a minute."}</p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => (
            <li key={p.user_id}>
              <button
                onClick={() => onOpen(p)}
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-3xl text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
                aria-label={`${p.name}${p.age ? `, ${p.age}` : ""}`}
              >
                <BlurPhoto blur={p.blur} photo={p.photo} alt={p.name} className="absolute inset-0 h-full w-full" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute top-2 right-2 flex gap-1">
                  {p.chat_id && (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white shadow" title="You're chatting">
                      <MessageCircle size={14} />
                    </span>
                  )}
                  {p.revealed && (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink shadow" title="Revealed">
                      <Eye size={14} />
                    </span>
                  )}
                </span>
                <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <span className="block truncate text-[16px] leading-tight font-semibold">
                    {p.name || "Someone"}
                    {p.age ? <span className="font-normal text-white/85">, {p.age}</span> : null}
                  </span>
                  {sexLabel(p.gender) && <span className="block text-[12px] font-medium text-white/85">{sexLabel(p.gender)}</span>}
                  {p.shared > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                      <Shapes size={11} /> {p.shared} in common
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
