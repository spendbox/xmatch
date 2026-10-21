"use client";

import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, CircleAlert, Clock3, Gift, ShieldCheck, Timer } from "lucide-react";
import Link from "next/link";
import { KEY_PACKS, EXTEND_COST, EXTRA_MASQUERADE_COST, FREE_MASQUERADES_PER_DAY, naira, type Wallet } from "@/lib/keys";
import { buyKeys } from "@/app/(app)/wallet/actions";
import { Button, tapFeedback } from "@/components/ui/Button";
import { MaskLineIcon } from "@/components/ui/icons";
import { KeyCoin } from "./KeyIcon";
import { useWallet } from "./useWallet";

export type KeyTx = { id: number; amount: number; reason: string; created_at: string };

const REASONS: Record<string, string> = {
  purchase: "Bought Keys",
  gift: "Sent a gift",
  extend: "Added 2 minutes",
  extra_masquerade: "Extra masquerade",
  refund: "Refund",
};

export function WalletScreen({
  userId,
  wallet: initial,
  history,
  result,
}: {
  userId: string;
  wallet: Wallet;
  history: KeyTx[];
  result: "paid" | "pending" | "failed" | null;
}) {
  const { wallet } = useWallet(userId, initial);
  const [pack, setPack] = useState(KEY_PACKS[1].id);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const chosen = KEY_PACKS.find((p) => p.id === pack)!;

  function buy() {
    setError(null);
    start(async () => {
      const res = await buyKeys(pack);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-5">
      <header className="flex items-center gap-2">
        <Link href="/home" className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Back">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="font-display text-[30px] leading-tight font-semibold">Keys</h1>
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

      {/* Balance */}
      <section className="relative mt-4 overflow-hidden rounded-[30px] bg-gradient-to-br from-[#ffcf5c] via-gold to-[#e8962a] p-6 text-ink shadow-[0_18px_40px_-18px_rgb(232_150_42/0.8)]">
        <div aria-hidden className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/25" />
        <p className="relative text-[14px] font-semibold text-ink/70">Your balance</p>
        <p className="relative mt-1 flex items-center gap-3 font-display text-[48px] leading-none font-semibold">
          <KeyCoin size={42} className="animate-float" /> {wallet?.balance ?? 0}
        </p>
        <p className="relative mt-3 text-[13px] font-medium text-ink/70">
          {wallet ? `${wallet.free_left} of ${FREE_MASQUERADES_PER_DAY} free masquerades left today` : ""}
          {wallet?.passes ? ` · ${wallet.passes} extra saved` : ""}
        </p>
      </section>

      {/* Packs */}
      <h2 className="mt-7 mb-3 text-[15px] font-semibold">Get Keys</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {KEY_PACKS.map((p) => {
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

      {/* What Keys do */}
      <h2 className="mt-8 mb-3 text-[15px] font-semibold">What you can do with Keys</h2>
      <div className="space-y-2.5">
        <Use icon={<Gift size={20} strokeWidth={1.75} />} tone="bg-chili-soft text-chili" title="Send gifts" body="Roses, cocktails, crowns and more, from 5 Keys." />
        <Use icon={<Timer size={20} strokeWidth={1.75} />} tone="bg-mint-soft text-mint" title={`+2 minutes · ${EXTEND_COST} Keys`} body="Chat going well? Add 2 minutes for both of you." />
        <Use
          icon={<MaskLineIcon size={20} />}
          tone="bg-brand-soft text-brand"
          title={`Extra masquerades · ${EXTRA_MASQUERADE_COST} Keys`}
          body={`Your first ${FREE_MASQUERADES_PER_DAY} every day are free.`}
        />
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
