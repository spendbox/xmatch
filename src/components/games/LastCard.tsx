"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import {
  COLOURS,
  canPlay,
  isWild,
  parse,
  type Colour,
  type LastCardState,
} from "@/lib/boardgames/lastcard";
import { GOLD, PURPLE, Player, useTicker, type Names } from "./parts";
import { useReportBusy } from "./boardBusy";
import { useMove } from "./useMove";
import { GamePop, usePops, type Pop } from "./GamePop";

export const LC_COLOURS: Record<
  Colour,
  { hex: string; dark: string; name: string }
> = {
  r: { hex: "#e5484d", dark: "#a3262b", name: "Red" },
  y: { hex: "#ffb02e", dark: "#b97a10", name: "Yellow" },
  g: { hex: "#1f9d6b", dark: "#0f6644", name: "Green" },
  b: { hex: "#3b6cf0", dark: "#2445a8", name: "Blue" },
};
const W = 64;
const H = 94;

type Fly = {
  id: number;
  card: string | null;
  from: DOMRect;
  to: DOMRect;
  delay?: number;
  onLand?: () => void;
};

/**
 * Last Card at a table: their cards along the far edge, the draw pile and the pile in the
 * middle (glowing in the colour in play), your hand fanned along the bottom.
 */
export function LastCard({
  game,
  names,
  act,
}: {
  game: Game;
  names: Names;
  act: GameActions;
}) {
  useTicker(500);
  const st = game.state as LastCardState;
  const me = game.me;
  const them = me === "a" ? "b" : "a";
  const { send, busy, note, started } = useMove(game, act);
  const pops = usePops();
  const hand: string[] = game.mine?.hand ?? [];
  const myTurn = game.status === "active" && started && st.turn === me;
  const theirCount = them === "a" ? st.count_a : st.count_b;
  const playable = hand.filter((c) => canPlay(st, c));
  const drawn = st.drew && myTurn ? hand[hand.length - 1] : null;
  const [picking, setPicking] = useState<string | null>(null);
  // "Last card!" called, ready for the card that leaves you with one
  const [called, setCalled] = useState(false);

  const [pile, setPile] = useState<string[]>([st.top]);
  const [flying, setFlying] = useState<Fly[]>([]);
  const [hidden, setHidden] = useState<string | null>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLButtonElement>(null);
  const theirHand = useRef<HTMLDivElement>(null);
  const myHand = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const seen = useRef(st.moves);
  const mine = useRef<string | null>(null);
  const n = useRef(0);

  const rect = (el: Element | null | undefined) =>
    el?.getBoundingClientRect() ?? new DOMRect();
  const land = (card: string) =>
    setPile((p) => (p[p.length - 1] === card ? p : [...p.slice(-4), card]));
  const fly = (f: Omit<Fly, "id">) =>
    setFlying((l) => [...l, { ...f, id: ++n.current }]);
  const done = (id: number) => setFlying((l) => l.filter((f) => f.id !== id));
  useReportBusy(flying.length > 0);

  // Not your two-card moment any more: forget the call
  useEffect(() => {
    if (!myTurn || hand.length !== 2) setCalled(false);
  }, [myTurn, hand.length]);

  // Something happened at the table: play it out
  useEffect(() => {
    if (st.moves === seen.current) return;
    const jump = st.moves !== seen.current + 1;
    seen.current = st.moves;
    const l = st.last;
    if (!l || jump) {
      setPile((p) =>
        p[p.length - 1] === st.top ? p : [...p.slice(-4), st.top],
      );
      return;
    }
    const byMe = l.by === me;
    const p = lastCardPop(st, byMe, names.them);
    if (p) setTimeout(() => pops.show(p), l.card ? 380 : 120);
    if (l.card) {
      if (byMe && mine.current === l.card) mine.current = null;
      else {
        fly({
          card: l.card,
          from: rect(theirHand.current),
          to: rect(pileRef.current),
          onLand: () => land(l.card!),
        });
        sfx("flip");
      }
    } else
      setPile((p) =>
        p[p.length - 1] === st.top ? p : [...p.slice(-4), st.top],
      );
    // Cards drawn: face down, to whoever drew them (a catch makes the caught one draw)
    if (l.drew) {
      const toMe = l.caught ? !byMe : byMe;
      for (let k = 0; k < Math.min(l.drew, 6); k++)
        fly({
          card: null,
          from: rect(deckRef.current),
          to: rect((toMe ? myHand : theirHand).current),
          delay: k * 110,
        });
      buzz(l.drew > 1 ? [10, 40, 10] : 8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.moves]);

  // They went down to one card without calling it: you can catch them
  const canCatch = game.status === "active" && started && st.exposed === them;
  useEffect(() => {
    if (canCatch) buzz([10, 30, 10]);
  }, [canCatch]);

  const ended = game.status === "done";
  useEffect(() => {
    if (!ended || !game.winner) return;
    const won = game.winner === (me === "a" ? game.player_a : game.player_b);
    pops.show(
      won
        ? {
            title: "You win!",
            sub: "Last card played",
            tone: "win",
            gift: `Good game. Send ${names.them} a gift`,
          }
        : {
            title: `${names.them} wins`,
            sub: "They played their last card",
            tone: "bad",
            gift: "Say well played with a gift",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  // Previews only: show one pop-up again and again so it can be seen
  const demoPop = (st as { demo_pop?: string }).demo_pop;
  useEffect(() => {
    if (!demoPop) return;
    const p = DEMO_POPS(names.them)[demoPop];
    if (!p) return;
    const t = setTimeout(() => pops.show(p), 500);
    const i = setInterval(() => pops.show(p), 3000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoPop]);

  async function playCard(card: string, colour?: Colour) {
    const el = cardEls.current.get(card);
    mine.current = card;
    setHidden(card);
    fly({
      card,
      from: rect(el),
      to: rect(pileRef.current),
      onLand: () => land(card),
    });
    sfx("flip");
    buzz(10);
    const ok = await send({
      type: "play",
      card,
      ...(colour ? { colour } : {}),
      call: called && hand.length === 2,
    });
    setHidden(null);
    if (!ok) {
      mine.current = null;
      setPile((p) => p.filter((c) => c !== card || c === st.top));
    }
  }

  async function tapCard(card: string) {
    if (!myTurn || busy || !canPlay(st, card)) return;
    if (drawn && card !== drawn) return;
    if (isWild(card)) return setPicking(card);
    await playCard(card);
  }

  const owed = st.pending;
  const status =
    note ??
    (!started
      ? "Get ready…"
      : canCatch
        ? `${names.them} forgot to call it! Catch them`
        : myTurn
          ? drawn
            ? "It fits! Play it, or keep it"
            : owed
              ? playable.length
                ? `+${owed} coming! Stack a ${st.stack === "+4" ? "+4" : "+2 or +4"}, or draw ${owed}`
                : `Draw ${owed}. Nothing to stack`
              : playable.length
                ? hand.length === 2
                  ? "Two left: call “Last card!” before you play"
                  : `Match ${LC_COLOURS[st.colour].name.toLowerCase()} or the number`
                : "Nothing fits. Draw a card"
          : game.status === "active"
            ? lastLine(st, me, names.them)
            : "");

  const theirShown = Math.min(theirCount, 12);
  const mineShown = hand.filter((c) => c !== hidden);
  const colour = LC_COLOURS[st.colour];

  return (
    <div className="relative flex h-full flex-col px-3 pt-2 pb-4">
      <div className="flex items-center gap-2.5">
        <Player
          name="You"
          photo={names.mePhoto}
          color={GOLD}
          active={st.turn === me}
          sub={
            st.turn === me && game.status === "active"
              ? "Your turn"
              : `${hand.length} cards`
          }
        />
        <div className="text-[13px] font-bold text-white/60">vs</div>
        <Player
          right
          name={names.them}
          photo={names.themPhoto}
          onClick={names.onThem}
          color={PURPLE}
          active={st.turn === them}
          sub={`${theirCount} card${theirCount === 1 ? "" : "s"}${st.exposed === them ? " · didn't call!" : ""}`}
        />
      </div>

      {/* The table */}
      <div
        className="relative mt-3 flex min-h-0 flex-1 flex-col items-center justify-between overflow-hidden rounded-[36px] px-3 py-3"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, #3a1222 0%, #24081a 60%, #160410 100%)",
          boxShadow:
            "inset 0 0 0 2px rgba(255,255,255,0.07), inset 0 10px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Their hand */}
        <div
          ref={theirHand}
          className="relative flex h-[66px] justify-center pt-1"
          aria-label={`${names.them} has ${theirCount} cards`}
        >
          {Array.from({ length: theirShown }, (_, k) => (
            <span
              key={k}
              className="-mx-[13px] origin-top transition-transform duration-300"
              style={{
                transform: `rotate(${(k - (theirShown - 1) / 2) * -5}deg) translateY(${-Math.abs(k - (theirShown - 1) / 2) * 1.5}px)`,
              }}
            >
              <CardBack small />
            </span>
          ))}
          {theirCount === 1 && st.exposed !== them && (
            <span className="gm-burst absolute -bottom-2 rounded-full bg-[#e5484d] px-2.5 py-0.5 text-[11px] font-black">
              LAST CARD
            </span>
          )}
        </div>

        {/* Draw pile and the pile */}
        <div className="flex items-center justify-center gap-8">
          <button
            ref={deckRef}
            type="button"
            onClick={() => send({ type: "draw" })}
            disabled={!myTurn || busy || !!drawn}
            className={clsx(
              "relative transition active:scale-95",
              myTurn && !drawn && (!playable.length || owed > 0) && "gm-pulse",
            )}
            aria-label={
              owed && myTurn
                ? `Draw ${owed} cards`
                : `Draw a card. ${st.deck} left`
            }
          >
            {[3, 2, 1].map((d) => (
              <span
                key={d}
                className="absolute"
                style={{ top: d * 1.4, left: d * 1.4 }}
              >
                <CardBack />
              </span>
            ))}
            <span className="relative block">
              <CardBack />
            </span>
            <span className="absolute -top-2 -right-3 rounded-full bg-gold px-2 py-0.5 text-[12px] font-extrabold text-ink tabular-nums shadow">
              {st.deck}
            </span>
            <span
              className={clsx(
                "mt-3 block text-center text-[11px] font-bold",
                owed && myTurn ? "text-gold" : "text-white/75",
              )}
            >
              {owed && myTurn ? `Draw ${owed}` : "Draw"}
            </span>
          </button>

          <div className="relative">
            {/* The colour in play glows round the pile */}
            <span
              className="absolute -inset-4 rounded-[26px] transition-colors duration-500"
              style={{
                background: `radial-gradient(circle, ${colour.hex}66 0%, transparent 70%)`,
              }}
            />
            <div
              ref={pileRef}
              className="relative"
              style={{ width: W, height: H }}
            >
              {pile.map((c, k) => (
                <span
                  key={`${c}-${k}`}
                  className="absolute inset-0"
                  style={{
                    transform: `rotate(${k === pile.length - 1 ? 0 : ((c.length * 7 + k * 13) % 17) - 8}deg)`,
                  }}
                >
                  <Card card={c} />
                </span>
              ))}
              {owed > 0 && (
                <span className="gm-burst absolute -top-3 -left-5 z-10 rounded-full bg-[#e5484d] px-2 py-1 text-[13px] font-black text-white shadow">
                  +{owed}
                </span>
              )}
              {isWild(st.top) && (
                <span
                  className="gm-burst absolute -top-3 -right-6 z-10 rounded-full px-2 py-1 text-[11px] font-black text-white shadow"
                  style={{ background: colour.hex }}
                >
                  {colour.name}
                </span>
              )}
            </div>
            <span className="mt-3 block text-center text-[11px] font-bold text-white/75">
              Now:{" "}
              <span style={{ color: colour.hex }}>
                {colour.name.toLowerCase()}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p
            className={clsx(
              "min-h-[36px] max-w-[280px] text-center text-[13px] leading-snug",
              note ? "font-semibold text-[#ffd0d0]" : "text-white/85",
            )}
          >
            {status}
          </p>

          {/* Calls: "Last card!", catching them, keeping a drawn card */}
          <div className="flex h-12 items-center justify-center gap-2">
            {canCatch && (
              <button
                type="button"
                onClick={() => send({ type: "catch" })}
                disabled={busy}
                className="gm-btn gm-pulse rounded-full bg-gradient-to-b from-[#ffd36b] to-gold px-6 py-2.5 font-display text-[17px] font-black text-ink shadow-[0_5px_0_#b9831e]"
              >
                Catch! 🫵
              </button>
            )}
            {!canCatch &&
              myTurn &&
              hand.length === 2 &&
              playable.length > 0 &&
              !drawn && (
                <button
                  type="button"
                  onClick={() => {
                    setCalled((v) => !v);
                    buzz(15);
                    sfx(called ? "tap" : "go");
                  }}
                  aria-pressed={called}
                  className={clsx(
                    "gm-btn rounded-full px-6 py-2.5 font-display text-[17px] font-black tracking-wide",
                    called
                      ? "bg-white text-[#e5484d] shadow-[0_5px_0_#d9cfd2]"
                      : "gm-pulse bg-gradient-to-b from-[#ff6b6b] to-[#e5484d] text-white shadow-[0_5px_0_#a3262b]",
                  )}
                >
                  {called ? "Called ✓" : "LAST CARD!"}
                </button>
              )}
            {!canCatch && drawn && (
              <button
                type="button"
                onClick={() => send({ type: "pass" })}
                disabled={busy}
                className="gm-btn rounded-full bg-white/15 px-5 py-2.5 text-[14px] font-extrabold text-white"
              >
                Keep it
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Your hand */}
      <div>
        <p className="mt-2 mb-1 text-center text-[11px] font-extrabold tracking-[0.14em] text-gold uppercase">
          Your cards · {hand.length}
          {hand.length > 9 && (
            <span className="font-bold tracking-normal text-white/60 normal-case">
              {" "}
              · swipe to see them all
            </span>
          )}
        </p>
        <div
          ref={myHand}
          className="no-scrollbar -mx-3 touch-pan-x overflow-x-auto overscroll-x-contain px-6 pt-4 pb-2"
        >
          <div className="mx-auto flex w-max pr-3 pl-3">
            {mineShown.map((c, k) => {
              const ok = myTurn && canPlay(st, c) && (!drawn || c === drawn);
              const mid = (mineShown.length - 1) / 2;
              const many = mineShown.length;
              const spread = many > 12 ? 1 : many > 7 ? 2 : 4;
              return (
                <button
                  key={`${c}-${k}`}
                  ref={(el) => {
                    if (el) cardEls.current.set(c, el);
                    else cardEls.current.delete(c);
                  }}
                  type="button"
                  onClick={() => tapCard(c)}
                  disabled={!myTurn || busy}
                  aria-label={`${cardName(c)}${ok ? ", playable" : ""}`}
                  className={clsx(
                    "relative shrink-0 origin-bottom transition-transform duration-200",
                    many > 10
                      ? "-mx-[16px]"
                      : many > 5
                        ? "-mx-[13px]"
                        : "mx-0.5",
                    !ok && myTurn && "brightness-75 saturate-50",
                  )}
                  style={{
                    transform: `rotate(${(k - mid) * spread}deg) translateY(${ok ? -14 : Math.min(Math.abs(k - mid) * 2, many > 10 ? 4 : 99)}px)`,
                    zIndex: k,
                  }}
                >
                  <Card card={c} glow={ok} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 z-30">
        {flying.map((f) => (
          <FlyingCard key={f.id} f={f} onDone={() => done(f.id)} />
        ))}
      </div>

      <GamePop pop={pops.pop} />

      {picking && (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-black/60 px-6"
          onClick={() => setPicking(null)}
        >
          <div
            className="gm-burst w-full max-w-[300px] rounded-[28px] bg-[#2a0a14] p-5 text-center ring-1 ring-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-[22px] font-black">Pick a colour</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={async () => {
                    const card = picking;
                    setPicking(null);
                    await playCard(card, c);
                  }}
                  className="gm-btn h-20 rounded-[20px] text-[16px] font-black text-white"
                  style={
                    {
                      background: LC_COLOURS[c].hex,
                      boxShadow: `0 6px 0 ${LC_COLOURS[c].dark}`,
                      "--edge": LC_COLOURS[c].dark,
                    } as React.CSSProperties
                  }
                >
                  {LC_COLOURS[c].name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlyingCard({ f, onDone }: { f: Fly; onDone: () => void }) {
  const el = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const fx = f.from.left + f.from.width / 2 - W / 2;
    const fy = f.from.top + f.from.height / 2 - H / 2;
    const tx = f.to.left + f.to.width / 2 - W / 2;
    const ty = f.to.top + f.to.height / 2 - H / 2;
    const a = node.animate(
      [
        {
          transform: `translate(${fx}px, ${fy}px) rotate(-6deg) scale(${f.card === null ? 0.9 : 1})`,
        },
        {
          transform: `translate(${(fx + tx) / 2}px, ${Math.min(fy, ty) - 30}px) rotate(8deg) scale(1.12)`,
          offset: 0.55,
        },
        { transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(1)` },
      ],
      {
        duration: 460,
        delay: f.delay ?? 0,
        easing: "cubic-bezier(0.3, 0.7, 0.3, 1)",
        fill: "both",
      },
    );
    a.onfinish = () => {
      f.onLand?.();
      onDone();
    };
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      ref={el}
      className="absolute top-0 left-0 will-change-transform"
      style={{ filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.45))" }}
    >
      {f.card ? <Card card={f.card} /> : <CardBack />}
    </span>
  );
}

function cardName(card: string) {
  const c = parse(card);
  const v =
    c.value === "rev" ? "reverse" : c.value === "wild" ? "wild" : c.value;
  return c.colour === "w"
    ? c.value === "+4"
      ? "Wild +4"
      : "Wild"
    : `${LC_COLOURS[c.colour].name} ${v}`;
}

/** The middle of a card: its number, or the picture for an action */
function Face({
  value,
  size,
  color,
}: {
  value: string;
  size: number;
  color: string;
}) {
  if (value === "skip")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke={color}
          strokeWidth="3"
        />
        <path
          d="M6.5 17.5 17.5 6.5"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  if (value === "rev")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 9h11l-3-3M19 15H8l3 3"
          stroke={color}
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (value === "wild")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3a9 9 0 0 1 9 9h-9z" fill="#3b6cf0" />
        <path d="M21 12a9 9 0 0 1-9 9v-9z" fill="#1f9d6b" />
        <path d="M12 21a9 9 0 0 1-9-9h9z" fill="#ffb02e" />
        <path d="M3 12a9 9 0 0 1 9-9v9z" fill="#e5484d" />
      </svg>
    );
  return (
    <span
      className="font-display leading-none font-black"
      style={{ color, fontSize: size * (value.length > 1 ? 0.8 : 1) }}
    >
      {value}
    </span>
  );
}

/** A Last Card card: its colour, a white tilted oval, and the value in the middle and corners */
export function Card({ card, glow }: { card: string; glow?: boolean }) {
  const c = parse(card);
  const wild = c.colour === "w";
  const bg = wild ? "#1c1828" : LC_COLOURS[c.colour as Colour].hex;
  const ink = wild ? "#1c1828" : bg;
  const corner =
    c.value === "skip"
      ? "⊘"
      : c.value === "rev"
        ? "⇄"
        : c.value === "wild"
          ? ""
          : c.value;
  return (
    <span
      className="relative grid h-[94px] w-[64px] place-items-center overflow-hidden rounded-[12px] border-[3px] border-white"
      style={{
        background: bg,
        boxShadow: glow
          ? "0 0 0 3px #f2b33d, 0 10px 20px rgba(0,0,0,0.45)"
          : "0 4px 8px rgba(0,0,0,0.35)",
      }}
    >
      <span className="absolute inset-x-[9%] inset-y-[16%] rotate-[-28deg] rounded-[50%] bg-white" />
      <span className="relative">
        <Face value={c.value} size={c.value === "wild" ? 34 : 30} color={ink} />
      </span>
      {wild && c.value === "+4" && (
        <span className="absolute bottom-[18%] flex gap-0.5">
          {COLOURS.map((k) => (
            <span
              key={k}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: LC_COLOURS[k].hex }}
            />
          ))}
        </span>
      )}
      <span className="absolute top-0.5 left-1 font-display text-[12px] font-black text-white">
        {corner}
      </span>
      <span className="absolute right-1 bottom-0.5 rotate-180 font-display text-[12px] font-black text-white">
        {corner}
      </span>
    </span>
  );
}

function CardBack({ small }: { small?: boolean }) {
  return (
    <span
      className={clsx(
        "grid place-items-center border-2 border-white/85",
        small
          ? "h-[58px] w-[40px] rounded-[9px]"
          : "h-[94px] w-[64px] rounded-[12px]",
      )}
      style={{
        background: "linear-gradient(145deg,#3a1240 0%,#1a0620 100%)",
        boxShadow: "0 3px 6px rgba(0,0,0,0.35)",
      }}
    >
      <span
        className={clsx(
          "-rotate-[18deg] rounded-full bg-[#e5484d] font-display font-black text-white",
          small ? "px-1 text-[7px]" : "px-2 py-0.5 text-[11px]",
        )}
      >
        LAST
      </span>
    </span>
  );
}

function lastLine(st: LastCardState, me: string, them: string) {
  const l = st.last;
  if (!l) return `${them} goes first`;
  const who = l.by === me ? "You" : them;
  if (l.caught)
    return l.by === me ? `You caught ${them}: +2` : `${them} caught you: +2`;
  if (l.card)
    return `${who} played ${cardName(l.card)}${l.note && !/^\d/.test(l.note) ? ` · ${l.note}` : ""}`;
  if (l.drew) return `${who} drew ${l.drew}`;
  return `${who} ${l.note.toLowerCase()}`;
}

const bigCard = (card: string) => (
  <span className="block scale-[1.45]">
    <Card card={card} />
  </span>
);

/** The pop-up for an action card, a catch, or a last card */
function lastCardPop(
  st: LastCardState,
  byMe: boolean,
  them: string,
): Omit<Pop, "id"> | null {
  const l = st.last;
  if (!l) return null;
  if (l.caught)
    return byMe
      ? {
          title: "Caught!",
          sub: `${them} forgot to call it · +2`,
          tone: "good",
        }
      : { title: "Caught!", sub: "You forgot to call it · +2", tone: "bad" };
  if (!l.card) return null;
  const c = parse(l.card);
  const art = bigCard(l.card);
  const colour = LC_COLOURS[st.colour].name;
  if (c.value === "+2" || c.value === "+4") {
    const owed = st.pending;
    return byMe
      ? {
          title: `+${owed}!`,
          sub: `${them} draws ${owed} · unless they stack${c.value === "+4" ? ` · ${colour}` : ""}`,
          tone: "good",
          art,
        }
      : {
          title: `+${owed}!`,
          sub: `Stack it or draw ${owed}${c.value === "+4" ? ` · ${colour}` : ""}`,
          tone: "bad",
          art,
          gift: `Ouch. Send ${them} a 🔥`,
        };
  }
  if (c.value === "skip" || c.value === "rev") {
    const t = c.value === "skip" ? "Skip!" : "Reverse!";
    return byMe
      ? { title: t, sub: "You go again", tone: "good", art }
      : { title: t, sub: `${them} goes again`, tone: "move", art };
  }
  if (c.value === "wild")
    return byMe
      ? {
          title: "Wild!",
          sub: `You picked ${colour.toLowerCase()}`,
          tone: "good",
          art,
        }
      : {
          title: "Wild!",
          sub: `${them} wants ${colour.toLowerCase()}`,
          tone: "move",
          art,
        };
  const left = l.by === "a" ? st.count_a : st.count_b;
  if (left === 1 && l.called)
    return byMe
      ? { title: "Last card!", sub: "One more and you win", tone: "good" }
      : { title: "Last card!", sub: `${them} has one card left`, tone: "bad" };
  return null;
}

const DEMO_POPS = (them: string): Record<string, Omit<Pop, "id">> => ({
  plus4: {
    title: "+4!",
    sub: "Stack it or draw 4 · Yellow",
    tone: "bad",
    art: bigCard("w:+4"),
  },
  plus2: {
    title: "+2!",
    sub: `${them} draws 2 · unless they stack`,
    tone: "good",
    art: bigCard("b:+2"),
  },
  skip: {
    title: "Skip!",
    sub: "You go again",
    tone: "good",
    art: bigCard("y:skip"),
  },
  wild: {
    title: "Wild!",
    sub: `${them} wants blue`,
    tone: "move",
    art: bigCard("w:wild"),
  },
  caught: {
    title: "Caught!",
    sub: `${them} forgot to call it · +2`,
    tone: "good",
  },
  last: { title: "Last card!", sub: `${them} has one card left`, tone: "bad" },
});
