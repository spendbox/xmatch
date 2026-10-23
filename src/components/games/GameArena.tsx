"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Volume2, VolumeX, X } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { buzz, gameInfo, sfx, useGameSound, type Game, type GameActions } from "@/lib/games";
import { BigButton, secondsLeft, useTicker, type Names } from "./parts";
import { ConnectFour } from "./ConnectFour";
import { ThisOrThat } from "./ThisOrThat";
import { TwoTruths } from "./TwoTruths";
import { WordHunt } from "./WordHunt";
import { Results } from "./Results";
import { Whot } from "./Whot";
import { Checkers } from "./Checkers";
import { ChessGame } from "./ChessGame";
import { Ayo } from "./Ayo";

/** The full-screen game: challenge, 3-2-1, the game itself, then results */
export function GameArena({
  game,
  names,
  act,
  onMinimize,
  onClose,
  peek,
  unmask,
}: {
  game: Game;
  names: Names;
  act: GameActions;
  /** Back to the chat; the game keeps going */
  onMinimize: () => void;
  /** Done with this game */
  onClose: () => void;
  peek?: string | null;
  unmask?: { onUnmask: () => void; done: boolean } | null;
}) {
  useTicker(250);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showResults, setShowResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sound = useGameSound();
  const info = gameInfo(game.kind);
  const over = game.status === "done" || game.status === "cancelled";
  const endedAgo = game.ended_at ? (act.now() - new Date(game.ended_at).getTime()) / 1000 : 99;

  // Lock the page behind
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // New game: start from the top
  useEffect(() => {
    setShowResults(false);
    setErr(null);
  }, [game.id]);

  async function leave() {
    if (game.status === "active" && !confirm(`Leave ${info.title}? ${names.them} wins this one.`)) return;
    await act.cancel();
    if (game.status !== "active") onClose();
  }

  async function rematch() {
    setBusy(true);
    setErr(null);
    const e = await act.start(game.kind, game.id);
    setBusy(false);
    if (e) setErr(e);
  }

  let body: React.ReactNode;
  let resultsView = false;
  const intro = game.status === "active" && secondsLeft(game.started_at, act.now) > 0;

  if (game.status === "invited") {
    body = <Challenge game={game} names={names} act={act} onClose={onClose} />;
  } else if (game.status === "declined" || game.status === "expired") {
    body = (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-white">
          <MaskIcon className="w-11" eyes="#1a1240" />
        </span>
        <p className="mt-5 font-display text-[28px] font-bold">
          {game.status === "declined" ? (game.me === "a" ? `${names.them} said not now` : "Maybe next time") : "Challenge ran out"}
        </p>
        <p className="mt-1.5 text-[14px] text-white/70">Keep chatting, then try another game.</p>
        <BigButton onClick={onClose} className="mt-8 w-full">
          Back to chat
        </BigButton>
      </div>
    );
  } else if (intro) {
    body = <VsIntro game={game} names={names} act={act} />;
  } else {
    const holdEnd =
      over &&
      !showResults &&
      ((game.kind === "truths" && game.state.phase === "reveal") || (["c4", "tot", "whot", "checkers", "chess", "ayo"].includes(game.kind) && endedAgo < 3));
    if (over && !holdEnd) {
      resultsView = true;
      body = (
        <Results
          game={game}
          names={names}
          onBack={onClose}
          onRematch={rematch}
          rematching={busy}
          unmask={unmask}
        />
      );
    } else if (game.kind === "c4") body = <ConnectFour game={game} names={names} act={act} peek={peek} onPeek={onMinimize} />;
    else if (game.kind === "tot") body = <ThisOrThat game={game} names={names} act={act} />;
    else if (game.kind === "truths") body = <TwoTruths game={game} names={names} act={act} onResults={() => setShowResults(true)} />;
    else if (game.kind === "whot") body = <Whot game={game} names={names} act={act} />;
    else if (game.kind === "checkers") body = <Checkers game={game} names={names} act={act} />;
    else if (game.kind === "chess") body = <ChessGame game={game} names={names} act={act} />;
    else if (game.kind === "ayo") body = <Ayo game={game} names={names} act={act} />;
    else body = <WordHunt game={game} names={names} act={act} />;
  }

  const bar = !(game.status === "invited" && game.me === "b") && !resultsView;

  if (!mounted) return null;
  return createPortal(
    <div className="gm-arena fixed inset-0 z-[60] flex justify-center bg-[#0b0720] animate-fade-in" role="dialog" aria-label={info.title}>
      <div className="relative flex h-dvh w-full max-w-md flex-col overflow-hidden" style={{ background: info.bg }}>
        {bar && (
          <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-1">
            <button
              type="button"
              onClick={onMinimize}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/12"
              aria-label="Back to chat"
            >
              <ChevronLeft size={22} />
            </button>
            <p className="min-w-0 flex-1 truncate text-center text-[11px] font-extrabold tracking-[0.16em] text-gold uppercase">{info.title}</p>
            <button
              type="button"
              onClick={sound.toggle}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/12"
              aria-label={sound.on ? "Turn sound off" : "Turn sound on"}
              aria-pressed={sound.on}
            >
              {sound.on ? <Volume2 size={19} /> : <VolumeX size={19} className="opacity-70" />}
            </button>
            {game.status === "active" && (
              <button type="button" onClick={leave} className="grid h-10 w-10 place-items-center rounded-full bg-white/12" aria-label="Leave game">
                <X size={19} />
              </button>
            )}
          </div>
        )}
        <div className="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">{body}</div>
        {err && (
          <p className="absolute inset-x-4 bottom-24 rounded-2xl bg-white px-4 py-3 text-center text-[14px] font-semibold text-ink shadow-lift">{err}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

const ME_COLOR = "#c06f12";
const THEM_COLOR = "#c2306b";

function Challenge({ game, names, act, onClose }: { game: Game; names: Names; act: GameActions; onClose: () => void }) {
  const info = gameInfo(game.kind);
  const left = secondsLeft(game.deadline_at, act.now);
  const incoming = game.me === "b";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rings = useRef(false);
  useEffect(() => {
    if (!incoming || rings.current) return;
    rings.current = true;
    sfx("go");
    buzz([40, 60, 40]);
  }, [incoming]);

  async function answer(yes: boolean) {
    setBusy(true);
    const e = await act.respond(yes);
    setBusy(false);
    if (e) setErr(e);
    if (!yes) onClose();
  }

  const colorTag = game.kind === "c4" ? (incoming ? ["PURPLE", "GOLD"] : ["GOLD", "PURPLE"]) : null;
  const meColor = game.kind === "c4" ? (incoming ? "#a78bfa" : "#f2b33d") : ME_COLOR;
  const themColor = game.kind === "c4" ? (incoming ? "#f2b33d" : "#a78bfa") : THEM_COLOR;
  const record = game.record;

  return (
    <div className="relative flex h-full flex-col items-center px-6 pt-14 pb-9 text-center">
      <div aria-hidden className="absolute top-[230px] -left-16 h-64 w-64 rounded-full opacity-35 blur-[60px]" style={{ background: THEM_COLOR }} />
      <div aria-hidden className="absolute top-[230px] -right-16 h-64 w-64 rounded-full opacity-35 blur-[60px]" style={{ background: ME_COLOR }} />
      <p className="text-[12px] font-extrabold tracking-[0.18em] text-gold">{incoming ? "CHALLENGE" : "CHALLENGE SENT"}</p>
      <h1 className="mt-2 font-display text-[40px] leading-none font-bold">{info.title}</h1>
      <p className="mt-2.5 text-[15px] text-white/75">{incoming ? `${names.them} challenged you` : `Waiting for ${names.them} to accept…`}</p>

      <div className="relative mt-12 flex w-full items-center justify-between">
        <Fighter name="You" color={meColor} tag={colorTag ? `YOU · ${colorTag[0]}` : "YOU"} tagColor={meColor === ME_COLOR ? "#f2b33d" : meColor} side="l" />
        <span className="gm-vs grid h-16 w-16 place-items-center rounded-[20px] bg-gradient-to-b from-[#ffd36b] to-gold font-display text-[26px] font-bold text-ink shadow-[0_6px_0_#b9831e,0_18px_40px_-8px_rgba(242,179,61,0.7)]">
          VS
        </span>
        <Fighter name={names.them} color={themColor} tag={colorTag ? colorTag[1] : "THEM"} tagColor={themColor === THEM_COLOR ? "#c4b5fd" : themColor} side="r" />
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {info.rules.map((r) => (
          <span key={r} className="rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold">
            {r}
          </span>
        ))}
        {record && record.played > 0 && (
          <span className="rounded-full bg-gold/20 px-3.5 py-2 text-[13px] font-bold text-gold">
            You&apos;re {record.won}–{record.lost}
          </span>
        )}
      </div>

      {err && <p className="mt-4 text-[13px] font-semibold text-[#ffb4b4]">{err}</p>}

      <div className="relative mt-auto flex w-full flex-col gap-3">
        {incoming ? (
          <>
            <BigButton onClick={() => answer(true)} disabled={busy} className="h-[60px] w-full text-[18px]">
              Accept · {Math.ceil(left)}s
            </BigButton>
            <BigButton variant="ghost" onClick={() => answer(false)} disabled={busy} className="h-[52px] w-full text-[15px]">
              Not now
            </BigButton>
          </>
        ) : (
          <>
            <div className="mx-auto mb-1 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${(left / 30) * 100}%` }} />
            </div>
            <BigButton variant="ghost" onClick={async () => { await act.cancel(); onClose(); }} className="h-[52px] w-full text-[15px]">
              Cancel challenge
            </BigButton>
          </>
        )}
      </div>
    </div>
  );
}

function Fighter({ name, color, tag, tagColor, side }: { name: string; color: string; tag: string; tagColor: string; side: "l" | "r" }) {
  return (
    <div className={`flex w-[130px] flex-col items-center gap-2.5 ${side === "l" ? "gm-slide-l" : "gm-slide-r"}`}>
      <span
        className="grid h-[104px] w-[104px] place-items-center rounded-full text-ink"
        style={{ background: color, boxShadow: `0 0 0 6px rgba(255,255,255,0.12), 0 20px 40px -10px ${color}` }}
      >
        <MaskIcon className="w-16" eyes={color} />
      </span>
      <p className="max-w-full truncate text-[16px] font-extrabold">{name}</p>
      <p className="text-[12px] font-bold" style={{ color: tagColor }}>
        {tag}
      </p>
    </div>
  );
}

function VsIntro({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  const info = gameInfo(game.kind);
  const left = Math.ceil(secondsLeft(game.started_at, act.now));
  const last = useRef(left);
  useEffect(() => {
    if (left !== last.current) {
      sfx(left <= 0 ? "go" : "tick");
      buzz(8);
      last.current = left;
    }
  }, [left]);
  return (
    <div className="flex h-full flex-col items-center px-6 pt-10 text-center">
      <p className="text-[12px] font-extrabold tracking-[0.18em] text-gold">GET READY</p>
      <h1 className="mt-2 font-display text-[38px] leading-none font-bold">{info.title}</h1>
      <div className="mt-12 flex w-full items-center justify-between">
        <Fighter name="You" color={ME_COLOR} tag="YOU" tagColor="#f2b33d" side="l" />
        <span className="gm-vs grid h-16 w-16 place-items-center rounded-[20px] bg-gradient-to-b from-[#ffd36b] to-gold font-display text-[26px] font-bold text-ink shadow-[0_6px_0_#b9831e]">
          VS
        </span>
        <Fighter name={names.them} color={THEM_COLOR} tag="THEM" tagColor="#c4b5fd" side="r" />
      </div>
      <div className="mt-14 grid h-32 place-items-center">
        <span key={left} className="gm-count font-display text-[110px] leading-none font-bold text-gold drop-shadow-[0_8px_0_rgba(0,0,0,0.3)]">
          {left > 3 ? 3 : left > 0 ? left : "Go!"}
        </span>
      </div>
    </div>
  );
}
