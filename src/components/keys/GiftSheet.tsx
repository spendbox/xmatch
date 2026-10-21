"use client";

import { plural, word } from "@/lib/plural";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { GIFTS, type Gift } from "@/lib/keys";
import { Sheet } from "@/components/ui/Sheet";
import { Button, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "./KeyIcon";
import { GiftArt } from "./GiftArt";

export function GiftSheet({
  open,
  onClose,
  balance,
  toName,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  balance: number | null;
  toName: string;
  onSend: (gift: Gift) => Promise<string | null>; // returns an error message, or null
}) {
  const [picked, setPicked] = useState<Gift>(GIFTS[0]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = balance !== null && balance < picked.price;

  async function send() {
    setSending(true);
    setError(null);
    const err = await onSend(picked);
    setSending(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Send ${toName} a gift`}
      subtitle="Gifts pop up in the chat. A sweet way to stand out."
      footer={
        <div className="space-y-2">
          {error && <p className="rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
          {short ? (
            <Link href="/wallet" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-ink">
              <KeyCoin size={22} /> Get more Keys
            </Link>
          ) : (
            <Button size="lg" onClick={send} loading={sending} loadingText="Sending…">
              Send {picked.name} · {plural(picked.price, "Key")}
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-gold-soft px-4 py-3">
        <span className="text-[14px] font-medium text-[#8a5a00]">Your balance</span>
        <span className="inline-flex items-center gap-1.5 text-[16px] font-bold text-[#8a5a00]">
          <KeyCoin size={20} /> {balance ?? "…"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {GIFTS.map((g) => {
          const on = g.id === picked.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                tapFeedback();
                setPicked(g);
              }}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-2xl border py-3 transition active:scale-95",
                on ? "border-brand bg-brand-soft/70 shadow-[0_6px_18px_-8px_rgb(91_63_217/0.45)]" : "border-line bg-surface",
              )}
            >
              <GiftArt id={g.id} size={44} className={clsx("drop-shadow-sm", on && "animate-pop")} />
              <span className="text-[11px] font-semibold text-ink-soft">{g.name}</span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#a26b00]">
                <KeyCoin size={12} /> {g.price}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Turns database error codes into friendly messages. */
export function keysError(message: string | undefined) {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("NOT_ENOUGH_KEYS")) return "You don't have enough Keys for that.";
  if (message.includes("MAX_EXTENSIONS")) return "You've already added time 3 times in this chat.";
  if (message.includes("ended")) return "This chat has ended.";
  return "Something went wrong. Please try again.";
}
