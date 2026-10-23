"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, UsersRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ExploreList, ExplorePerson, ExploreProfile } from "@/lib/explore";
import { tapFeedback, Spinner } from "@/components/ui/Button";
import { ExploreProfileSheet } from "./ExploreProfileSheet";

/** The Meet page: people like you in big circles, and a search to find anyone by name */
export function ExploreScreen({ initial, demoProfile }: { initial: ExploreList | null; demoProfile?: ExploreProfile }) {
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
    const { data } = await supabase.rpc("explore_people", { p_limit: 60 });
    if (data) setList(data as ExploreList);
  }

  const people = results ?? list?.people ?? [];
  const searchingNow = results !== null || searching;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 lg:max-w-6xl lg:px-10 lg:pt-10">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight lg:text-[40px]">Meet</h1>
      <p className="mt-1 text-[15px] text-muted">People like you. Tap someone to see their profile.</p>

      <label className="relative mt-5 block lg:max-w-md">
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

      <h2 className="mt-7 mb-4 text-[15px] font-semibold">{searchingNow ? (searching ? "Searching…" : `${people.length} ${people.length === 1 ? "person" : "people"} found`) : "People like you"}</h2>

      {people.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
          {people.map((p) => (
            <li key={p.id} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  setOpen(p.id);
                }}
                className="group flex w-full flex-col items-center text-center"
                aria-label={`${p.name}${p.age ? `, ${p.age}` : ""}`}
              >
                <span className="relative block aspect-square w-full max-w-[124px]">
                  <span className="absolute inset-0 overflow-hidden rounded-full bg-brand-soft shadow-card ring-[3px] ring-surface transition group-hover:shadow-lift group-active:scale-95">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[28px] font-semibold text-brand">{p.name.charAt(0)}</span>
                    )}
                  </span>
                  {p.online && <span className="absolute right-[9%] bottom-[9%] h-4 w-4 rounded-full bg-mint ring-[3px] ring-cream" aria-label="Online now" />}
                  {p.connected && (
                    <span className="absolute top-[4%] right-[4%] grid h-6 w-6 place-items-center rounded-full bg-brand text-white ring-2 ring-cream" title="You're connected">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="mt-2 block w-full truncate text-[14px] font-semibold">{p.name.split(" ")[0]}</span>
                <span className="block w-full truncate text-[12px] text-muted">{[p.age, p.place?.split(",")[0]].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
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
              {searchingNow ? "Check the spelling, or try their first name." : "As more people join who fit your Masquerade settings, they'll show up here."}
            </p>
          </div>
        )
      )}

      {!searchingNow && people.length > 0 && (
        <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">You see people whose settings fit yours, and yours fit theirs.</p>
      )}
      <div className="h-6" />

      {open && <ExploreProfileSheet personId={open} demo={demoProfile} onClose={() => setOpen(null)} onChanged={reload} />}
    </main>
  );
}
