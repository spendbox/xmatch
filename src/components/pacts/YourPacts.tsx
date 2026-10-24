"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { intentLabel, type PactIntent } from "@/lib/pacts";
import { PactLogo, pactDate } from "./PactBits";

export type MyPact = {
  slug: string;
  name: string;
  logo_url: string | null;
  accent: string;
  reveal_at: string;
  closes_at: string;
  status: "draft" | "live" | "revealed";
  score: number | null;
  intent: PactIntent | null;
  shared: { q: string; a: string }[] | null;
  session_id: string | null;
  match_alias: string | null;
};

/** Profile: the pacts you took, and who you matched with */
export function YourPacts({ demo }: { demo?: MyPact[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<MyPact[]>(demo ?? []);
  useEffect(() => {
    if (demo) return;
    supabase.rpc("my_pacts").then(({ data }) => Array.isArray(data) && setList(data as MyPact[]));
  }, [supabase, demo]);
  if (!list.length) return null;

  return (
    <section className="mt-7">
      <h2 className="mb-1 text-[15px] font-semibold">Your pacts</h2>
      <p className="mb-3 text-[13.5px] text-muted">Only you can see these. Your answers are also in the things we know about you.</p>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {list.map((p) => {
          const revealed = p.status === "revealed";
          const href = p.session_id ? `/masquerade/${p.session_id}` : `/pact/${p.slug}`;
          return (
            <li key={p.slug} className="min-w-0">
              <Link href={href} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-3 pr-4 shadow-card transition active:scale-[0.98]">
                <PactLogo pact={p} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold">{p.name}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">
                    {revealed && p.match_alias ? (
                      <>
                        Matched with <b className="text-ink">{p.match_alias}</b> · {p.score}% · {intentLabel(p.intent ?? "friendship")}
                      </>
                    ) : revealed ? (
                      "No match this time"
                    ) : new Date(p.reveal_at).getTime() <= Date.now() ? (
                      "Matching everyone now · your match arrives in minutes"
                    ) : new Date(p.closes_at).getTime() > Date.now() ? (
                      `Answered · you can change answers until ${pactDate(p.closes_at)}`
                    ) : (
                      `Matching now · revealed ${pactDate(p.reveal_at)}`
                    )}
                  </span>
                </span>
                {revealed && p.session_id ? (
                  <span className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white">Open chat</span>
                ) : (
                  <ChevronRight size={18} className="shrink-0 text-muted" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
