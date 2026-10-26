"use client";

import dynamic from "next/dynamic";

/**
 * The game screen, downloaded only when a game opens. Every game (chess included) lives in
 * it, so chats and Home load much faster without it.
 */
export const GameArena = dynamic(() => import("./GameArena").then((m) => m.GameArena), { ssr: false, loading: () => null });
