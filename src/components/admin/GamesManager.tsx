"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { GAMES } from "@/lib/games";
import { Chilis } from "@/components/ui/Spice";
import { addIdeas, addQuestions, setGameOn, setIdea, setQuestion } from "@/app/admin/(panel)/games/actions";
import { AdminTitle } from "./AdminShell";

export type TotRow = { id: number; prompt: string; a: string; b: string; spice: number; active: boolean };
export type IdeaRow = { id: number; body: string; active: boolean };
export type GameStats = {
  kinds: { kind: string; challenges: number; started: number; finished: number; declined: number; expired: number; rematches: number; in_people_chats: number }[];
  pairs_with_games: number;
  pairs_with_games_unmasked: number;
  pairs_total: number;
  pairs_unmasked: number;
};

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : "–");

export function GamesManager({
  on,
  questions,
  ideas,
  week,
  today,
}: {
  on: Record<string, boolean>;
  questions: TotRow[];
  ideas: IdeaRow[];
  week: GameStats | null;
  today: GameStats | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => start(() => router.refresh());
  const [qText, setQText] = useState("");
  const [qSpice, setQSpice] = useState(0);
  const [iText, setIText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | "all">("all");

  const shown = questions.filter((q) => filter === "all" || q.spice === filter);

  return (
    <>
      <AdminTitle title="Games" subtitle="In-chat games for masked pairs and connections. Changes apply right away." />

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Games played</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Game</th>
                <th className="px-3 font-semibold">On</th>
                <th className="px-3 font-semibold">Today</th>
                <th className="px-3 font-semibold">Challenges (7d)</th>
                <th className="px-3 font-semibold">Accepted</th>
                <th className="px-3 font-semibold">Finished</th>
                <th className="px-3 font-semibold">Rematches</th>
                <th className="px-3 font-semibold">With connections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {GAMES.map((g) => {
                const w = week?.kinds.find((k) => k.kind === g.kind);
                const d = today?.kinds.find((k) => k.kind === g.kind);
                const isOn = on[g.kind] !== false;
                return (
                  <tr key={g.kind}>
                    <td className="py-3 pr-3 font-semibold">{g.title}</td>
                    <td className="px-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        aria-label={`${g.title} on`}
                        onClick={async () => {
                          const r = await setGameOn(g.kind, !isOn);
                          if (r.error) setNote(r.error);
                          refresh();
                        }}
                        className={clsx("relative h-7 w-12 rounded-full transition", isOn ? "bg-mint" : "bg-line-strong")}
                      >
                        <span className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", isOn ? "left-6" : "left-1")} />
                      </button>
                    </td>
                    <td className="px-3 tabular-nums">{d?.challenges ?? 0}</td>
                    <td className="px-3 tabular-nums">{w?.challenges ?? 0}</td>
                    <td className="px-3 tabular-nums">
                      {w?.started ?? 0} <span className="text-muted">({pct(w?.started ?? 0, w?.challenges ?? 0)})</span>
                    </td>
                    <td className="px-3 tabular-nums">{w?.finished ?? 0}</td>
                    <td className="px-3 tabular-nums">{w?.rematches ?? 0}</td>
                    <td className="px-3 tabular-nums">{w?.in_people_chats ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {week && (
          <div className="mt-4 grid gap-3 rounded-2xl bg-cream p-4 sm:grid-cols-2">
            <div>
              <p className="font-display text-[24px] font-semibold">{pct(week.pairs_with_games_unmasked, week.pairs_with_games)}</p>
              <p className="text-[12px] text-muted">
                of masked pairs who finished a game unmasked ({week.pairs_with_games_unmasked} of {week.pairs_with_games})
              </p>
            </div>
            <div>
              <p className="font-display text-[24px] font-semibold">{pct(week.pairs_unmasked, week.pairs_total)}</p>
              <p className="text-[12px] text-muted">of all hourly pairs unmasked, for comparison ({week.pairs_unmasked} of {week.pairs_total})</p>
            </div>
          </div>
        )}
        {note && <p className="mt-3 text-[13px] font-semibold text-chili">{note}</p>}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">This or That questions</h2>
        <p className="mt-1 text-[13px] text-muted">
          Each game picks 10 at random, up to the pair&apos;s question spice. Connections get up to 1 chili if they met as friends, 2 for dating and 3 for spicy.
        </p>
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <p className="text-[13px] font-semibold">Add questions, one per line</p>
          <textarea
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            rows={4}
            placeholder={"Perfect Saturday night? | Owambe till 4am | Netflix and suya\nPick one forever | Jollof rice | Fried rice"}
            className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-[14px] outline-none focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Spice:</span>
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQSpice(s)}
                className={clsx("inline-flex h-9 items-center rounded-full border px-3 text-[13px]", qSpice === s ? "border-brand bg-brand-soft" : "border-line-strong")}
              >
                {s === 0 ? "Mild" : <Chilis level={s} />}
              </button>
            ))}
            <button
              type="button"
              onClick={async () => {
                const r = await addQuestions(qText, qSpice);
                setNote(r.error ?? `Added ${r.added}.`);
                if (!r.error) setQText("");
                refresh();
              }}
              className="ml-auto h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white"
            >
              Add
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", 0, 1, 2, 3] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={clsx("inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold", filter === f ? "border-brand bg-brand-soft" : "border-line-strong")}
            >
              {f === "all" ? `All · ${questions.length}` : f === 0 ? "Mild" : <Chilis level={f} />}
            </button>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-line">
          {shown.map((q) => (
            <li key={q.id} className={clsx("flex items-center gap-3 py-2.5", !q.active && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{q.prompt}</p>
                <p className="truncate text-[13px] text-muted">
                  {q.a} <span className="font-semibold text-gold">or</span> {q.b}
                </p>
              </div>
              <select
                value={q.spice}
                onChange={async (e) => {
                  await setQuestion(q.id, { spice: Number(e.target.value) });
                  refresh();
                }}
                className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-[13px]"
                aria-label="Spice"
              >
                <option value={0}>Mild</option>
                <option value={1}>🌶</option>
                <option value={2}>🌶🌶</option>
                <option value={3}>🌶🌶🌶</option>
              </select>
              <button
                type="button"
                onClick={async () => {
                  await setQuestion(q.id, { active: !q.active });
                  refresh();
                }}
                className="h-9 rounded-full border border-line-strong px-3 text-[12px] font-semibold"
              >
                {q.active ? "Hide" : "Show"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Two Truths idea chips</h2>
        <p className="mt-1 text-[13px] text-muted">Shown when someone is stuck writing. Four are picked at random each game.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ideas.map((i) => (
            <button
              key={i.id}
              type="button"
              title={i.active ? "Tap to hide" : "Tap to show"}
              onClick={async () => {
                await setIdea(i.id, !i.active);
                refresh();
              }}
              className={clsx("rounded-full border px-3 py-1.5 text-[13px]", i.active ? "border-line-strong bg-cream" : "border-dashed border-line-strong text-muted line-through")}
            >
              {i.body}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <textarea
            value={iText}
            onChange={(e) => setIText(e.target.value)}
            rows={2}
            placeholder={"I have been to…\nMy hidden talent is…"}
            className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface p-3 text-[14px] outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={async () => {
              const r = await addIdeas(iText);
              setNote(r.error ?? `Added ${r.added}.`);
              if (!r.error) setIText("");
              refresh();
            }}
            className="h-10 self-end rounded-full bg-brand px-4 text-[13px] font-semibold text-white"
          >
            Add
          </button>
        </div>
      </section>
    </>
  );
}
