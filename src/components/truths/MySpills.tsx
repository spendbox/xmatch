"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Lock, Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapFeedback } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { formatDuration } from "@/lib/chatMedia";
import { voiceUrl } from "@/lib/voiceDisguise";
import { playIntro, usePlayingIntro } from "@/lib/voiceIntro";
import { DEMO_SPILLS, type MySpill } from "@/lib/truths";

const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const STYLE_NAME: Record<string, string> = { normal: "Real voice", deep: "Deep", light: "Light", robot: "Robot" };

/** Profile: everything you've spilled. Private: only you see it, never on your profile */
export function MySpills({ demo }: { demo?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<MySpill[] | null>(demo ? DEMO_SPILLS : null);
  const [all, setAll] = useState(false);
  const [more, setMore] = useState(false);
  const playing = usePlayingIntro();

  useEffect(() => {
    if (demo) return;
    supabase.rpc("my_spills", { p_limit: 30 }).then(({ data }) => {
      const rows = Array.isArray(data) ? (data as MySpill[]) : [];
      setList(rows);
      setMore(rows.length === 30);
    });
  }, [supabase, demo]);

  async function loadMore() {
    if (!list?.length) return;
    const { data } = await supabase.rpc("my_spills", { p_before: list[list.length - 1].day, p_limit: 30 });
    const rows = Array.isArray(data) ? (data as MySpill[]) : [];
    setList((l) => [...(l ?? []), ...rows]);
    setMore(rows.length === 30);
  }

  // Nothing to show until you've spilled once (or before update 117 runs)
  if (!list?.length) return null;
  const shown = all ? list : list.slice(0, 3);

  return (
    <section className="mt-7">
      <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
        My Spills
        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-muted ring-1 ring-line">
          <Lock size={11} /> Private
        </span>
      </h2>
      <p className="mb-3 text-[13.5px] text-muted">Only you can see these. Your answers never show on your profile, and people only ever see a mask name.</p>
      <ul className="flex flex-col gap-2.5">
        {shown.map((s) => {
          const label = s.options.find((o) => o.id === s.choice)?.label ?? s.choice;
          const pct = s.total ? Math.round((s.same / s.total) * 100) : 0;
          const id = `spill-${s.id}`;
          return (
            <li key={s.id} className="rounded-3xl border border-line bg-surface p-3.5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1a1233]">
                  <MaskIcon className="w-6 text-gold" eyes="#1a1233" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-muted">{fmtDay(s.day)}</p>
                  <p className="text-[15px] leading-snug font-semibold">{s.body}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-bold text-brand">{label}</span>
                    <span className="text-muted">
                      {pct}% agreed · {s.total.toLocaleString()} spilled
                    </span>
                  </p>
                </div>
              </div>
              {s.key && (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-cream px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      if (!demo) playIntro(id, voiceUrl(s.key) ?? undefined);
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white"
                    aria-label={playing === id ? "Pause your voice answer" : "Play your voice answer"}
                  >
                    {playing === id ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                    Your voice{s.seconds ? ` · ${formatDuration(s.seconds)}` : ""}
                    {s.style ? ` · ${STYLE_NAME[s.style] ?? s.style}` : ""}
                  </span>
                  <span className={clsx("shrink-0 text-[12.5px] font-semibold", s.hidden ? "text-chili" : "text-muted")}>
                    {s.hidden ? "Hidden by Dashpad" : `${s.listens} ${s.listens === 1 ? "listen" : "listens"}`}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {(list.length > 3 || more) && (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            if (!all) setAll(true);
            else void loadMore();
          }}
          className={clsx("mt-2.5 flex h-11 w-full items-center justify-center gap-1 rounded-2xl border border-line bg-surface text-[14px] font-semibold text-ink-soft", all && !more && "hidden")}
        >
          {all ? "Show older" : `See all ${list.length}${more ? "+" : ""}`} <ChevronDown size={16} />
        </button>
      )}
    </section>
  );
}
