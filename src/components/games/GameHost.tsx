"use client";

import { useEffect, useRef, useState } from "react";
import { Gamepad2, X } from "lucide-react";
import { tapFeedback } from "@/components/ui/Button";
import { gameInfo, useChatGame, type GameKind } from "@/lib/games";
import { GameArena } from "./LazyGameArena";
import { GameLauncher } from "./GameLauncher";
import { secondsLeft, useTicker, type Names } from "./parts";

/**
 * Games inside a chat: the game button for the composer, a banner for
 * challenges and games in progress, and the full-screen arena.
 */
export function useGameHost({
  sessionId = null,
  matchId = null,
  names,
  masked,
  disabled,
  offline,
  peek,
  unmask,
  noLauncher,
}: {
  sessionId?: string | null;
  matchId?: string | null;
  names: Names;
  masked: boolean;
  disabled?: boolean;
  /** Design previews: don't talk to the server */
  offline?: boolean;
  peek?: string | null;
  unmask?: { onUnmask: () => void; done: boolean } | null;
  /** Games can't be started from this chat yet (a game meet waiting for its turn) */
  noLauncher?: boolean;
}) {
  const { game, actions, clear } = useChatGame({ sessionId, matchId, disabled: disabled || offline });
  const [launcher, setLauncher] = useState(false);
  const [open, setOpen] = useState(false);
  const seen = useRef<{ id: string; status: string } | null>(null);
  const first = useRef(true);

  // Open the arena for a new challenge, and when a game starts
  useEffect(() => {
    if (!game) return;
    const prev = seen.current;
    const isNew = !prev || prev.id !== game.id;
    const changed = isNew || prev?.status !== game.status;
    seen.current = { id: game.id, status: game.status };
    const initial = first.current;
    first.current = false;
    // Opening a chat with a game that's just starting (Play pairs you straight into one): open it
    if (initial && game.status === "active" && game.started_at && Date.now() - new Date(game.started_at).getTime() < 60_000) return setOpen(true);
    if (!changed || initial) return;
    if (game.status === "invited" && game.me === "b") setOpen(true);
    else if (game.status === "active") setOpen(true);
    else if (game.status === "declined" && game.me === "b") clear();
  }, [game, clear]);

  const startGame = async (k: GameKind) => actions.start(k);
  const live = !!game && (game.status === "active" || game.status === "invited");

  const button = (
    <button
      type="button"
      onClick={() => {
        tapFeedback();
        if (live) setOpen(true);
        else setLauncher(true);
      }}
      disabled={disabled || (noLauncher && !live)}
      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition active:scale-95 disabled:opacity-50"
      aria-label="Play a game"
      title="Play a game"
    >
      <Gamepad2 size={21} />
      {game?.status === "active" && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-surface" />}
    </button>
  );

  const banner =
    game && !open ? (
      <Banner
        game={game}
        names={names}
        onOpen={() => setOpen(true)}
        onCancel={() => void actions.cancel()}
        onDismiss={clear}
        now={actions.now}
      />
    ) : null;

  const overlay = (
    <>
      <GameLauncher
        open={launcher}
        onClose={() => setLauncher(false)}
        them={names.them}
        masked={masked}
        record={game?.record}
        onPick={startGame}
      />
      {game && open && (
        <GameArena
          game={game}
          names={names}
          act={actions}
          peek={peek}
          unmask={unmask}
          onMinimize={() => setOpen(false)}
          onClose={() => {
            setOpen(false);
            if (game.status !== "active" && game.status !== "invited") clear();
          }}
        />
      )}
    </>
  );

  /** For the + menu beside the message box: open the game in progress, or pick one */
  const play = () => (live ? setOpen(true) : setLauncher(true));
  const canPlay = !disabled && !(noLauncher && !live);

  return { button, banner, overlay, game, play, canPlay, live, openLauncher: () => setLauncher(true), rematch: (k: string) => void actions.start(k as GameKind) };
}

function Banner({
  game,
  names,
  onOpen,
  onCancel,
  onDismiss,
  now,
}: {
  game: NonNullable<ReturnType<typeof useChatGame>["game"]>;
  names: Names;
  onOpen: () => void;
  onCancel: () => void;
  onDismiss: () => void;
  now: () => number;
}) {
  useTicker(500);
  const info = gameInfo(game.kind);
  const left = Math.ceil(secondsLeft(game.deadline_at, now));
  let text: React.ReactNode;
  let action: React.ReactNode = null;
  const btn = "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold transition active:scale-95";

  if (game.status === "invited" && game.me === "a") {
    text = (
      <>
        <b className="text-white">Challenge sent.</b> Waiting for {names.them} · {left}s
      </>
    );
    action = (
      <button type="button" onClick={onCancel} className={`${btn} bg-white/12 text-white`}>
        Cancel
      </button>
    );
  } else if (game.status === "invited") {
    text = (
      <>
        <b className="text-white">{names.them}</b> challenged you to {info.title} · {left}s
      </>
    );
    action = (
      <button type="button" onClick={onOpen} className={`${btn} gm-gold`}>
        Play
      </button>
    );
  } else if (game.status === "active") {
    const myTurn = game.kind === "c4" && game.state.turn === game.me;
    text = (
      <>
        <b className="text-white">{info.title}</b> · {myTurn ? "your move" : "in progress"}
      </>
    );
    action = (
      <button type="button" onClick={onOpen} className={`${btn} gm-gold`}>
        Back to game
      </button>
    );
  } else if (game.status === "done" || game.status === "cancelled") {
    text = (
      <>
        <b className="text-white">{info.title}</b> is over
      </>
    );
    action = (
      <button type="button" onClick={onOpen} className={`${btn} bg-white/12 text-white`}>
        See results
      </button>
    );
  } else {
    text = game.status === "declined" ? `${names.them} said not now. Keep chatting, then try again.` : "The challenge ran out.";
  }

  return (
    <div className="flex animate-fade-up items-center gap-3 px-4 py-2.5 text-white" style={{ background: "linear-gradient(90deg, #2b1d73, #1a1240)" }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/12">
        <Gamepad2 size={17} className="text-gold" />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-white/80">{text}</p>
      {action}
      {game.status !== "invited" && game.status !== "active" && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 place-items-center text-white/60">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
