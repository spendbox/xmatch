"use client";

import { useEffect, useState } from "react";
import { buzz, sfx, type Game, type GameActions } from "@/lib/games";
import { secondsLeft } from "./parts";

/** Sending a move: shows it's working, and the error if the server says no */
export function useMove(game: Game, act: GameActions) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const started = secondsLeft(game.started_at, act.now) <= 0;

  // A move from either side clears an old message
  useEffect(() => {
    setNote(null);
  }, [game.state?.moves]);

  async function send(move: unknown) {
    if (busy) return false;
    setBusy(true);
    setNote(null);
    buzz(10);
    const err = await act.move(move);
    setBusy(false);
    if (err) {
      setNote(err);
      sfx("bad");
      return false;
    }
    sfx("drop");
    return true;
  }

  return { send, busy, note, setNote, started };
}
