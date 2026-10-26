"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { chime } from "@/lib/chime";
import { buzz, cleanError, gameInfo, type Game, type GameActions } from "@/lib/games";
import { keysError } from "@/components/keys/GiftSheet";
import { Avatar } from "@/components/ui/Avatar";
import { GameArena } from "@/components/games/LazyGameArena";
import type { PlayPerson } from "@/components/games/GameSocial";

const PlayCtx = createContext<{ open: (gameId: string) => void }>({ open: () => {} });

/** Open a Play game from anywhere (the Play screen does this when you're paired) */
export const usePlayGames = () => useContext(PlayCtx);

/**
 * Play games live above the whole app: full screen while you play, a small bubble when you
 * minimise it (the game keeps going), and rematch invites open wherever you are.
 */
export function PlayProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const path = usePathname();
  const [gameId, setGameId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const current = useRef<string | null>(null);
  current.current = gameId;

  const show = useCallback((id: string, full = true) => {
    setGameId(id);
    if (full) setOpen(true);
  }, []);

  // Back in the app: a game that's on shows as a bubble; a rematch waiting for you opens
  useEffect(() => {
    void supabase.rpc("play_live").then(({ data }) => {
      const g = data as { id: string; status: string } | null;
      if (g && !current.current) show(g.id, g.status === "invited");
    });
  }, [supabase, show]);

  // Opened from a notification (…?game=ID)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("game");
    if (!id) return;
    show(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [path, show]);

  // A new Play game with you in it (a rematch, or their yes to yours): open it
  useEffect(() => {
    const onRow = (p: { new: unknown }) => {
      const g = (p.new ?? {}) as { id?: string; play?: boolean; status?: string; player_b?: string };
      if (!g.id || !g.play || g.id === current.current) return;
      if (g.status === "active" || (g.status === "invited" && g.player_b === userId)) show(g.id);
    };
    const ch = supabase
      .channel(`play-games-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `player_a=eq.${userId}` }, onRow)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `player_b=eq.${userId}` }, onRow)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, userId, show]);

  const ctx = useMemo(() => ({ open: (id: string) => show(id) }), [show]);
  return (
    <PlayCtx.Provider value={ctx}>
      {children}
      {gameId && (
        <PlayGameView
          key={gameId}
          gameId={gameId}
          userId={userId}
          open={open}
          setOpen={setOpen}
          onClose={() => {
            setOpen(false);
            setGameId(null);
          }}
          onSwitch={(id) => show(id)}
        />
      )}
    </PlayCtx.Provider>
  );
}

/** One Play game: loads it live, and sends your moves */
function usePlayGame(gameId: string, onSwitch: (id: string) => void) {
  const supabase = useMemo(() => createClient(), []);
  const [game, setGame] = useState<Game | null>(null);
  const offset = useRef(0);
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("get_game", { p_game: gameId });
    const g = data as Game | null;
    if (g?.server_now) offset.current = new Date(g.server_now).getTime() - Date.now();
    if (g) setGame(g);
  }, [supabase, gameId]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`play-game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => void load())
      .subscribe();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [supabase, gameId, load]);

  const now = useCallback(() => Date.now() + offset.current, []);
  const live = game?.status === "invited" || game?.status === "active";
  const deadline = game?.deadline_at ?? null;

  // When a timer runs out, nudge the server (both phones do this; the server only acts once)
  useEffect(() => {
    if (!live || !deadline) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const fire = async () => {
      if (stop) return;
      await supabase.rpc("game_tick", { p_game: gameId });
      await load();
      if (!stop) t = setTimeout(fire, 1500);
    };
    t = setTimeout(fire, Math.max(0, new Date(deadline).getTime() - now()) + 250);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [live, deadline, supabase, gameId, load, now]);

  // Safety net: re-check every few seconds in case a live update was missed
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 6000);
    return () => clearInterval(t);
  }, [live, load]);

  const act: GameActions = {
    // Play again: the same game with the same person
    start: async () => {
      const { data, error } = await supabase.rpc("play_rematch", { p_game: gameId });
      if (error) return cleanError(error.message);
      if (data && data !== gameId) {
        notify({ kind: "game_invite", gameId: data as string });
        onSwitch(data as string);
      }
      return null;
    },
    respond: async (accept) => {
      const { error } = await supabase.rpc("respond_game", { p_game: gameId, p_accept: accept });
      await load();
      return error ? cleanError(error.message) : null;
    },
    cancel: async () => {
      await supabase.rpc("cancel_game", { p_game: gameId });
      await load();
    },
    call: async (fn, args) => {
      const { data, error } = await supabase.rpc(fn, args);
      void load();
      return { data, error: error ? cleanError(error.message) : null };
    },
    move: async (move) => {
      const res = await fetch("/api/games/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: gameId, move }) }).catch(() => null);
      await load();
      if (!res) return "Couldn't reach Dashpad. Check your connection.";
      if (res.ok) return null;
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return j.error ?? "That didn't work. Try again.";
    },
    refresh: load,
    now,
  };
  return { game, act };
}

