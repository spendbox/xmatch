"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, UsersRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ExploreList, ExplorePerson, ExploreProfile } from "@/lib/explore";
import { tapFeedback, Spinner } from "@/components/ui/Button";
import { Sticky } from "@/components/ui/Sticky";
import { ExploreProfileSheet } from "./ExploreProfileSheet";

/** The Meet page: people like you in big circles, and a search to find anyone by name */
const KEEP_MS = 10 * 60_000;
const cacheKey = (uid: string) => `dp_meet_${uid}`;

function readCache(uid?: string): ExploreList | null {
  if (!uid) return null;
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey(uid)) ?? "null") as { at: number; data: ExploreList } | null;
    return c && Date.now() - c.at < KEEP_MS ? c.data : null;
  } catch {
    return null;
  }
}
function writeCache(uid: string | undefined, data: ExploreList) {
  if (!uid) return;
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* private mode */
  }
}

export function ExploreScreen({ initial, demoProfile, userId }: { initial: ExploreList | null; demoProfile?: ExploreProfile; userId?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<ExploreList | null>(initial);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExplorePerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(demoProfile?.id ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search as you type (a moment after you stop)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const { data } = await supabase.rpc("explore_people", { p_q: term, p_limit: 60 });
      setResults((data as ExploreList | null)?.people ?? []);
      setSearching(false);
    }, 350);
  }, [q, supabase]);

  async function reload() {
    const { data } = await supabase.rpc("explore_people", { p_limit: 50 });
    if (data) {
      setList(data as ExploreList);
      writeCache(userId, data as ExploreList);
    }
  }

  // Your top 50: from the phone if it's fresh (under 10 minutes old), otherwise from Dashpad
  useEffect(() => {
    if (initial) return;
    const kept = readCache(userId);
    if (kept) setList(kept);
    else void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const people = results ?? list?.people ?? [];
  const searchingNow = results !== null || searching;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 lg:max-w-6xl lg:px-10 lg:pt-10">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight lg:text-[40px]">Meet</h1>
      <p className="mt-1 text-[15px] text-muted">People like you. Photos stay soft until you unlock them or connect.</p>

      <Sticky className="mt-3">
      <label className="relative block lg:max-w-md">
        <span className="sr-only">Search by name</span>
        <Search size={19} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input
          id="explore-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name"
          autoComplete="off"
          className="h-12 w-full rounded-full border border-line-strong bg-surface pr-11 pl-11 text-[15px] outline-none focus:border-brand"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5">
            {searching ? <Spinner className="h-4 w-4" /> : <X size={18} />}
          </button>
        )}
      </label>
      </Sticky>

      <h2 className="mt-4 mb-4 text-[15px] font-semibold">{searchingNow ? (searching ? "Searching…" : `${people.length} ${people.length === 1 ? "person" : "people"} found`) : "Your closest matches"}</h2>

      {people.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {people.map((p) => (
            <li key={p.id} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setOpen(p.id);
                }}
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[22px] bg-brand-soft text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
                aria-label={p.name}
              >
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                    // Softly blurred until you're connected, so you can just make them out
                    style={p.connected ? undefined : { filter: "blur(7px)", transform: "scale(1.1)" }}
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-[40px] font-semibold text-brand">{p.name.charAt(0)}</span>
                )}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                {p.online && (
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 py-0.5 pr-2 pl-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-[#7dffb5]" /> Online
                  </span>
                )}
                {p.connected && (
                  <span className="absolute top-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-white ring-2 ring-white/80" title="You're connected">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <span className="block truncate text-[16px] leading-tight font-semibold">
                    {p.name.split(" ")[0]}
                  </span>
                  {p.place && <span className="mt-0.5 block truncate text-[12px] text-white/75">{p.place.split(",")[0]}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : !list && !searchingNow ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Loading">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="aspect-[3/4] animate-pulse rounded-[22px] bg-ink/[0.06]" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </ul>
      ) : (
        !searching && (
          <div className="flex flex-col items-center rounded-[32px] border border-line bg-surface px-6 py-10 text-center shadow-card">
            <span className="grid h-16 w-16 animate-float place-items-center rounded-2xl bg-brand-soft text-brand">
              <UsersRound size={30} />
            </span>
            <h3 className="mt-5 text-[20px] font-semibold">{searchingNow ? "Nobody by that name" : "Nobody here yet"}</h3>
            <p className="mt-1.5 max-w-sm text-[15px] text-muted">
              {searchingNow ? "Check the spelling, or try their first name." : "As more people join, they'll show up here."}
            </p>
          </div>
        )
      )}

      <div className="h-6" />

      {open && <ExploreProfileSheet personId={open} demo={demoProfile} onClose={() => setOpen(null)} onChanged={reload} />}
    </main>
  );
}
