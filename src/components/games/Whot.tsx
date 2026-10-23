"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Game, GameActions } from "@/lib/games";
import { canPlay, parse, SHAPES, type Shape, type WhotState } from "@/lib/boardgames/whot";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

const MAROON = "#8f1d3a";

export function Whot({ game, names, act }: { game: Game; names: Names; act: GameActions }) {
  useTicker(500);
  const st = game.state as WhotState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const color = (s: string) => (s === "a" ? GOLD : PURPLE);
  const { send, busy, note, started } = useMove(game, act);
  const [calling, setCalling] = useState<string | null>(null);
  const hand: string[] = game.mine?.hand ?? [];
  const myTurn = game.status === "active" && started && st.turn === me;
  const theirCount = them === "a" ? st.count_a : st.count_b;
  const anyPlayable = hand.some((c) => canPlay(st, c));

  async function play(card: string) {
    if (!myTurn || busy || !canPlay(st, card)) return;
    if (parse(card).shape === "whot") return setCalling(card);
    await send({ type: "play", card });
  }

  const lastLine = st.last
    ? `${st.last.by === me ? "You" : names.them} ${st.last.card ? `played ${cardName(st.last.card)}` : "went to market"}${st.last.note && st.last.card ? ` · ${st.last.note}` : ""}${
        st.last.picked && st.last.card ? ` · ${st.last.by === me ? names.them : "you"} picked ${st.last.picked}` : ""
      }`
    : "Match the shape or the number";

  return (
    <div className="flex h-full flex-col px-4 pt-2 pb-5">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.turn === me} sub={st.turn === me && game.status === "active" ? "Your turn" : `${hand.length} cards`} />
        <div className="text-[13px] font-bold text-white/60">vs</div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={st.turn === them && game.status === "active" ? "Their turn" : `${theirCount} cards`} />
      </div>

      {/* Their hand, face down */}
      <div className="mt-4 flex h-[66px] justify-center" aria-label={`${names.them} has ${theirCount} cards`}>
        {Array.from({ length: Math.min(theirCount, 12) }, (_, k) => (
          <span key={k} className="-mx-2.5 first:ml-0" style={{ transform: `rotate(${(k - Math.min(theirCount, 12) / 2) * 3}deg)` }}>
            <CardBack small />
          </span>
        ))}
      </div>

      {/* Market and pile */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => send({ type: "market" })}
          disabled={!myTurn || busy}
          className={clsx("relative transition active:scale-95", myTurn && !anyPlayable && "gm-pulse")}
          aria-label={`Go to market. ${st.market} cards left`}
        >
          <CardBack />
          <span className="absolute -top-2 -right-2 rounded-full bg-gold px-2 py-0.5 text-[12px] font-extrabold text-ink tabular-nums">{st.market}</span>
          <span className="mt-1.5 block text-center text-[11px] font-bold text-white/70">Market</span>
        </button>
        <div className="relative">
          <Card card={st.top} />
          {st.called && (
            <span className="gm-burst absolute -top-3 -right-4 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-ink shadow">
              <ShapeIcon shape={st.called} size={14} color={MAROON} /> {st.called}
            </span>
          )}
          <span className="mt-1.5 block text-center text-[11px] font-bold text-white/70">Pile</span>
        </div>
      </div>

      <p className={clsx("mt-4 min-h-[36px] text-center text-[13px] leading-snug", note ? "font-semibold text-[#ffb4b4]" : "text-white/80")}>
        {note ?? (myTurn && !anyPlayable ? "Nothing to play. Tap the market to pick a card" : lastLine)}
      </p>

      {/* Your hand */}
      <div className="mt-auto">
        <p className="mb-2 text-[11px] font-extrabold tracking-[0.14em] text-gold uppercase">Your cards · {hand.length}</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-3 pb-2 no-scrollbar">
          {hand.map((c, k) => {
            const ok = myTurn && canPlay(st, c);
            return (
              <button
                key={`${c}-${k}`}
                type="button"
                onClick={() => play(c)}
                disabled={!myTurn || busy}
                aria-label={`${cardName(c)}${ok ? ", playable" : ""}`}
                className={clsx("shrink-0 transition", ok ? "-translate-y-2.5" : myTurn ? "opacity-55" : "")}
              >
                <Card card={c} glow={ok} />
              </button>
            );
          })}
        </div>
      </div>

      {calling && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 px-6" onClick={() => setCalling(null)}>
          <div className="gm-burst w-full max-w-xs rounded-[26px] bg-white p-4 text-ink" onClick={(e) => e.stopPropagation()}>
            <p className="text-center font-display text-[22px] font-bold">Whot! What do you want?</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={async () => {
                    const card = calling;
                    setCalling(null);
                    await send({ type: "play", card, call: s });
                  }}
                  aria-label={`Call ${s}`}
                  className="grid aspect-square place-items-center rounded-2xl bg-cream active:scale-95"
                >
                  <ShapeIcon shape={s} size={28} color={MAROON} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[12px] text-muted">Tap a shape</p>
          </div>
        </div>
      )}
    </div>
  );
}

function cardName(card: string) {
  const c = parse(card);
  return c.shape === "whot" ? "Whot 20" : `${c.shape} ${c.n}`;
}

/** A Whot card face: cream, maroon shapes, numbers in the corners */
export function Card({ card, glow }: { card: string; glow?: boolean }) {
  const c = parse(card);
  return (
    <span
      className="relative grid h-[92px] w-[64px] place-items-center rounded-[12px] border border-[#e3d6c4]"
      style={{ background: "#fffaf1", boxShadow: glow ? "0 0 0 3px #f2b33d, 0 8px 18px rgba(0,0,0,0.35)" : "0 5px 0 rgba(0,0,0,0.25)" }}
    >
      <span className="absolute top-1 left-1.5 text-[13px] font-extrabold" style={{ color: MAROON }}>
        {c.n}
      </span>
      <span className="absolute right-1.5 bottom-1 rotate-180 text-[13px] font-extrabold" style={{ color: MAROON }}>
        {c.n}
      </span>
      {c.shape === "whot" ? (
        <span className="text-center font-display text-[15px] leading-none font-black tracking-tight" style={{ color: MAROON }}>
          WHOT
        </span>
      ) : (
        <ShapeIcon shape={c.shape} size={30} color={MAROON} />
      )}
    </span>
  );
}

function CardBack({ small }: { small?: boolean }) {
  return (
    <span
      className={clsx("grid place-items-center rounded-[10px] border-2 border-white/80", small ? "h-[62px] w-[42px]" : "h-[92px] w-[64px] rounded-[12px]")}
      style={{ background: "repeating-linear-gradient(45deg,#b8264a 0 6px,#8f1d3a 6px 12px)", boxShadow: "0 4px 0 rgba(0,0,0,0.3)" }}
    >
      <span className={clsx("rounded-md bg-white px-1 font-display font-black text-[#8f1d3a]", small ? "text-[8px]" : "text-[11px]")}>WHOT</span>
    </span>
  );
}

export function ShapeIcon({ shape, size, color }: { shape: Shape; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {shape === "circle" && <circle cx="12" cy="12" r="9" fill={color} />}
      {shape === "triangle" && <path d="M12 3 22 20H2Z" fill={color} />}
      {shape === "cross" && <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z" fill={color} />}
      {shape === "square" && <rect x="3.5" y="3.5" width="17" height="17" fill={color} />}
      {shape === "star" && <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z" fill={color} />}
    </svg>
  );
}
