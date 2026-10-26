"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { Trophy, Handshake, Hourglass, DoorOpen, MessageCircle, Shuffle } from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { buzz, gameInfo, myScore, sfx, theirScore, type Game } from "@/lib/games";
import { BigButton, Confetti, type Names } from "./parts";

export function Results({
  game,
  names,
  onBack,
  onRematch,
  rematching,
  unmask,
  more,
}: {
  game: Game;
  names: Names;
  onBack: () => void;
  onRematch: () => void;
  rematching?: boolean;
  /** Masked chats: offer to unmask after a game */
  unmask?: { onUnmask: () => void; done: boolean } | null;
  /** Play games: find someone new, or message the other player */
  more?: { onNew: () => void; onMessage?: () => void; closeLabel?: string };
}) {
  const info = gameInfo(game.kind);
  const myId = game.me === "a" ? game.player_a : game.player_b;
  const won = game.winner === myId;
  const lost = !!game.winner && !won;
  const tot = game.kind === "tot";
  const total = tot ? (game.state.qs?.length ?? 10) : 0;
  const alike = tot ? Math.round((100 * (game.state.alike ?? 0)) / Math.max(1, total)) : null;
  const cancelled = game.status === "cancelled";
  const leftByMe = game.ended_reason === "left" && game.ended_by === myId;
  const leftByThem = game.ended_reason === "left" && !leftByMe;
  const celebrate = (tot && (alike ?? 0) >= 60) || (won && !leftByThem);

  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (celebrate) {
      sfx("win");
      buzz([30, 50, 80]);
    } else if (lost) sfx("lose");
  }, [celebrate, lost]);

  let title: string;
  let line: string | null = `${myScore(game).toLocaleString()} – ${theirScore(game).toLocaleString()}`;
  if (tot) {
    title = `${alike}% alike`;
    line = `${game.state.alike ?? 0} of ${total} same picks`;
  } else if (game.ended_reason === "closed") {
    title = "Chat closed";
    line = "The game ended with the chat.";
  } else if (leftByThem) {
    title = "You win!";
    line = `${names.them} left the game`;
  } else if (leftByMe) {
    title = "You left";
    line = null;
  } else if (cancelled && game.ended_reason === "timeout") {
    title = won ? "You win!" : lost ? `${names.them} wins` : "Time ran out";
    line = won || lost ? "The other player ran out of time" : "Nobody finished in time";
  } else if (won) title = "You win!";
  else if (lost) title = `${names.them} wins`;
  else title = "It's a tie!";

  const record = game.record;
  const Icon = tot ? Handshake : cancelled && !won ? (leftByMe ? DoorOpen : Hourglass) : Trophy;

  return (
    <div
      className="relative flex h-full flex-col items-center overflow-hidden px-[22px] pt-10 pb-7 text-center"
      style={{ background: "radial-gradient(120% 70% at 50% 25%, #4a34b8 0%, #1a1240 55%, #0b0720 100%)" }}
    >
      {celebrate && <Confetti />}
      <span
        className={clsx("gm-burst relative grid h-[120px] w-[120px] place-items-center rounded-full", celebrate ? "bg-gradient-to-b from-[#ffd36b] to-gold" : "bg-white/15")}
        style={celebrate ? { boxShadow: "0 0 0 10px rgba(242,179,61,0.18), 0 0 80px 10px rgba(242,179,61,0.45)" } : undefined}
      >
        <Icon size={60} strokeWidth={2} className={celebrate ? "text-ink" : "text-white"} />
      </span>

      <p className="mt-6 text-[12px] font-extrabold tracking-[0.18em] text-gold uppercase">
        {info.title}
        {game.kind === "c4" || game.kind === "bomb" ? " · best of 3" : ""}
      </p>
      <h1 className="gm-burst mt-1.5 font-display text-[48px] leading-none font-bold" style={{ animationDelay: "0.1s" }}>
        {title}
      </h1>
      {line && <p className="mt-2.5 font-display text-[22px] font-bold text-white/85">{line}</p>}

      {record && record.played > 0 && (
        <div className={clsx("mt-6 grid w-full gap-2", game.play ? "grid-cols-2" : "grid-cols-3")}>
          <Stat value={String(record.played)} label={record.played === 1 ? "game together" : "games together"} />
          <Stat value={`${record.won}–${record.lost}`} label="your record" />
          {!game.play && <Stat value={record.alike !== null && record.alike !== undefined ? `${record.alike}%` : "–"} label="alike (This or That)" />}
        </div>
      )}

      {unmask && !unmask.done && (record?.played ?? 0) >= 1 && (
        <div className="mt-5 flex w-full items-center gap-3 rounded-[22px] bg-white p-3.5 text-left text-ink">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand text-white">
            <MaskIcon className="w-7" eyes="#5b3fd9" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold">Feeling the vibe?</p>
            <p className="text-[13px] leading-snug text-muted">Unmask if you want to see who&apos;s behind the mask.</p>
          </div>
          <button type="button" onClick={unmask.onUnmask} className="h-10 shrink-0 rounded-xl bg-brand px-3.5 text-[13px] font-extrabold text-white">
            Unmask
          </button>
        </div>
      )}

      {more?.onMessage && (
        <button
          type="button"
          onClick={more.onMessage}
          className="mt-5 flex w-full items-center gap-3 rounded-[22px] bg-white p-3.5 text-left text-ink"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand text-white">
            <MessageCircle size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Message {names.them.split(" ")[0]}</span>
            <span className="block text-[13px] leading-snug text-muted">Keep talking. It&apos;s saved in Chats.</span>
          </span>
        </button>
      )}

      {more && (
        <BigButton variant="ghost" onClick={more.onNew} className="mt-3 w-full">
          <Shuffle size={18} /> Find someone new
        </BigButton>
      )}

      <div className={clsx("grid w-full grid-cols-2 gap-2.5", more ? "mt-2.5" : "mt-auto pt-6")}>
        <BigButton variant="ghost" onClick={onBack}>
          {more?.closeLabel ?? "Back to chat"}
        </BigButton>
        {game.ended_reason !== "closed" ? (
          <BigButton onClick={onRematch} disabled={rematching}>
            {more ? "Play again" : "Rematch"}
          </BigButton>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[18px] bg-white/8 px-1.5 py-3">
      <p className="text-[20px] font-extrabold">{value}</p>
      <p className="text-[11px] leading-tight text-white/65">{label}</p>
    </div>
  );
}
