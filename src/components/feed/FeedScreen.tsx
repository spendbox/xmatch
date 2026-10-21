"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronRight, Flag, Gift, Lock, MessageCircle, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { plural, word } from "@/lib/plural";
import { sexLabel } from "@/lib/eventSpace";
import type { Wallet } from "@/lib/keys";
import {
  ago,
  feedError,
  REACTIONS,
  totalReactions,
  type Feed,
  type FeedAnswer,
  type FeedGift,
  type MyAnswer,
  type ReactionKey,
} from "@/lib/feed";
import { Button, tapFeedback } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftArt } from "@/components/keys/GiftArt";
import { GiftSheet } from "@/components/keys/GiftSheet";
import { useWallet } from "@/components/keys/useWallet";
import { refreshMenuBadges } from "@/components/app/useMenuBadges";
import { MaskAvatar } from "./MaskAvatar";
import { GiftsSheet } from "./GiftsSheet";

const PAGE = 30;

/** Next midnight in Lagos (Nigeria has no daylight saving: always UTC+1). */
function nextPromptAt(now: number) {
  const lagos = new Date(now + 3_600_000);
  return Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + 1) - 3_600_000;
}

function untilNext(now: number) {
  const m = Math.max(1, Math.ceil((nextPromptAt(now) - now) / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function FeedScreen({
  initial,
  myId,
  wallet: initialWallet,
  demoGifts,
  demoGiftsOpen,
}: {
  initial: Feed;
  myId: string;
  wallet: Wallet | null;
  demoGifts?: FeedGift[];
  demoGiftsOpen?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { wallet, refresh: refreshWallet } = useWallet(myId, initialWallet);
  const balance = wallet?.balance ?? 0;
  const [feed, setFeed] = useState<Feed>(initial);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [more, setMore] = useState((initial.answers?.length ?? 0) >= PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [giftFor, setGiftFor] = useState<FeedAnswer | null>(null);
  const [chatFor, setChatFor] = useState<FeedAnswer | null>(null);
  const [starting, setStarting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [giftsOpen, setGiftsOpen] = useState(!!demoGiftsOpen);
  const [editing, setEditing] = useState(false);

  const prompt = feed.prompt;
  const mine = feed.my_answer ?? null;
  const answers = useMemo(() => (feed.answers ?? []).filter((a) => !a.mine), [feed.answers]);
  const cost = prompt?.chat_cost ?? 0;

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(
    async (s: "new" | "top" = sort) => {
      const { data, error } = await supabase.rpc("get_feed", { p_sort: s, p_limit: PAGE, p_offset: 0 });
      if (error || !data) return;
      const f = data as Feed;
      setFeed(f);
      setMore((f.answers?.length ?? 0) >= PAGE);
    },
    [supabase, sort],
  );

  // Fresh answers when you come back to the app (and a new prompt after midnight)
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function changeSort(s: "new" | "top") {
    if (s === sort) return;
    tapFeedback();
    setSort(s);
    await load(s);
  }

  async function loadMore() {
    setLoadingMore(true);
    const { data } = await supabase.rpc("get_feed", { p_sort: sort, p_limit: PAGE, p_offset: feed.answers?.length ?? 0 });
    setLoadingMore(false);
    const next = ((data as Feed | null)?.answers ?? []).filter((a) => !(feed.answers ?? []).some((x) => x.id === a.id));
    setFeed((f) => ({ ...f, answers: [...(f.answers ?? []), ...next] }));
    setMore(next.length >= PAGE);
  }

  const patch = (id: string, fn: (a: FeedAnswer) => FeedAnswer) =>
    setFeed((f) => ({ ...f, answers: (f.answers ?? []).map((a) => (a.id === id ? fn(a) : a)) }));

  async function react(a: FeedAnswer, key: ReactionKey) {
    tapFeedback();
    const next = a.my_reaction === key ? null : key;
    const before = a;
    patch(a.id, (x) => {
      const r = { ...x.reactions };
      if (x.my_reaction) r[x.my_reaction] = Math.max(0, (r[x.my_reaction] ?? 1) - 1);
      if (next) r[next] = (r[next] ?? 0) + 1;
      return { ...x, reactions: r, my_reaction: next };
    });
    const { error } = await supabase.rpc("react_answer", { p_answer: a.id, p_emoji: next ?? "" });
    if (error) {
      patch(a.id, () => before);
      setToast(feedError(error.message));
    }
  }

  async function sendGift(a: FeedAnswer, giftId: string) {
    const { error } = await supabase.rpc("gift_answer", { p_answer: a.id, p_gift: giftId });
    if (error) return feedError(error.message);
    patch(a.id, (x) => ({ ...x, gifts: x.gifts + 1 }));
    refreshWallet();
    notify({ kind: "feed_gift", answerId: a.id });
    setToast(`Sent! ${a.alias} will see it's from you.`);
    return null;
  }

  async function startChat(a: FeedAnswer) {
    setStarting(true);
    setChatError(null);
    const { data, error } = await supabase.rpc("start_feed_chat", { p_answer: a.id });
    if (error || !data) {
      setStarting(false);
      return setChatError(feedError(error?.message));
    }
    refreshWallet();
    router.push(`/feed/chat/${data}`);
  }

  async function report(a: FeedAnswer) {
    if (!confirm(`Report ${a.alias}'s answer? You won't see them again.`)) return;
    const { error } = await supabase.rpc("report_answer", { p_answer: a.id, p_reason: "Feed answer" });
    if (error) return setToast(feedError(error.message));
    setFeed((f) => ({ ...f, answers: (f.answers ?? []).filter((x) => x.id !== a.id) }));
    setToast("Thanks. We'll take a look.");
  }

  async function removeMine() {
    if (!mine || !confirm("Delete your answer? Reactions and gifts on it will be lost.")) return;
    const { error } = await supabase.rpc("delete_my_answer", { p_answer: mine.id });
    if (error) return setToast(feedError(error.message));
    setEditing(false);
    await load();
    refreshMenuBadges();
  }

  async function onPosted() {
    setEditing(false);
    await load();
    refreshMenuBadges();
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-6 lg:max-w-2xl lg:px-10 lg:pt-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Feed</h1>
          <p className="mt-1 text-[15px] text-muted">One question a day. Everyone&apos;s masked.</p>
        </div>
        <Link
          href="/wallet"
          className="mb-1 inline-flex h-10 items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft pr-3.5 pl-1.5 text-[14px] font-bold text-[#8a5a00]"
          aria-label={`${plural(balance, "Key")}. Get more`}
        >
          <KeyCoin size={26} /> {balance}
        </Link>
      </header>

      {!prompt ? (
        <section className="mt-6 rounded-[28px] border border-line bg-surface p-7 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Sparkles size={26} />
          </span>
          <p className="mt-4 text-[18px] font-semibold">Today&apos;s prompt is on its way</p>
          <p className="mx-auto mt-1 max-w-xs text-[14px] text-muted">Check back soon. We&apos;ll ask everyone one question, and you answer masked.</p>
        </section>
      ) : (
        <>
          {/* Today's prompt */}
          <section className="relative mt-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-[#6d4ff0] to-[#8f6bff] p-5 text-white shadow-[0_18px_40px_-18px_rgb(91_63_217/0.8)] lg:p-7">
            <div aria-hidden className="absolute -top-14 -right-12 h-44 w-44 rounded-full bg-white/10" />
            <div className="relative flex items-center justify-between gap-2 text-[12px] font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                <Sparkles size={13} /> Today&apos;s prompt
              </span>
              <span className="text-white/75">{now ? `New one in ${untilNext(now)}` : ""}</span>
            </div>
            <h2 className="relative mt-3 font-display text-[26px] leading-tight font-semibold lg:text-[32px]">{prompt.body}</h2>
            <p className="relative mt-2 text-[13px] text-white/80">
              {prompt.answers > 0 ? `${plural(prompt.answers, "answer")} so far` : "Be the first to answer"}
            </p>

            {mine && !editing ? (
              <div className="relative mt-4 rounded-2xl bg-white p-4 text-ink">
                <div className="flex items-center gap-2.5">
                  <MaskAvatar alias={mine.alias} size={32} />
                  <p className="min-w-0 flex-1 truncate text-[13px] text-muted">
                    You answered as <span className="font-semibold text-ink">{mine.alias}</span>
                  </p>
                  <MineMenu onEdit={() => setEditing(true)} onDelete={removeMine} />
                </div>
                <p className="mt-2.5 text-[15px] leading-snug whitespace-pre-wrap">{mine.body}</p>
                {mine.hidden && <p className="mt-2 text-[12px] font-semibold text-chili">Hidden by Dashpad for breaking the rules.</p>}
                <div className="mt-3 flex gap-2 text-[12px] font-semibold text-ink-soft">
                  <MineStat value={mine.reactions} label={word(mine.reactions, "reaction")} />
                  <MineStat value={mine.gifts} label={word(mine.gifts, "gift")} />
                  <MineStat value={mine.chats} label={word(mine.chats, "chat")} />
                </div>
              </div>
            ) : (
              <AnswerBox promptId={prompt.id} initial={mine} onPosted={onPosted} onCancel={mine ? () => setEditing(false) : undefined} />
            )}
          </section>

          {/* Gifts you got */}
          {(feed.gifts_unseen > 0 || mine?.gifts) ? (
            <button
              onClick={() => {
                tapFeedback();
                setGiftsOpen(true);
              }}
              className={clsx(
                "mt-4 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
                feed.gifts_unseen > 0 ? "border-gold/50 bg-gold-soft" : "border-line bg-surface",
              )}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white">
                <GiftArt id="rose" size={28} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">
                  {feed.gifts_unseen > 0 ? `${plural(feed.gifts_unseen, "new gift")} for you` : "Gifts for you"}
                </span>
                <span className="block truncate text-[12px] text-muted">See who sent them and chat back for free</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          ) : null}

          {/* Everyone's answers */}
          {!mine ? (
            <Locked count={prompt.answers} />
          ) : (
            <>
              <div className="mt-6 mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">Answers</h3>
                <div className="inline-flex rounded-full bg-surface p-1 shadow-card">
                  {(["new", "top"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSort(s)}
                      className={clsx("h-8 rounded-full px-3.5 text-[13px] font-semibold transition", sort === s ? "bg-ink text-white" : "text-muted")}
                    >
                      {s === "new" ? "Newest" : "Top"}
                    </button>
                  ))}
                </div>
              </div>
              {answers.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line-strong p-8 text-center text-[14px] text-muted">
                  You&apos;re first! Answers from others will show up here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {answers.map((a) => (
                    <AnswerCard
                      key={a.id}
                      a={a}
                      now={now}
                      cost={cost}
                      onReact={(k) => react(a, k)}
                      onGift={() => setGiftFor(a)}
                      onChat={() => {
                        setChatError(null);
                        setChatFor(a);
                      }}
                      onReport={() => report(a)}
                    />
                  ))}
                </ul>
              )}
              {more && (
                <Button variant="secondary" size="lg" className="mt-4" onClick={loadMore} loading={loadingMore} loadingText="Loading…">
                  Show more answers
                </Button>
              )}
            </>
          )}
        </>
      )}
      <div className="h-6" />

      <GiftSheet
        open={!!giftFor}
        onClose={() => setGiftFor(null)}
        balance={wallet?.balance ?? null}
        toName={giftFor?.alias ?? "them"}
        subtitle="They'll see the gift is from you, with your name and photo. A bold way to say you liked their answer."
        onSend={(g) => (giftFor ? sendGift(giftFor, g.id) : Promise.resolve(null))}
      />

      <Sheet
        open={!!chatFor}
        onClose={() => setChatFor(null)}
        title={`Chat with ${chatFor?.alias ?? "them"}?`}
        subtitle="You both stay masked. The chat lasts 24 hours, then you each choose: keep it and match, or let it go."
        icon={<MessageCircle size={22} />}
        footer={
          <div className="space-y-2">
            {chatError && <p className="rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{chatError}</p>}
            {cost > 0 && balance < cost ? (
              <Link href="/wallet" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-semibold text-ink">
                <KeyCoin size={22} /> Get Keys
              </Link>
            ) : (
              <Button size="lg" onClick={() => chatFor && startChat(chatFor)} loading={starting} loadingText="Starting…">
                {cost > 0 ? (
                  <>
                    Start chat · <KeyCoin size={20} /> {cost}
                  </>
                ) : (
                  "Start chat · free"
                )}
              </Button>
            )}
          </div>
        }
      >
        {chatFor && (
          <div className="rounded-2xl bg-cream p-4">
            <div className="flex items-center gap-2.5">
              <MaskAvatar alias={chatFor.alias} size={32} />
              <p className="text-[14px] font-semibold">
                {chatFor.alias}
                <span className="font-normal text-muted">
                  {chatFor.age ? `, ${chatFor.age}` : ""}
                  {sexLabel(chatFor.gender) ? ` · ${sexLabel(chatFor.gender)}` : ""}
                </span>
              </p>
            </div>
            <p className="mt-2 line-clamp-4 text-[14px] leading-snug text-ink-soft">&ldquo;{chatFor.body}&rdquo;</p>
          </div>
        )}
        {cost > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-gold-soft px-4 py-3">
            <span className="text-[14px] font-medium text-[#8a5a00]">Your balance</span>
            <span className="inline-flex items-center gap-1.5 text-[16px] font-bold text-[#8a5a00]">
              <KeyCoin size={20} /> {balance}
            </span>
          </div>
        )}
      </Sheet>

      <GiftsSheet
        open={giftsOpen}
        onClose={() => {
          setGiftsOpen(false);
          if (feed.gifts_unseen) setFeed((f) => ({ ...f, gifts_unseen: 0 }));
        }}
        demo={demoGifts}
      />

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm animate-fade-up rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-white shadow-lift">
          {toast}
        </div>
      )}
    </main>
  );
}

function MineStat({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-full bg-cream px-2.5 py-1">
      <span className="text-brand">{value}</span> {label}
    </span>
  );
}

function MineMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Your answer options">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute top-9 right-0 z-20 w-44 animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] hover:bg-cream">
            <Pencil size={16} /> Edit
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] text-chili hover:bg-chili-soft">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function AnswerBox({ promptId, initial, onPosted, onCancel }: { promptId: string; initial: MyAnswer | null; onPosted: () => void; onCancel?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const left = 500 - text.length;

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [text]);

  async function post() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("answer_prompt", { p_prompt: promptId, p_body: body });
    setBusy(false);
    if (err) return setError(feedError(err.message));
    onPosted();
  }

  return (
    <div className="relative mt-4 rounded-2xl bg-white p-3 text-ink">
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        rows={2}
        placeholder="Your answer… be honest, you're masked"
        className="block w-full resize-none bg-transparent px-1 text-[15px] leading-snug outline-none placeholder:text-muted"
      />
      {error && <p className="mt-2 rounded-xl bg-chili-soft px-3 py-2 text-[13px] font-medium text-chili">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[12px] text-muted">{left < 80 ? `${left} left` : initial ? "Edit your answer" : "Posts with a masked name"}</p>
        {onCancel && (
          <button onClick={onCancel} className="h-10 rounded-xl px-3 text-[14px] font-semibold text-muted hover:bg-ink/5">
            Cancel
          </button>
        )}
        <button
          onClick={post}
          disabled={busy || !text.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-[14px] font-semibold text-ink transition active:scale-95 disabled:opacity-50"
        >
          {busy ? "Posting…" : initial ? "Save" : "Post"}
        </button>
      </div>
    </div>
  );
}

function Locked({ count }: { count: number }) {
  const fake = ["w-11/12", "w-3/4", "w-5/6"];
  return (
    <section className="relative mt-6">
      <ul className="space-y-3" aria-hidden>
        {fake.map((w, i) => (
          <li key={i} className="rounded-3xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-full bg-brand-soft" />
              <span className="h-3 w-28 rounded-full bg-line" />
            </div>
            <span className={clsx("mt-3 block h-3 rounded-full bg-line", w)} />
            <span className="mt-2 block h-3 w-1/2 rounded-full bg-line" />
          </li>
        ))}
      </ul>
      <div className="absolute inset-0 grid place-items-center rounded-3xl bg-cream/70 backdrop-blur-[3px]">
        <div className="px-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white">
            <Lock size={20} />
          </span>
          <p className="mt-3 text-[16px] font-semibold">Answer to unlock</p>
          <p className="mt-1 text-[14px] text-muted">
            {count > 0 ? `See what ${plural(count, "person", "people")} said, react and start chats.` : "Post first, then see everyone else's answers."}
          </p>
        </div>
      </div>
    </section>
  );
}

function AnswerCard({
  a,
  now,
  cost,
  onReact,
  onGift,
  onChat,
  onReport,
}: {
  a: FeedAnswer;
  now: number | null;
  cost: number;
  onReact: (k: ReactionKey) => void;
  onGift: () => void;
  onChat: () => void;
  onReport: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const total = totalReactions(a.reactions);
  return (
    <li className="rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <MaskAvatar alias={a.alias} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{a.alias}</p>
          <p className="truncate text-[12px] text-muted">
            {[a.age, sexLabel(a.gender)].filter(Boolean).join(" · ")}
            {now ? ` · ${ago(a.created_at, now)}` : ""}
          </p>
        </div>
        {a.gifts > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-[#8a5a00]">
            <Gift size={12} /> {a.gifts}
          </span>
        )}
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="More options">
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div className="absolute top-9 right-0 z-20 w-44 animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
              <button onClick={() => { setMenu(false); onReport(); }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] text-chili hover:bg-chili-soft">
                <Flag size={16} /> Report
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[16px] leading-snug whitespace-pre-wrap">{a.body}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {REACTIONS.map((r) => {
          const n = a.reactions[r.key] ?? 0;
          const on = a.my_reaction === r.key;
          return (
            <button
              key={r.key}
              onClick={() => onReact(r.key)}
              aria-label={r.label}
              aria-pressed={on}
              className={clsx(
                "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold transition active:scale-90",
                on ? "border-brand bg-brand-soft text-brand" : "border-line bg-cream text-ink-soft",
              )}
            >
              <span className="text-[15px] leading-none">{r.emoji}</span>
              {n > 0 && <span className="tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <span className="min-w-0 flex-1 text-[12px] text-muted">{total > 0 ? plural(total, "reaction") : "Be the first to react"}</span>
        <button
          onClick={onGift}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gold/50 bg-gold-soft px-3 text-[13px] font-semibold text-[#8a5a00] transition active:scale-95"
        >
          <Gift size={15} /> Gift
        </button>
        {a.chat_id ? (
          <Link href={`/feed/chat/${a.chat_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white transition active:scale-95">
            <MessageCircle size={15} /> Open chat
          </Link>
        ) : a.matched ? (
          <Link href="/matches" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-mint-soft px-3.5 text-[13px] font-semibold text-mint">
            Matched
          </Link>
        ) : a.can_chat ? (
          <button
            onClick={onChat}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_-8px_rgb(91_63_217/0.7)] transition active:scale-95"
          >
            <MessageCircle size={15} /> Chat
            {cost > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 py-0.5 pr-1.5 pl-0.5 text-[12px]">
                <KeyCoin size={14} /> {cost}
              </span>
            )}
          </button>
        ) : null}
      </div>
    </li>
  );
}
