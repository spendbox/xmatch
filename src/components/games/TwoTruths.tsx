"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { BigButton, useTicker, type Names } from "./parts";

const FALLBACK_IDEAS = ["I have been to…", "I can cook…", "I once met…", "My first job was…", "I am scared of…", "I have never…"];
let ideasCache: Promise<string[]> | null = null;
function loadIdeas() {
  ideasCache ??= Promise.resolve(createClient().from("truth_ideas").select("body").eq("active", true).limit(60)).then(({ data }) =>
    data?.length ? data.map((d) => d.body as string) : FALLBACK_IDEAS,
  );
  return ideasCache;
}

export function TwoTruths({
  game,
  names,
  act,
  onResults,
}: {
  game: Game;
  names: Names;
  act: GameActions;
  onResults: () => void;
}) {
  useTicker(250);
  const st = game.state;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const phase: "write" | "guess" | "reveal" = game.status === "active" ? st.phase : st.phase === "reveal" ? "reveal" : st.phase;
  if (phase === "write") return <Write game={game} names={names} act={act} them={them} />;
  if (phase === "guess") return <Guess game={game} names={names} act={act} them={them} />;
  return <Reveal game={game} names={names} onResults={onResults} />;
}

function Header({ sub }: { title?: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-white/75">{sub}</p>
      </div>
    </div>
  );
}

type Truth = { id: number; body: string; uses: number };

