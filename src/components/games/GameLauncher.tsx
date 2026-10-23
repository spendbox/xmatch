"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, X } from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import { usePrices } from "@/components/keys/usePrices";
import { GAMES, sfx, type GameKind } from "@/lib/games";
import { ChessPiece } from "./ChessPieces";

/** Pick a game to challenge the other person to */
export function GameLauncher({
  open,
  onClose,
  them,
  masked,
  record,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  them: string;
  masked: boolean;
  record?: { won: number; lost: number; played: number } | null;
  onPick: (k: GameKind) => Promise<string | null>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const prices = usePrices();
  const [busy, setBusy] = useState<GameKind | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const list = GAMES.filter((g) => (prices as Record<string, number>)[`game_${g.kind}`] !== 0);

  async function pick(k: GameKind) {
    setBusy(k);
    setErr(null);
    sfx("tap");
    const e = await onPick(k);
    setBusy(null);
    if (e) setErr(e);
    else onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-end justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/45 animate-fade-in" />
      <div
        className="relative w-full max-w-md animate-sheet-up rounded-t-[32px] px-[18px] pt-3 pb-[max(24px,env(safe-area-inset-bottom))] text-white"
        style={{ background: "radial-gradient(120% 70% at 50% 0%, #3b2a96 0%, #1a1240 60%, #0f0a2a 100%)" }}
      >
        <div className="mx-auto mb-4 h-[5px] w-11 rounded-full bg-white/25" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold tracking-[0.14em] text-gold">GAME NIGHT</p>
            <h2 className="mt-1 truncate font-display text-[28px] leading-[1.05] font-bold">Play with {them}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/12">
            <X size={20} />
          </button>
        </div>
        <p className="mt-1.5 mb-4 text-[13px] text-white/70">{masked ? "Still masked. " : ""}Quick games, about 2–4 minutes each.</p>

        <div className="grid grid-cols-2 gap-3">
          {list.map((g) => (
            <button
              key={g.kind}
              type="button"
              onClick={() => pick(g.kind)}
              disabled={!!busy}
              className="gm-btn relative rounded-[22px] border border-white/12 p-3 text-left disabled:opacity-70"
              style={{ background: g.card, boxShadow: `0 6px 0 ${g.edge}`, "--edge": g.edge } as React.CSSProperties}
            >
              <div className="relative h-[78px]">
                <GameArt kind={g.kind} />
                {busy === g.kind && (
                  <span className="absolute inset-0 grid place-items-center">
                    <Spinner className="h-6 w-6" />
                  </span>
                )}
              </div>
              <p className="mt-2 text-[15px] leading-tight font-extrabold">{g.title}</p>
              <p className="text-[12px] text-white/75">{g.short}</p>
            </button>
          ))}
        </div>

        {err && <p className="mt-3 rounded-2xl bg-white px-4 py-2.5 text-center text-[13px] font-semibold text-ink">{err}</p>}

        {record && record.played > 0 && (
          <div className="mt-4 flex items-center gap-2.5 rounded-[18px] bg-white/8 px-3.5 py-3 text-[13px]">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-gold text-ink">
              <Trophy size={16} />
            </span>
            <span className="flex-1 text-white/85">
              You and {them} are{" "}
              <b className="text-white">
                {record.won}–{record.lost}
              </b>{" "}
              so far
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The little picture of each game, as on its card */
export function GameArt({ kind }: { kind: GameKind }) {
  if (kind === "truths")
    return (
      <>
        <span className="absolute top-2.5 left-1 h-16 w-[54px] -rotate-10 rounded-[10px] bg-white shadow-[0_6px_14px_rgba(0,0,0,0.3)]" />
        <span className="absolute top-1 left-[38px] h-16 w-[54px] rounded-[10px] bg-white shadow-[0_6px_14px_rgba(0,0,0,0.3)]" />
        <span className="absolute top-2.5 left-[74px] grid h-16 w-[54px] rotate-10 place-items-center rounded-[10px] bg-gold font-extrabold text-ink shadow-[0_6px_14px_rgba(0,0,0,0.3)]">
          ?
        </span>
      </>
    );
  if (kind === "tot")
    return (
      <div className="flex h-full items-center justify-center gap-1.5">
        <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white text-[12px] font-extrabold text-[#c2306b]">THIS</span>
        <span className="text-[11px] font-extrabold text-gold">OR</span>
        <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-gold text-[12px] font-extrabold text-ink">THAT</span>
      </div>
    );
  if (kind === "c4") {
    const cells = ["e", "g", "e", "e", "p", "g", "p", "e"];
    return (
      <div className="grid h-full grid-cols-4 content-center gap-[5px] px-3.5">
        {cells.map((c, i) => (
          <span key={i} className="aspect-square rounded-full" style={{ background: c === "g" ? "#f2b33d" : c === "p" ? "#a78bfa" : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>
    );
  }
  if (kind === "whot")
    return (
      <div className="relative h-full">
        <span className="absolute top-2 left-[22%] h-[64px] w-[44px] -rotate-12 rounded-[8px] bg-[#fffaf1] shadow-[0_6px_14px_rgba(0,0,0,0.3)]">
          <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-6 w-6" aria-hidden="true"><path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z" fill="#8f1d3a" /></svg>
        </span>
        <span className="absolute top-1 left-[44%] grid h-[64px] w-[44px] rotate-6 place-items-center rounded-[8px] bg-[#fffaf1] shadow-[0_6px_14px_rgba(0,0,0,0.3)]">
          <span className="font-display text-[11px] font-black text-[#8f1d3a]">WHOT</span>
        </span>
      </div>
    );
  if (kind === "checkers")
    return (
      <div className="mx-auto grid h-full w-[78px] grid-cols-4 content-center overflow-hidden rounded-lg">
        {Array.from({ length: 16 }, (_, i) => {
          const dark = (Math.floor(i / 4) + i) % 2 === 1;
          const piece = dark && (i < 4 ? "#a78bfa" : i > 11 ? "#f2b33d" : null);
          return (
            <span key={i} className="grid aspect-square place-items-center" style={{ background: dark ? "#1d6b63" : "#d9efe9" }}>
              {piece && <span className="h-[70%] w-[70%] rounded-full" style={{ background: piece, boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.25)" }} />}
            </span>
          );
        })}
      </div>
    );
  if (kind === "chess")
    return (
      <div className="flex h-full items-center justify-center gap-1">
        <span className="grid h-[56px] w-[56px] place-items-center rounded-2xl bg-[#5c6f94]">
          <ChessPiece type="n" color="w" className="h-11 w-11" />
        </span>
        <span className="grid h-[56px] w-[56px] place-items-center rounded-2xl bg-[#dfe6f2]">
          <ChessPiece type="q" color="b" className="h-11 w-11" />
        </span>
      </div>
    );
  if (kind === "ayo")
    return (
      <div className="mx-2 grid h-full grid-cols-3 content-center gap-1.5 rounded-[18px] bg-[#8a5220] p-2">
        {[4, 2, 3, 5, 1, 4].map((n, i) => (
          <span key={i} className="relative grid aspect-square place-items-center rounded-full" style={{ background: "radial-gradient(circle at 50% 35%, #4a2a10 0%, #2b1606 75%)" }}>
            <span className="text-[11px] font-extrabold text-[#f6efe2]">{n}</span>
          </span>
        ))}
      </div>
    );
  const letters = ["V", "I", "R", "A", "B", "E"];
  const on = [1, 4, 5];
  return (
    <div className="grid h-full grid-cols-3 gap-[5px] px-5 py-1">
      {letters.map((l, i) => (
        <span
          key={i}
          className="grid place-items-center rounded-lg text-[14px] font-extrabold"
          style={{ background: on.includes(i) ? "#f2b33d" : "#fff", color: on.includes(i) ? "#1c1828" : "#0f5c3e" }}
        >
          {l}
        </span>
      ))}
    </div>
  );
}
