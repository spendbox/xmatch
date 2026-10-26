"use client";

import { Component, useEffect, useRef, useState } from "react";
import { reportError } from "@/lib/reportError";
import { lockScroll } from "@/lib/scrollLock";
import { createPortal } from "react-dom";
import { ChevronLeft, Gift, Volume2, VolumeX, X } from "lucide-react";
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
import { Bombshell } from "./Bombshell";
import { GemClash } from "./GemClash";
import { Ludo } from "./Ludo";
import { GamePop, GIFT_EVENT, usePops } from "./GamePop";
import { ChatFab, ChatPanel, PersonSheet, useGameChat, useGameSignals, type PlayPerson } from "./GameSocial";
import { GiftArt } from "@/components/keys/GiftArt";
import { GIFTS } from "@/lib/keys";
import { GiftSheet, keysError } from "@/components/keys/GiftSheet";
import { createClient } from "@/lib/supabase/client";
import { SnakesLadders } from "./SnakesLadders";
import { ReactionButton, ReactionHint, ReactionLayer, ReactionTray, useReactionHint, useReactions } from "./Reactions";

/** The full-screen game: challenge, 3-2-1, the game itself, then results */
export function GameArena(props: React.ComponentProps<typeof GameArenaInner>) {
  return (
    <GameSafe onClose={props.onClose} kind={props.game.kind} status={props.game.status}>
      <GameArenaInner {...props} />
    </GameSafe>
  );
}

/** If a game breaks, show a way out instead of taking the whole app down (and report it) */
class GameSafe extends Component<{ onClose: () => void; kind: string; status: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportError(error, `game ${this.props.kind} ${this.props.status}`);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#0b0720] px-8 text-center text-white" role="dialog">
        <p className="font-display text-[26px] font-bold">This game hit a problem</p>
        <p className="mt-2 text-[14px] text-white/70">We&apos;ve been told about it. Your chats are safe.</p>
        <button type="button" onClick={this.props.onClose} className="mt-7 h-13 w-full max-w-[280px] rounded-2xl bg-white py-3.5 text-[16px] font-bold text-[#1a1240]">
          Close
        </button>
      </div>
    );
  }
}

