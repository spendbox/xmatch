"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { canPlay, parse, SHAPES, type Shape, type WhotState } from "@/lib/boardgames/whot";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useMove } from "./useMove";

const MAROON = "#8f1d3a";
const CARD_W = 64;
const CARD_H = 92;

type Fly = { id: number; card: string | null; from: DOMRect; to: DOMRect; flip?: boolean; delay?: number; onLand?: () => void };

/** A steady little tilt for each card on the pile, so it looks like a real heap */
const tilt = (card: string, k: number) => ((card.length * 7 + k * 13) % 17) - 8;

/**
 * Whot at a card table: their cards fan along the far edge, the market and pile sit in the
 * middle of the felt, and your hand fans along the bottom. Cards fly across the table.
 */
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
  const owed = st.pending ?? 0;

  // The pile as it looks on the table (the newest card lands when its flight ends)
  const [pile, setPile] = useState<string[]>([st.top]);
  const [flying, setFlying] = useState<Fly[]>([]);
  const [hidden, setHidden] = useState<string | null>(null);
  const table = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const marketRef = useRef<HTMLButtonElement>(null);
  const theirHand = useRef<HTMLDivElement>(null);
  const myHand = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const seen = useRef(st.moves);
  const mine = useRef<string | null>(null);
  const n = useRef(0);

  const rect = (el: Element | null | undefined) => el?.getBoundingClientRect() ?? new DOMRect();
  const land = (card: string) => setPile((p) => (p[p.length - 1] === card ? p : [...p.slice(-4), card]));
  function fly(f: Omit<Fly, "id">) {
    const id = ++n.current;
    setFlying((l) => [...l, { ...f, id }]);
  }
  const done = (id: number) => setFlying((l) => l.filter((f) => f.id !== id));

  // Something happened at the table: play it out
  useEffect(() => {
    if (st.moves === seen.current) return;
    const jump = st.moves !== seen.current + 1;
    seen.current = st.moves;
    const l = st.last;
    if (!l || jump) {
      setPile((p) => (p[p.length - 1] === st.top ? p : [...p.slice(-4), st.top]));
      return;
    }
    const byMe = l.by === me;
    if (l.card) {
      if (byMe && mine.current === l.card) {
        // Yours is already on its way
        mine.current = null;
      } else {
        // Theirs: from their hand to the pile, turning face up
        fly({ card: l.card, from: rect(theirHand.current), to: rect(pileRef.current), flip: !byMe, onLand: () => land(l.card!) });
        sfx("flip");
      }
    } else {
      setPile((p) => (p[p.length - 1] === st.top ? p : [...p.slice(-4), st.top]));
    }
    // Cards picked from the market: face down, to whoever picked them
    if (l.picked) {
      const to = l.card ? (byMe ? theirHand : myHand) : byMe ? myHand : theirHand;
      for (let k = 0; k < Math.min(l.picked, 6); k++) {
        fly({ card: null, from: rect(marketRef.current), to: rect(to.current), delay: (l.card ? 300 : 0) + k * 110 });
      }
      buzz(l.picked > 1 ? [10, 40, 10] : 8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.moves]);

  async function playCard(card: string, call?: Shape) {
    // Send it flying from your hand right away
    const el = cardEls.current.get(card);
    mine.current = card;
    setHidden(card);
    fly({ card, from: rect(el), to: rect(pileRef.current), onLand: () => land(card) });
    sfx("flip");
    buzz(10);
    const ok = await send(call ? { type: "play", card, call } : { type: "play", card });
    setHidden(null);
    if (!ok) {
      mine.current = null;
      setPile((p) => p.filter((c) => c !== card || c === st.top));
    }
  }

  async function play(card: string) {
    if (!myTurn || busy || !canPlay(st, card)) return;
    if (parse(card).shape === "whot") return setCalling(card);
    await playCard(card);
  }

  const lastLine = st.last
    ? `${st.last.by === me ? "You" : names.them} ${st.last.card ? `played ${cardName(st.last.card)}` : "went to market"}${st.last.note && st.last.card ? ` · ${st.last.note}` : ""}${
        st.last.picked && st.last.card ? ` · ${st.last.by === me ? names.them : "you"} picked ${st.last.picked}` : ""
      }`
    : "Match the shape or the number";

  const theirShown = Math.min(theirCount, 12);
  const mineShown = hand.filter((c) => c !== hidden);

  return (
    <div className="relative flex h-full flex-col px-3 pt-2 pb-4">
      <div className="flex items-center gap-2.5">
        <Player name="You" color={color(me)} active={st.turn === me} sub={st.turn === me && game.status === "active" ? "Your turn" : `${hand.length} cards`} />
        <div className="text-[13px] font-bold text-white/60">vs</div>
        <Player right name={names.them} color={color(them)} active={st.turn === them} sub={st.turn === them && game.status === "active" ? "Their turn" : `${theirCount} cards`} />
      </div>

      {/* The table */}
      <div
        ref={table}
        className="relative mt-3 flex min-h-0 flex-1 flex-col items-center justify-between rounded-[44%/30%] p-[14px]"
        style={{
          background: "linear-gradient(160deg,#7a4520,#4a2510)",
          boxShadow: "0 14px 0 #2a1408, 0 30px 60px -18px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.18)",
        }}
      >
        <div
          className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-[42%/28%] px-3 py-4"
          style={{
            background: "radial-gradient(ellipse at 50% 45%, #2a8a5c 0%, #17663f 55%, #0d4429 100%)",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.08), inset 0 10px 40px rgba(0,0,0,0.45)",
          }}
        >
          {/* Their hand, face down along the far edge */}
          <div ref={theirHand} className="flex h-[66px] justify-center pt-2" aria-label={`${names.them} has ${theirCount} cards`}>
            {Array.from({ length: theirShown }, (_, k) => (
              <span
                key={k}
                className="-mx-[13px] origin-top transition-transform duration-300"
                style={{ transform: `rotate(${(k - (theirShown - 1) / 2) * -5}deg) translateY(${-Math.abs(k - (theirShown - 1) / 2) * 1.5}px)` }}
              >
                <CardBack small />
              </span>
            ))}
          </div>

          {/* Market and pile in the middle */}
          <div className="flex items-center justify-center gap-7">
            <button
              ref={marketRef}
              type="button"
              onClick={() => send({ type: "market" })}
              disabled={!myTurn || busy}
              className={clsx("relative transition active:scale-95", myTurn && !anyPlayable && "gm-pulse")}
              aria-label={owed && myTurn ? `Pick ${owed} cards` : `Go to market. ${st.market} cards left`}
            >
              {/* A deck has depth */}
              <span className="absolute top-[5px] left-[5px]">
                <CardBack />
              </span>
              <span className="absolute top-[2.5px] left-[2.5px]">
                <CardBack />
              </span>
              <span className="relative block">
                <CardBack />
              </span>
              <span className="absolute -top-2 -right-3 rounded-full bg-gold px-2 py-0.5 text-[12px] font-extrabold text-ink tabular-nums shadow">{st.market}</span>
              <span className={clsx("mt-2 block text-center text-[11px] font-bold", owed && myTurn ? "text-gold" : "text-white/75")}>
                {owed && myTurn ? `Pick ${owed}` : "Market"}
              </span>
            </button>

            <div className="relative">
              <div ref={pileRef} className="relative" style={{ width: CARD_W, height: CARD_H }}>
                {pile.map((c, k) => (
                  <span key={`${c}-${k}`} className="absolute inset-0" style={{ transform: `rotate(${k === pile.length - 1 ? tilt(c, k) / 3 : tilt(c, k)}deg)` }}>
                    <Card card={c} />
                  </span>
                ))}
                {owed > 0 && (
                  <span className="gm-burst absolute -top-3 -left-5 z-10 rounded-full bg-gold px-2 py-1 text-[12px] font-extrabold text-ink shadow">+{owed}</span>
                )}
                {st.called && (
                  <span className="gm-burst absolute -top-3 -right-5 z-10 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-ink shadow">
                    <ShapeIcon shape={st.called} size={14} color={MAROON} /> {st.called}
                  </span>
                )}
              </div>
              <span className="mt-2 block text-center text-[11px] font-bold text-white/75">Pile</span>
            </div>
          </div>

          <p className={clsx("min-h-[36px] max-w-[260px] text-center text-[13px] leading-snug", note ? "font-semibold text-[#ffd0d0]" : "text-white/85")}>
            {note ??
              (myTurn && owed
                ? anyPlayable
                  ? `Pick ${owed} coming! Play a 2 to pass it back, or tap the market to pick ${owed}`
                  : `Pick ${owed}! No 2 to answer with. Tap the market`
                : myTurn && !anyPlayable
                  ? "Nothing to play. Tap the market to pick a card"
                  : lastLine)}
          </p>
        </div>
      </div>

      {/* Your hand, fanned */}
      <div className="mt-3">
        <p className="mb-1 text-center text-[11px] font-extrabold tracking-[0.14em] text-gold uppercase">Your cards · {hand.length}</p>
        <div ref={myHand} className="no-scrollbar -mx-3 flex justify-center overflow-x-auto px-6 pt-4 pb-2">
          <div className="flex">
            {mineShown.map((c, k) => {
              const ok = myTurn && canPlay(st, c);
              const mid = (mineShown.length - 1) / 2;
              const spread = mineShown.length > 7 ? 2 : 4;
              return (
                <button
                  key={`${c}-${k}`}
                  ref={(el) => {
                    if (el) cardEls.current.set(c, el);
                    else cardEls.current.delete(c);
                  }}
                  type="button"
                  onClick={() => play(c)}
                  disabled={!myTurn || busy}
                  aria-label={`${cardName(c)}${ok ? ", playable" : ""}`}
                  className={clsx("relative shrink-0 origin-bottom transition-transform duration-200", mineShown.length > 5 ? "-mx-[10px]" : "mx-0.5", !ok && myTurn && "saturate-50")}
                  style={{ transform: `rotate(${(k - mid) * spread}deg) translateY(${ok ? -14 : Math.abs(k - mid) * 2}px)`, zIndex: k }}
                >
                  <Card card={c} glow={ok} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cards in flight */}
      <div className="pointer-events-none fixed inset-0 z-30">
        {flying.map((f) => (
          <FlyingCard key={f.id} f={f} onDone={() => done(f.id)} />
        ))}
      </div>

      {calling && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 px-6" onClick={() => setCalling(null)}>
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
                    await playCard(card, s);
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

/** A card sliding across the table (and turning over, for theirs) */
function FlyingCard({ f, onDone }: { f: Fly; onDone: () => void }) {
  const el = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const fx = f.from.left + f.from.width / 2 - CARD_W / 2;
    const fy = f.from.top + f.from.height / 2 - CARD_H / 2;
    const tx = f.to.left + f.to.width / 2 - CARD_W / 2;
    const ty = f.to.top + f.to.height / 2 - CARD_H / 2;
    const a = node.animate(
      [
        { transform: `translate(${fx}px, ${fy}px) rotate(${f.flip ? 180 : -6}deg) scale(${f.card === null ? 0.9 : 1})` },
        { transform: `translate(${(fx + tx) / 2}px, ${Math.min(fy, ty) - 30}px) rotate(${f.flip ? 90 : 8}deg) scale(1.12)`, offset: 0.55 },
        { transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(1)` },
      ],
      { duration: 460, delay: f.delay ?? 0, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)", fill: "both" },
    );
    a.onfinish = () => {
      f.onLand?.();
      onDone();
    };
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span ref={el} className="absolute top-0 left-0 will-change-transform" style={{ filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.45))" }}>
      {f.card ? <Card card={f.card} /> : <CardBack />}
    </span>
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
      style={{ background: "#fffaf1", boxShadow: glow ? "0 0 0 3px #f2b33d, 0 10px 20px rgba(0,0,0,0.4)" : "0 4px 8px rgba(0,0,0,0.35)" }}
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
      className={clsx("grid place-items-center rounded-[10px] border-2 border-white/80", small ? "h-[58px] w-[40px]" : "h-[92px] w-[64px] rounded-[12px]")}
      style={{ background: "repeating-linear-gradient(45deg,#b8264a 0 6px,#8f1d3a 6px 12px)", boxShadow: "0 3px 6px rgba(0,0,0,0.35)" }}
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