function PlayGameView({
  gameId,
  userId,
  open,
  setOpen,
  onClose,
  onSwitch,
}: {
  gameId: string;
  userId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onClose: () => void;
  onSwitch: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { game, act } = usePlayGame(gameId, onSwitch);
  const [info, setInfo] = useState<PlayPerson | null>(null);
  const [personOpen, setPersonOpen] = useState(false);

  const loadInfo = useCallback(async () => {
    const { data } = await supabase.rpc("play_info", { p_game: gameId });
    if (data) setInfo(data as PlayPerson);
  }, [supabase, gameId]);
  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  // Minimised: buzz when it becomes your turn
  const myTurn = !!game && game.status === "active" && (game.state as { turn?: string })?.turn === game.me;
  const wasTurn = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !wasTurn.current && !open) {
      buzz([20, 50, 20]);
      chime();
    }
    wasTurn.current = myTurn;
  }, [myTurn, open]);

  if (!game) return null;
  const them = info?.name ?? "Player";
  const names = { me: "You", them, mePhoto: info?.me_photo ?? null, themPhoto: info?.photos?.[0] ?? null, onThem: () => setPersonOpen(true) };

  if (!open) {
    const over = !(game.status === "active" || game.status === "invited");
    const waiting = game.status === "invited" && game.me === "a";
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[45] flex items-center gap-2 rounded-full bg-ink py-1.5 pr-4 pl-1.5 text-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] lg:bottom-6",
          myTurn && "gm-pulse ring-2 ring-gold",
        )}
        aria-label={`Back to ${gameInfo(game.kind).title}`}
      >
        <Avatar src={names.themPhoto ?? undefined} name={them} size={36} />
        <span className="text-left leading-tight">
          <span className="block text-[13px] font-bold">{gameInfo(game.kind).title}</span>
          <span className={clsx("block text-[11.5px] font-semibold", myTurn ? "text-gold" : "text-white/70")}>
            {over ? "See the result" : waiting ? `Waiting for ${them.split(" ")[0]}` : myTurn ? "Your turn" : `${them.split(" ")[0]}'s turn`}
          </span>
        </span>
      </button>
    );
  }

  return (
    <GameArena
      game={game}
      names={names}
      act={act}
      onMinimize={() => setOpen(false)}
      onClose={onClose}
      chat={{
        matchId: info?.match_id ?? null,
        cost: info?.cost ?? 0,
        balance: info?.balance ?? null,
        onRefresh: loadInfo,
        onStart: async () => {
          const { data, error } = await supabase.rpc("play_chat_open", { p_game: gameId });
          if (error) return keysError(error.message);
          setInfo((i) => (i ? { ...i, match_id: data as string } : i));
          void loadInfo();
          return null;
        },
      }}
      person={{ open: personOpen, setOpen: setPersonOpen, info }}
      results={{
        closeLabel: "Close",
        onNew: () => {
          onClose();
          router.push("/play");
        },
      }}
      onGiftSend={async (giftId) => {
        const { error } = await supabase.rpc("play_gift", { p_game: gameId, p_gift: giftId });
        if (error) return keysError(error.message);
        void loadInfo();
        return null;
      }}
      key={userId}
    />
  );
}
