"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions, type TotQuestion } from "@/lib/games";
import { Countdown, secondsLeft, useTicker, type Names } from "./parts";

type Pick = "a" | "b" | null;

export function ThisOrThat({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(200);
  const st = game.state;
  const qs: TotQuestion[] = st.qs ?? [];
  const picks: [Pick, Pick][] = st.picks ?? [];
  const i: number = st.i ?? 0;
  const me = game.me;
  const revealLeft = secondsLeft(st.reveal_until, act.now);
  const revealing = picks.length > 0 && (revealLeft > 0 || game.status !== "active");
  const shownIndex = revealing ? picks.length - 1 : Math.min(i, qs.length - 1);
  const q = qs[shownIndex];
  const [local, setLocal] = useState<Record<number, "a" | "b">>({});
  const myPick: Pick = revealing
    ? picks[shownIndex]?.[me === "a" ? 0 : 1] ?? null
    : (game.mine?.picks?.[String(i)] as Pick) ?? local[i] ?? null;
  const theirPick: Pick = revealing ? picks[shownIndex]?.[me === "a" ? 1 : 0] ?? null : null;
  const same = revealing && myPick !== null && myPick === theirPick;
  const alike: number = st.alike ?? 0;
  const left = secondsLeft(game.deadline_at, act.now) - revealLeft;

  // Sound for each reveal
  const seen = useRef(picks.length);
  useEffect(() => {
    if (picks.length > seen.current) {
      const last = picks[picks.length - 1];
      const mine = last[me === "a" ? 0 : 1];
      if (mine && mine === last[me === "a" ? 1 : 0]) {
        sfx("match");
        buzz([15, 30, 15]);
      } else sfx("flip");
    }
    seen.current = picks.length;
  }, [picks, me]);

  async function choose(p: "a" | "b") {
    if (revealing || myPick || game.status !== "active" || secondsLeft(game.started_at, act.now) > 0) return;
    setLocal((l) => ({ ...l, [i]: p }));
    sfx("tap");
    buzz(10);
    await act.call("play_tot", { p_game: game.id, p_index: i, p_pick: p });
  }

  if (!q) return null;

  return (
    <div className="flex h-full flex-col px-[18px] pt-2 pb-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#7dffb5]/15 px-3 py-1.5 text-[13px] font-extrabold text-[#7dffb5]">
          {alike}/{picks.length} alike
        </span>
        {!revealing && game.status === "active" && <Countdown seconds={Math.max(0, left)} total={8} size={42} />}
      </div>

      {/* Progress */}
      <div className="mt-4 flex gap-1.5">
        {qs.map((_, k) => {
          const p = picks[k];
          const bg = p ? (p[0] && p[0] === p[1] ? "#7dffb5" : "#ff7aa8") : k === i && !revealing ? "#f2b33d" : "rgba(255,255,255,0.15)";
          return <span key={k} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: bg }} />;
        })}
      </div>

      <div className="mt-5 text-center">
        <p className="text-[13px] font-bold text-white/65">
          {shownIndex + 1} of {qs.length}
        </p>
        <h2 key={shownIndex} className="gm-burst mt-1.5 font-display text-[30px] leading-[1.05] font-bold">
          {q.q}
        </h2>
      </div>

      <div className="relative mt-5 flex flex-1 flex-col gap-3.5" style={{ maxHeight: 440 }}>
        <Choice
          label="THIS"
          text={q.a}
          tone="this"
          mine={myPick === "a"}
          theirs={theirPick === "a"}
          dim={!!myPick && myPick !== "a" && !revealing}
          reveal={revealing}
          names={names}
          onClick={() => choose("a")}
        />
        <span className="absolute top-1/2 left-1/2 z-10 grid h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gold text-[14px] font-extrabold text-ink shadow-[0_0_0_6px_#2a0f2a]">
          OR
        </span>
        <Choice
          label="THAT"
          text={q.b}
          tone="that"
          mine={myPick === "b"}
          theirs={theirPick === "b"}
          dim={!!myPick && myPick !== "b" && !revealing}
          reveal={revealing}
          names={names}
          onClick={() => choose("b")}
        />
      </div>

      <div className="mt-5 min-h-[52px] text-center">
        {revealing ? (
          same ? (
            <p className="gm-burst font-display text-[26px] font-bold text-[#7dffb5]">Same pick!</p>
          ) : theirPick === null || myPick === null ? (
            <p className="gm-burst font-display text-[22px] font-bold text-white/80">{myPick === null ? "Too slow!" : `${names.them} ran out of time`}</p>
          ) : (
            <p className="gm-burst font-display text-[24px] font-bold text-[#ff9cc0]">Different picks</p>
          )
        ) : myPick ? (
          <p className="text-[14px] font-semibold text-white/75">Locked in. Waiting for {names.them}…</p>
        ) : (
          <p className="text-[14px] font-semibold text-white/60">Tap one. {names.them} is picking too.</p>
        )}
        {revealing && game.status === "active" && <p className="text-[13px] text-white/60">Next question in {Math.ceil(revealLeft)}s</p>}
      </div>
    </div>
  );
}

function Choice({
  label,
  text,
  tone,
  mine,
  theirs,
  dim,
  reveal,
  names,
  onClick,
}: {
  label: string;
  text: string;
  tone: "this" | "that";
  mine: boolean;
  theirs: boolean;
  dim: boolean;
  reveal: boolean;
  names: Names;
  onClick: () => void;
}) {
  const bg =
    tone === "this"
      ? "linear-gradient(150deg, #ff7aa8 0%, #c2306b 60%, #7a1d47 100%)"
      : "linear-gradient(150deg, #8f6bff 0%, #5b3fd9 60%, #2b1d73 100%)";
  const edge = tone === "this" ? "#4f122e" : "#1a1240";
  const picked = mine || theirs;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("gm-btn relative flex-1 rounded-[28px] p-5 text-left transition-opacity", (dim || (reveal && !picked)) && "opacity-45")}
      style={
        {
          background: bg,
          "--edge": edge,
          boxShadow: mine ? `0 0 0 4px #fff, 0 8px 0 ${edge}, 0 30px 60px -20px rgba(194,48,107,0.6)` : `0 8px 0 ${edge}`,
          minHeight: 150,
        } as React.CSSProperties
      }
    >
      <span className="block text-[12px] font-extrabold tracking-[0.14em] text-white/80">{label}</span>
      <span className="mt-1.5 block font-display text-[28px] leading-[1.08] font-bold">{text}</span>
      {reveal && picked && (
        <span className="absolute right-4 bottom-4 flex gap-1.5">
          {mine && <span className="gm-burst rounded-full bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-[#c2306b]">You</span>}
          {theirs && (
            <span className="gm-burst rounded-full bg-ink px-2.5 py-1.5 text-[12px] font-extrabold text-white" style={{ animationDelay: "0.12s" }}>
              {names.them}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
