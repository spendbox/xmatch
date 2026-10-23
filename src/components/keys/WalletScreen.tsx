"use client";

import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, CircleAlert, Clock3, Eye, Gift, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { KEY_PACKS, naira, type KeyPack, type Wallet } from "@/lib/keys";
import { usePrices } from "./usePrices";
import { buyKeys } from "@/app/(app)/wallet/actions";
import { Button, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "./KeyIcon";
import { useWallet } from "./useWallet";

export type KeyTx = { id: number; amount: number; reason: string; created_at: string };

const REASONS: Record<string, string> = {
  purchase: "Bought Keys",
  gift: "Sent a gift",
  extend: "Added 2 minutes",
  extra_masquerade: "Extra masquerade",
  reopen: "Reopened a past pair",
  reveal: "Revealed a photo",
  feed_gift: "Sent a gift",
  feed_chat: "Started a chat",
  refund: "Refund",
  event: "Masquerade Night entry",
  meet: "Posted a meet",
  photos: "Unlocked someone's photos",
  explore_message: "Messaged someone from Explore",
};

export function WalletScreen({
  userId,
  wallet: initial,
  history,
  result,
  packs = KEY_PACKS,
}: {
  packs?: KeyPack[];
  userId: string;
  wallet: Wallet;
  history: KeyTx[];
  result: "paid" | "pending" | "failed" | null;
}) {
  const { wallet } = useWallet(userId, initial);
  const [pack, setPack] = useState((packs[1] ?? packs[0])?.id);
  const prices = usePrices();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const chosen = packs.find((p) => p.id === pack) ?? packs[0];

  function buy() {
    setError(null);
    start(async () => {
      const res = await buyKeys(pack);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-5 lg:max-w-6xl lg:px-10 lg:pt-10">
      <header className="flex items-center gap-2">
        <Link href="/home" className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5 lg:hidden" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="font-display text-[30px] leading-tight font-semibold lg:text-[40px]">Keys</h1>
      </header>

      {result && (
        <div
          className={clsx(
            "mt-4 flex animate-pop items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium",
            result === "paid" && "bg-mint-soft text-mint",
            result === "pending" && "bg-gold-soft text-[#8a5a00]",
            result === "failed" && "bg-chili-soft text-chili",
          )}
        >
          {result === "paid" ? <Check size={18} strokeWidth={3} /> : result === "pending" ? <Clock3 size={18} /> : <CircleAlert size={18} />}
          {result === "paid"
            ? "Payment successful — your Keys have been added."
            : result === "pending"
              ? "We're confirming your payment. Your Keys will appear shortly."
              : "That payment didn't go through. You haven't been charged."}
        </div>
      )}

      <div className="lg:mt-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
      {/* On computers the buying side stays put while the rest scrolls */}
      <div className="lg:sticky lg:top-6 lg:col-span-7">
      {/* Balance */}
      <section className="relative mt-4 lg:mt-0 overflow-hidden rounded-[30px] bg-gradient-to-br from-[#ffcf5c] via-gold to-[#e8962a] p-6 text-ink shadow-[0_18px_40px_-18px_rgb(232_150_42/0.8)]">
        <div aria-hidden className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/25" />
        <p className="relative text-[14px] font-semibold text-ink/70">Your balance</p>
        <p className="relative mt-1 flex items-center gap-3 font-display text-[48px] leading-none font-semibold">
          <KeyCoin size={42} className="animate-float" /> {wallet?.balance ?? 0}
        </p>
        <p className="relative mt-3 text-[13px] font-medium text-ink/70">
          Hourly pairing is always free
        </p>
      </section>

      {/* Packs */}
      <h2 className="mt-7 mb-3 text-[15px] font-semibold">Get Keys</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {packs.map((p) => {
          const on = p.id === pack;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                tapFeedback();
                setPack(p.id);
              }}
              className={clsx(
                "relative flex flex-col items-center rounded-3xl border px-2 pt-5 pb-4 transition active:scale-95",
                on ? "border-brand bg-brand-soft/70 shadow-[0_8px_20px_-10px_rgb(91_63_217/0.5)]" : "border-line bg-surface",
              )}
            >
              {p.tag && (
                <span className={clsx("absolute -top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", on ? "bg-brand text-white" : "bg-gold text-ink")}>
                  {p.tag}
                </span>
              )}
              <KeyCoin size={30} className={on ? "animate-pop" : ""} />
              <span className="mt-2 font-display text-[26px] leading-none font-semibold">{p.keys}</span>
              <span className="text-[11px] font-medium text-muted">Keys</span>
              <span className={clsx("mt-2 text-[14px] font-bold", on ? "text-brand" : "text-ink")}>{naira(p.naira)}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
      <Button size="lg" className="mt-4" onClick={buy} loading={pending} loadingText="Opening Paystack…">
        Pay {naira(chosen.naira)} with Paystack
      </Button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <ShieldCheck size={14} /> Secure payment by Paystack · card, transfer or USSD
      </p>

      </div>
      <div className="lg:col-span-5">
      {/* What Keys do */}
      <h2 className="mt-8 mb-3 text-[15px] font-semibold lg:mt-0">What you can do with Keys</h2>
      <div className="space-y-2.5">
        <Use icon={<Gift size={20} strokeWidth={1.75} />} tone="bg-chili-soft text-chili" title="Send gifts" body="Fire, jollof, crowns and more. A fun way to stand out." />
        <Use icon={<RotateCcw size={20} strokeWidth={1.75} />} tone="bg-brand-soft text-brand" title={`Reopen a past pair · ${prices.reopen_cost} Keys`} body="The hour ran out? Pick the chat back up until you both decide." />
        <Use icon={<Eye size={20} strokeWidth={1.75} />} tone="bg-mint-soft text-mint" title="Reveal photos at events" body="See someone's photo before you chat. They won't be told." />
      </div>

      {/* History */}
      {history.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-[15px] font-semibold">History</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[14px] font-medium">{REASONS[t.reason] ?? t.reason}</p>
                  {mounted && <p className="text-[12px] text-muted">{new Date(t.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
                </div>
                <span className={clsx("text-[15px] font-bold tabular-nums", t.amount > 0 ? "text-mint" : "text-ink")}>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      </div>
      </div>
      <p className="mt-6 pb-4 text-center text-[12px] leading-relaxed text-muted">
        Keys can only be used on Dashpad and have no cash value. See our <Link href="/terms" className="underline">Terms</Link>.
      </p>
    </main>
  );
}

function Use({ icon, tone, title, body }: { icon: React.ReactNode; tone: string; title: string; body: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-4">
      <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-[14px] " + tone}>{icon}</span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[13px] text-muted">{body}</p>
      </div>
    </div>
  );
}