function GameArenaInner({
  game,
  names,
  act,
  onMinimize,
  onClose,
  peek,
  unmask,
  practice,
  chat,
  person,
  results,
  onGiftSend,
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
  /** Against the computer while waiting for a player: nothing is sent anywhere */
  practice?: boolean;
  /** Play games: the chat with the other player (none yet until someone pays to start it) */
  chat?: { matchId: string | null; cost: number; balance: number | null; onStart: () => Promise<string | null>; onRefresh?: () => void } | null;
  /** Play games: who you're playing (tap their name to see them) */
  person?: { open: boolean; setOpen: (v: boolean) => void; info: PlayPerson | null } | null;
  /** Play games: more ways on from the results */
  results?: { onNew: () => void; closeLabel?: string } | null;
  /** Play games send gifts their own way */
  onGiftSend?: (giftId: string) => Promise<string | null>;
}) {
  useTicker(250);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showResults, setShowResults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sound = useGameSound();
  const reacting = !practice && (game.status === "active" || game.status === "done" || game.status === "cancelled");
  const reactions = useReactions(reacting ? game.id : null);
  const [tray, setTray] = useState(false);
  const reactHint = useReactionHint(game.status === "active");
  const info = gameInfo(game.kind);
  const over = game.status === "done" || game.status === "cancelled";
  const endedAgo = game.ended_at ? (act.now() - new Date(game.ended_at).getTime()) / 1000 : 99;

  // A big moment: offer to send a gift (real games only, at most once a minute)
  const [giftLine, setGiftLine] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const lastOffer = useRef(0);
  const canGift = !practice && !!(game.session_id || game.match_id || game.play);
  const myId = game.me === "a" ? game.player_a : game.player_b;
  // Chat inside the game: Play games and games with your people (masked chats already have their chat)
  const chatMatch = chat ? chat.matchId : game.match_id;
  const chatOn = !practice && !game.session_id && (!!chat || !!game.match_id);
  const [chatOpen, setChatOpen] = useState(false);
  const talk = useGameChat(chatOn ? chatMatch : null, myId, chatOpen);
  const pops = usePops();
  const signal = useGameSignals(practice ? null : game.id, (event, payload) => {
    if (event === "gift") {
      const g = GIFTS.find((x) => x.id === payload.gift);
      pops.show({ title: `${g?.name ?? "Gift"}!`, sub: `${names.them} sent you ${g ? `a ${g.name}` : "a gift"}`, tone: "good", art: <GiftArt id={payload.gift} size={110} /> });
    }
    // They just started a chat: show it here straight away
    if (event === "chat") chat?.onRefresh?.();
  });
  async function sendGift(giftId: string) {
    const e = onGiftSend
      ? await onGiftSend(giftId)
      : await createClient()
          .rpc("send_gift", { p_gift: giftId, p_session: game.session_id, p_match: game.match_id })
          .then(({ error }) => (error ? keysError(error.message) : null));
    if (e) return e;
    signal("gift", { gift: giftId });
    const g = GIFTS.find((x) => x.id === giftId);
    setGiftOpen(false);
    pops.show({ title: "Sent!", sub: `You sent ${names.them} ${g ? `a ${g.name}` : "a gift"}`, tone: "good", art: <GiftArt id={giftId} size={100} /> });
    return null;
  }
  async function startChat() {
    if (!chat) return null;
    const e = await chat.onStart();
    if (!e) signal("chat");
    return e;
  }
  useEffect(() => {
    if (!canGift) return;
    const on = (e: Event) => {
      if (Date.now() - lastOffer.current < 60_000) return;
      lastOffer.current = Date.now();
      setGiftLine((e as CustomEvent<string>).detail);
    };
    window.addEventListener(GIFT_EVENT, on);
    return () => window.removeEventListener(GIFT_EVENT, on);
  }, [canGift]);
  useEffect(() => {
    if (!giftLine) return;
    const t = setTimeout(() => setGiftLine(null), 7000);
    return () => clearTimeout(t);
  }, [giftLine]);
  async function openGifts() {
    setGiftLine(null);
    setGiftOpen(true);
    const { data } = await createClient().rpc("my_wallet");
    setBalance((data as { balance?: number } | null)?.balance ?? null);
  }

  // Lock the page behind
  useEffect(() => {
    const unlock = lockScroll();
    return () => {
      unlock();
    };
  }, []);

  // New game: start from the top
  useEffect(() => {
    setShowResults(false);
    setErr(null);
  }, [game.id]);

  async function leave() {
    if (practice) return onClose();
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

  // A challenge called off before it began ("Play again", then cancelled): nothing on the board to show
  const neverStarted = game.status === "cancelled" && !game.ended_reason && Object.keys(game.state ?? {}).length === 0;

  if (game.status === "invited") {
    body = <Challenge game={game} names={names} act={act} onClose={onClose} />;
  } else if (game.status === "declined" || game.status === "expired" || neverStarted) {
    body = (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-white">
          <MaskIcon className="w-11" eyes="#1a1240" />
        </span>
        <p className="mt-5 font-display text-[28px] font-bold">
          {neverStarted
            ? game.me === "a"
              ? "Challenge cancelled"
              : `${names.them} called it off`
            : game.status === "declined"
              ? game.me === "a"
                ? `${names.them} said not now`
                : "Maybe next time"
              : "Challenge ran out"}
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
      // Only replay the final board if there is one
      Object.keys(game.state ?? {}).length > 0 &&
      ((game.kind === "truths" && game.state.phase === "reveal") || (game.kind === "c4" && endedAgo < 10) ||
        (["tot", "whot", "checkers", "chess", "ayo", "gems", "ludo", "snakes"].includes(game.kind) && endedAgo < 3) || (game.kind === "bomb" && endedAgo < 4));
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
          more={results ? { onNew: results.onNew, onMessage: chatOn ? () => setChatOpen(true) : undefined, closeLabel: results.closeLabel } : undefined}
        />
      );
    } else if (game.kind === "c4") body = <ConnectFour game={game} names={names} act={act} peek={peek} onPeek={onMinimize} />;
    else if (game.kind === "tot") body = <ThisOrThat game={game} names={names} act={act} />;
    else if (game.kind === "truths") body = <TwoTruths game={game} names={names} act={act} onResults={() => setShowResults(true)} />;
    else if (game.kind === "whot") body = <Whot game={game} names={names} act={act} />;
    else if (game.kind === "checkers") body = <Checkers game={game} names={names} act={act} />;
    else if (game.kind === "chess") body = <ChessGame game={game} names={names} act={act} />;
    else if (game.kind === "ayo") body = <Ayo game={game} names={names} act={act} />;
    else if (game.kind === "bomb") body = <Bombshell game={game} names={names} act={act} />;
    else if (game.kind === "gems") body = <GemClash game={game} names={names} act={act} />;
    else if (game.kind === "ludo") body = <Ludo game={game} names={names} act={act} />;
    else if (game.kind === "snakes") body = <SnakesLadders game={game} names={names} act={act} />;
    else body = <WordHunt game={game} names={names} act={act} />;
  }

  const bar = !(game.status === "invited" && game.me === "b") && !resultsView;
  // Turn-based games: make it obvious when it's your move
  const myTurn = game.status === "active" && !intro && TURN_GAMES.includes(game.kind) && game.state?.turn === game.me;

  if (!mounted) return null;
  return createPortal(
    <div className="gm-arena fixed inset-0 z-[60] flex justify-center bg-[#0b0720] animate-fade-in" role="dialog" aria-label={info.title}>
      <div className={`relative flex h-dvh w-full flex-col overflow-hidden ${WIDE_GAMES.includes(game.kind) ? "max-w-md lg:max-w-none" : "max-w-md"}`} style={{ background: info.bg }}>
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
            {myTurn ? (
              <p className="min-w-0 flex-1 text-center">
                <span className="gm-pulse inline-block rounded-full bg-gradient-to-b from-[#ffd36b] to-gold px-3 py-1.5 font-display text-[13px] font-black tracking-[0.08em] whitespace-nowrap text-ink uppercase min-[400px]:px-4 min-[400px]:text-[15px] min-[400px]:tracking-[0.12em] shadow-[0_0_0_3px_rgba(242,179,61,0.3),0_6px_20px_-4px_rgba(242,179,61,0.8)]">
                  Your turn
                </span>
              </p>
            ) : (
              <p className="min-w-0 flex-1 truncate text-center text-[11px] font-extrabold tracking-[0.16em] text-gold uppercase">{practice ? `Practice · ${info.title}` : info.title}</p>
            )}
            {reacting && (
              <ReactionButton
                open={tray}
                pulse={reactHint.hint}
                onToggle={() => {
                  reactHint.dismiss();
                  setTray((t) => !t);
                }}
              />
            )}
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
        <TurnStamp on={myTurn} />
        {reacting && resultsView && (
          <div className="absolute top-[max(12px,env(safe-area-inset-top))] right-3 z-40">
            <ReactionButton open={tray} onToggle={() => setTray((t) => !t)} />
          </div>
        )}
        {reacting && reactHint.hint && !tray && (
          <ReactionHint
            onTry={() => {
              reactHint.dismiss();
              setTray(true);
            }}
          />
        )}
        {reacting && tray && <ReactionTray onSend={reactions.send} onIdle={() => setTray(false)} />}
        <ReactionLayer floats={reactions.floats} />
        {/* Gifts: a tab on the side of the screen, halfway down, always in reach */}
        {canGift && !resultsView && (
          <button
            type="button"
            onClick={() => void openGifts()}
            aria-label={`Send ${names.them} a gift`}
            className="absolute top-1/2 right-0 z-40 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-l-2xl bg-gradient-to-b from-[#ffd36b] to-gold py-3 pr-1.5 pl-2.5 text-ink shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)] transition active:scale-95"
          >
            <Gift size={22} />
            <span className="text-[10px] font-extrabold tracking-wide uppercase">Gift</span>
          </button>
        )}
        {chatOn && <ChatFab unread={talk.unread} locked={!chatMatch} onOpen={() => setChatOpen(true)} />}
        {chatOn && (
          <ChatPanel
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            them={{ name: names.them, photo: names.themPhoto }}
            matchId={chatMatch}
            myId={myId}
            messages={talk.messages}
            onSend={talk.send}
            cost={chat?.cost ?? 0}
            balance={chat?.balance ?? null}
            onStart={startChat}
          />
        )}
        {person && (
          <PersonSheet
            open={person.open}
            onClose={() => person.setOpen(false)}
            person={person.info}
            onMessage={() => {
              person.setOpen(false);
              setChatOpen(true);
            }}
          />
        )}
        <GamePop pop={pops.pop} big={WIDE_GAMES.includes(game.kind)} />
        {giftLine && (
          <div className="pointer-events-none absolute inset-x-0 top-[calc(max(12px,env(safe-area-inset-top))+52px)] z-50 flex justify-center px-4">
            <button
              type="button"
              onClick={() => void openGifts()}
              className="gm-burst pointer-events-auto flex items-center gap-2.5 rounded-full bg-white py-1.5 pr-1.5 pl-3 text-ink shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)]"
            >
              <Gift size={18} className="shrink-0 text-chili" />
              <span className="text-[13.5px] font-semibold">{giftLine}</span>
              <span className="rounded-full bg-gold px-3 py-1.5 text-[13px] font-extrabold">Send</span>
            </button>
          </div>
        )}
        {canGift && (
          <GiftSheet
            open={giftOpen}
            onClose={() => setGiftOpen(false)}
            layer="z-[70]"
            balance={balance}
            toName={names.them}
            subtitle={chatMatch || game.session_id ? "It pops up in your chat, and they get Keys from it." : "It pops up on their screen now, and they get Keys from it."}
            onSend={(g) => sendGift(g.id)}
          />
        )}
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

const TURN_GAMES = ["c4", "whot", "checkers", "chess", "ayo", "gems", "bomb", "ludo", "snakes"];
/** Board games that use the whole screen on computers */
const WIDE_GAMES = ["ludo", "snakes"];

/** A big "Your turn!" for a moment whenever it becomes your move */
function TurnStamp({ on }: { on: boolean }) {
  const [show, setShow] = useState(0);
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current) {
      setShow(Date.now());
      buzz([15, 40, 15]);
      sfx("tick");
      const t = setTimeout(() => setShow(0), 1100);
      was.current = on;
      return () => clearTimeout(t);
    }
    was.current = on;
  }, [on]);
  if (!show) return null;
  return (
    <div key={show} aria-hidden className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
      <span className="gm-stamp rounded-[22px] bg-gradient-to-b from-[#ffd36b] to-gold px-7 py-3 font-display text-[34px] font-black text-ink shadow-[0_8px_0_#b9831e,0_24px_60px_-10px_rgba(242,179,61,0.8)]">
        Your turn!
      </span>
    </div>
  );
}