function Write({ game, names, act, them }: { game: Game; names: Names; act: GameActions; them: "a" | "b" }) {
  // (A draft can be passed in for design previews)
  const [lines, setLines] = useState<string[]>(game.mine?.draft?.lines ?? ["", "", ""]);
  const [lie, setLie] = useState<number | null>(game.mine?.draft?.lie ?? null);
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);
  // Truths you've used before (kept on your account to use again)
  const [saved, setSaved] = useState<Truth[]>(game.mine?.draft?.saved ?? []);
  const [editing, setEditing] = useState(false);
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const locked = !!game.state[`ready_${game.me}`];
  const theyReady = !!game.state[`ready_${them}`];

  useEffect(() => {
    act.call("my_truths", {}).then(({ data }) => Array.isArray(data) && setSaved(data as Truth[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function forget(t: Truth) {
    setSaved((list) => list.filter((x) => x.id !== t.id));
    await act.call("delete_truth", { p_id: t.id });
  }

  useEffect(() => {
    loadIdeas()
      .then((all) => setIdeas([...all].sort(() => Math.random() - 0.5).slice(0, 4)))
      .catch(() => setIdeas(FALLBACK_IDEAS.slice(0, 4)));
  }, []);

  const ready = lines.every((l) => l.trim().length >= 2) && lie !== null;

  async function lockIn() {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    const { error } = await act.call("submit_truths", { p_game: game.id, p_lines: lines.map((l) => l.trim()), p_lie: lie });
    setBusy(false);
    if (error) return setErr(error);
    sfx("go");
    buzz(20);
  }

  function addIdea(text: string) {
    const target = lines[focus]?.trim() ? lines.findIndex((l) => !l.trim()) : focus;
    const idx = target < 0 ? focus : target;
    setLines((ls) => ls.map((l, k) => (k === idx ? text.replace(/…$/, " ") : l)));
    setTimeout(() => {
      const el = refs.current[idx];
      el?.focus();
      if (el) el.selectionStart = el.selectionEnd = el.value.length;
    }, 0);
  }

  if (locked) {
    return (
      <div className="flex h-full flex-col px-[18px] pt-2 pb-6">
        <Header title="TWO TRUTHS & A LIE" sub="Locked in" />
        <div className="m-auto text-center">
          <span className="gm-burst mx-auto grid h-24 w-24 place-items-center rounded-full bg-gold text-ink shadow-[0_6px_0_#b9831e]">
            <MaskIcon className="w-14" eyes="#f2b33d" />
          </span>
          <p className="mt-5 font-display text-[28px] font-bold">Locked in</p>
          <p className="mt-1 text-[14px] text-white/70">
            {theyReady ? "Both ready. Get set to guess…" : `Waiting for ${names.them} to finish theirs…`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-[18px] pt-2 pb-6">
      <Header title="TWO TRUTHS & A LIE" sub="Round 1 · you write" />
      <h2 className="mt-5 font-display text-[28px] leading-[1.1] font-bold">Write two truths and one lie</h2>
      <p className="mt-1.5 text-[14px] text-white/70">Tap the mask on the one that&apos;s a lie. {names.them} has to find it.</p>

      <div className="mt-4 flex flex-col gap-3">
        {lines.map((l, k) => {
          const filled = l.trim().length > 0;
          const isLie = lie === k;
          return (
            <div
              key={k}
              className={clsx(
                "flex items-start gap-2.5 rounded-[20px] p-3 transition",
                filled || focus === k ? "bg-white text-ink shadow-[0_5px_0_rgba(0,0,0,0.25)]" : "border-[1.5px] border-dashed border-white/30 bg-white/10",
              )}
            >
              <span
                className={clsx(
                  "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-[10px] text-[13px] font-extrabold",
                  filled || focus === k ? "bg-brand-soft text-brand" : "bg-white/15",
                )}
              >
                {k + 1}
              </span>
              <textarea
                ref={(el) => {
                  refs.current[k] = el;
                }}
                rows={2}
                maxLength={120}
                value={l}
                onFocus={() => setFocus(k)}
                onChange={(e) => setLines((ls) => ls.map((x, j) => (j === k ? e.target.value.replace(/\n/g, " ") : x)))}
                placeholder={k === 0 ? "Something true (or not)…" : k === 1 ? "Another one…" : "Write your third…"}
                aria-label={`Statement ${k + 1}`}
                className={clsx(
                  "min-h-[44px] flex-1 resize-none bg-transparent pt-1 text-[16px] leading-snug outline-none",
                  filled || focus === k ? "placeholder:text-muted" : "text-white placeholder:text-white/55",
                )}
              />
              <button
                type="button"
                onClick={() => {
                  setLie(k);
                  sfx("tap");
                  buzz(8);
                }}
                aria-label={isLie ? "Marked as the lie" : "Mark as the lie"}
                className={clsx(
                  "gm-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl transition",
                  isLie ? "-rotate-8 bg-chili text-white shadow-[0_4px_0_#a32a2e]" : "border-[1.5px] border-dashed border-line-strong text-line-strong",
                )}
                style={{ "--edge": "#a32a2e" } as React.CSSProperties}
              >
                <MaskIcon className="w-6" eyes={isLie ? "#e5484d" : "#fff"} />
              </button>
            </div>
          );
        })}
      </div>

      {saved.length > 0 && (
        <section className="mt-4 rounded-[20px] bg-white/8 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-gold uppercase">Your truths</p>
            <button type="button" onClick={() => setEditing((e) => !e)} className="text-[12px] font-bold text-white/70">
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {saved.map((t) => {
              const used = lines.some((l) => l.trim().toLowerCase() === t.body.toLowerCase());
              return (
                <span key={t.id} className="inline-flex max-w-full items-center">
                  <button
                    type="button"
                    disabled={editing || used}
                    onClick={() => {
                      addIdea(t.body);
                      sfx("tap");
                    }}
                    className={clsx(
                      "gm-btn max-w-full truncate rounded-full px-3 py-1.5 text-left text-[13px] font-semibold",
                      used ? "bg-[#7dffb5]/20 text-[#7dffb5]" : "bg-white text-ink",
                      editing && "rounded-r-none",
                    )}
                  >
                    {used ? "✓ " : ""}
                    {t.body}
                  </button>
                  {editing && (
                    <button type="button" onClick={() => forget(t)} aria-label={`Remove “${t.body}”`} className="rounded-r-full bg-chili px-2.5 py-1.5 text-[13px] font-bold text-white">
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/55">Your truths are saved when you lock in, so you can use them again in any game.</p>
        </section>
      )}

      {ideas.length > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-white/60">Stuck? Try:</span>
          {ideas.map((t) => (
            <button key={t} type="button" onClick={() => addIdea(t)} className="gm-btn rounded-full bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold">
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto pt-5">
        <p className="mb-3 flex items-center gap-2 text-[13px] text-white/75">
          <span className={clsx("h-2.5 w-2.5 rounded-full", theyReady ? "bg-[#7dffb5]" : "animate-pulse bg-gold")} />
          {theyReady ? `${names.them} is locked in` : `${names.them} is writing theirs too`}
        </p>
        {err && <p className="mb-2 text-[13px] font-semibold text-[#ffb4b4]">{err}</p>}
        <BigButton onClick={lockIn} disabled={!ready || busy} className="w-full">
          {lie === null && lines.every((l) => l.trim()) ? "Tap the mask on your lie" : "Lock in"}
        </BigButton>
      </div>
    </div>
  );
}

function Guess({ game, names, act, them }: { game: Game; names: Names; act: GameActions; them: "a" | "b" }) {
  const lines: string[] = game.state[`lines_${them}`] ?? [];
  const [local, setLocal] = useState<number | null>(null);
  const guess: number | null = game.mine?.guess ?? local;
  const theyGuessed = !!game.state[`guessed_${them}`];

  async function pick(k: number) {
    if (guess !== null) return;
    setLocal(k);
    sfx("flip");
    buzz(12);
    await act.call("guess_truth", { p_game: game.id, p_index: k });
  }

  return (
    <div className="flex h-full flex-col px-[18px] pt-2 pb-6">
      <Header title="TWO TRUTHS & A LIE" sub="Round 2 · you guess" />
      <h2 className="mt-6 font-display text-[30px] leading-[1.1] font-bold">Which one is {names.them}&apos;s lie?</h2>
      <div className="mt-5 flex flex-col gap-3.5">
        {lines.map((l, k) => (
          <button
            key={k}
            type="button"
            onClick={() => pick(k)}
            className={clsx(
              "gm-btn gm-flip relative rounded-[22px] p-4 text-left text-[16px] leading-snug text-ink",
              guess === k ? "bg-[#fff7e3]" : "bg-white",
              guess !== null && guess !== k && "opacity-55",
            )}
            style={
              {
                animationDelay: `${k * 0.1}s`,
                transform: guess === k ? undefined : `rotate(${k === 0 ? -1.5 : k === 2 ? 1.5 : 0}deg)`,
                boxShadow: guess === k ? "0 0 0 4px #f2b33d, 0 6px 0 #b9831e" : "0 6px 0 rgba(0,0,0,0.25)",
                "--edge": "rgba(0,0,0,0.25)",
              } as React.CSSProperties
            }
          >
            {l}
            {guess === k && (
              <span className="gm-stamp absolute -top-3.5 -right-2 rounded-xl bg-chili px-3 py-1.5 text-[13px] font-extrabold tracking-wide text-white shadow-[0_4px_0_#a32a2e]">
                LIE?
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-auto text-center text-[14px] text-white/70">
        {guess === null ? "Tap the one you think is made up." : theyGuessed ? "Revealing…" : `Waiting for ${names.them} to guess yours…`}
      </p>
    </div>
  );
}

function Reveal({ game, names, onResults }: { game: Game; names: Names; onResults: () => void }) {
  const st = game.state;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const theirLines: string[] = st[`lines_${them}`] ?? [];
  const myLines: string[] = st[`lines_${me}`] ?? [];
  const theirLie: number | undefined = st[`lie_${them}`];
  const myLie: number | undefined = st[`lie_${me}`];
  const myGuess: number | null = st[`guess_${me}`] ?? null;
  const theirGuess: number | null = st[`guess_${them}`] ?? null;
  const caught = myGuess !== null && myGuess === theirLie;
  const fooled = theirGuess !== null && theirGuess !== myLie;
  const [tab, setTab] = useState<"theirs" | "mine">("theirs");
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !theirLines.length) return;
    done.current = true;
    if (caught) {
      sfx("win");
      buzz([20, 40, 60]);
    } else sfx("lose");
  }, [caught, theirLines.length]);

  if (!theirLines.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-[26px] font-bold">Time ran out</p>
        <p className="mt-1 text-[14px] text-white/70">Not everyone finished writing.</p>
        <BigButton onClick={onResults} className="mt-6 w-full">
          See results
        </BigButton>
      </div>
    );
  }

  const lines = tab === "theirs" ? theirLines : myLines;
  const lie = tab === "theirs" ? theirLie : myLie;
  const guess = tab === "theirs" ? myGuess : theirGuess;

  return (
    <div className="flex h-full flex-col px-[18px] pt-2 pb-6">
      <div className="flex rounded-full bg-white/10 p-1">
        {(["theirs", "mine"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx("h-9 flex-1 rounded-full text-[13px] font-extrabold transition", tab === t ? "bg-white text-[#1a1240]" : "text-white/70")}
          >
            {t === "theirs" ? `${names.them}'s` : "Yours"}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {lines.map((l, k) => (
          <div
            key={`${tab}-${k}`}
            className={clsx("gm-flip relative rounded-[22px] p-4 text-[16px] leading-snug text-ink", k === lie ? "bg-[#fff7e3]" : "bg-white opacity-60")}
            style={{
              animationDelay: `${k * 0.12}s`,
              boxShadow: k === lie ? "0 0 0 4px #f2b33d, 0 6px 0 #b9831e, 0 24px 50px -16px rgba(242,179,61,0.8)" : "0 6px 0 rgba(0,0,0,0.25)",
            }}
          >
            {l}
            {k === lie && (
              <span className="gm-stamp absolute -top-3.5 -right-2 rounded-xl bg-chili px-3 py-1.5 text-[13px] font-extrabold tracking-wide text-white shadow-[0_4px_0_#a32a2e]">
                LIE!
              </span>
            )}
            {k === guess && k !== lie && (
              <span className="absolute -bottom-2.5 left-3 rounded-lg bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
                {tab === "theirs" ? "Your guess" : `${names.them}'s guess`}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        className={clsx(
          "gm-burst mt-6 rounded-3xl border p-4 text-center",
          (tab === "theirs" ? caught : !fooled) ? "border-[#7dffb5]/35 bg-[#1f9d6b]/25" : "border-[#ff9cc0]/35 bg-[#c2306b]/25",
        )}
      >
        <p className={clsx("font-display text-[24px] font-bold", (tab === "theirs" ? caught : !fooled) ? "text-[#7dffb5]" : "text-[#ff9cc0]")}>
          {tab === "theirs"
            ? caught
              ? "Caught it! +1"
              : myGuess === null
                ? "No guess in time"
                : `${names.them} fooled you`
            : fooled
              ? `You fooled ${names.them}!`
              : theirGuess === null
                ? `${names.them} didn't guess`
                : `${names.them} caught your lie`}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <BigButton onClick={onResults} className="w-full">
          See results
        </BigButton>
      </div>
    </div>
  );
}
