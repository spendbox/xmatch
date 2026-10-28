"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * Games tell the game screen while a move is still playing out (seeds sowing, a token
 * hopping, a card flying), so "Your turn!" only shows once the other player's move has ended.
 */
export const BoardBusy = createContext<((busy: boolean) => void) | null>(null);

export function useReportBusy(busy: boolean) {
  const report = useContext(BoardBusy);
  useEffect(() => {
    report?.(busy);
  }, [report, busy]);
  // Not busy any more once the game closes
  useEffect(() => () => report?.(false), [report]);
}
