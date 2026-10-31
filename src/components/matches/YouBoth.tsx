"use client";

import { useEffect, useMemo, useState } from "react";
import { Gamepad2, MapPin, Quote, Stamp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InterestIcon } from "@/components/ui/icons";

type InCommon = {
  connected: boolean;
  interests: string[];
  place: string | null;
  tot: { same: number; rounds: number; items: { q: string; a: string }[] };
  words: string[] | null;
  linkups: { count: number; items: { pact: string; q: string; a: string }[] } | null;
};

const list = (w: string[]) => (w.length < 2 ? w[0] : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`);

/**
 * "You both…": what you have in common with someone, on their profile and in a masked chat.
 * Before you're connected: interests, area and This or That picks. After you both unmask: also the
 * words from your things about me, and your Link-Up answers.
 */
export function YouBoth({ other, session, tone = "light", demo }: { other?: string; session?: string; tone?: "light" | "plain"; demo?: InCommon }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<InCommon | null>(demo ?? null);
  useEffect(() => {
    if (demo || (!other && !session)) return;
    supabase.rpc("in_common", { p_other: other ?? null, p_session: session ?? null }).then(({ data: d, error }) => {
      if (!error && d) setData(d as InCommon);
    });
  }, [supabase, other, session, demo]);
  if (!data) return null;

  const rows: { key: string; icon: React.ReactNode; title: string; detail?: string }[] = [];
  if (data.interests?.length) rows.push({ key: "i", icon: <InterestIcon name={data.interests[0]} size={16} />, title: `Like ${list(data.interests.slice(0, 4))}` });
  if (data.place) rows.push({ key: "p", icon: <MapPin size={16} />, title: data.place === "same country" ? "Live in the same country" : `Live in ${data.place}` });
  if (data.tot?.rounds > 0)
    rows.push({
      key: "t",
      icon: <Gamepad2 size={16} />,
      title: `Picked the same in ${data.tot.same} of ${data.tot.rounds} This or That`,
      detail: data.tot.items.length ? data.tot.items.map((x) => x.a).join(" · ") : undefined,
    });
  if (data.words?.length) rows.push({ key: "w", icon: <Quote size={16} />, title: `Mentioned ${list(data.words.slice(0, 4))}` });
  if (data.linkups?.count)
    rows.push({
      key: "l",
      icon: <Stamp size={16} />,
      title: `Gave the same answer to ${data.linkups.count} Link-Up ${data.linkups.count === 1 ? "question" : "questions"}`,
      detail: data.linkups.items.map((x) => `${x.q}: ${x.a}`).join(" · "),
    });
  if (!rows.length) return null;

  return (
    <section className={tone === "light" ? "rounded-3xl bg-surface p-5 shadow-card" : ""} aria-label="What you have in common">
      <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">You both…</h3>
      <ul className="grid gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">{r.icon}</span>
            <span className="min-w-0 pt-1">
              <span className="block text-[14.5px] leading-snug font-semibold">{r.title}</span>
              {r.detail && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!data.connected && <p className="mt-3 text-[12.5px] text-muted">More shows once you&apos;ve both unmasked.</p>}
    </section>
  );
}
