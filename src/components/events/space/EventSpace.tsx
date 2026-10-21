"use client";

import { notify } from "@/lib/pushClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Eye, Handshake, Headphones, LayoutGrid, MessageCircle, MessagesSquare, PartyPopper, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { plural } from "@/lib/plural";
import { countdown, eventPhase, eventWhen, settingsOf, themeBg, type DashpadEvent, type EventChatSummary, type WallPerson } from "@/lib/events";
import { eventError, makeBlur } from "@/lib/eventSpace";
import { intentLabel } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { INTENT_ICONS } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { useWallet } from "@/components/keys/useWallet";
import { PhaseBadge, useNow } from "../EventCard";
import { CoverImage, KindChip } from "../kind";
import { useEventMedia } from "../media/EventMediaProvider";
import { MediaStage, MiniPlayer } from "../media/MiniPlayer";
import { BlurPhoto, PersonSheet, revealPrice } from "./common";
import { ChatsPanel } from "./ChatsPanel";
import { FeaturedPhotoPicker } from "./FeaturedPhotoPicker";
import { Room } from "./Room";
import { Wall } from "./Wall";
import { useEventChats } from "./useEventChats";
import { useKeyboardSafe } from "@/lib/useKeyboardSafe";

type Tab = "room" | "wall" | "chats";

/** Spotlight Nights and Listening Parties: a wall of people, a shared room, and private chats. */
export function EventSpace({
  event,
  userId,
  myPhotos,
  myInterests,
}: {
  event: DashpadEvent;
  userId: string;
  myPhotos: string[];
  myInterests: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [e, setE] = useState(event);
  const s = settingsOf(e);
  const now = useNow();
  const phase = now ? eventPhase(e, now) : "upcoming";
  const startsIn = now ? new Date(e.starts_at).getTime() - now : 0;
  const endsIn = now ? new Date(e.ends_at).getTime() - now : 0;
  const decideBy = new Date(e.ends_at).getTime() + 60 * 60 * 1000;
  const media = useEventMedia();
  // Inside a live event the phone layout is one screen: only the room or the wall scrolls
  const shell = useKeyboardSafe<HTMLElement>();
  const joined = media.active?.id === e.id;
  const inside = phase === "live" && e.i_am_going && joined;
  const { wallet, refresh: refreshWallet } = useWallet(userId);

  // The server's clock, so everyone hears the same part of the playlist
  const skew = useRef(0);
  useEffect(() => {
    skew.current = new Date(event.server_now).getTime() - Date.now();
  }, [event.server_now]);

  const [busy, setBusy] = useState<null | "rsvp" | "cancel">(null);
  const [error, setError] = useState<string | null>(null);
  const [myPhoto, setMyPhoto] = useState<string | null>(e.my_photo ?? (e.i_am_going ? myPhotos[0] ?? null : null));
  const [photoSheet, setPhotoSheet] = useState(false);
  const [revealsUsed, setRevealsUsed] = useState(e.reveals_used ?? 0);
  const defaultTab: Tab = e.kind === "party" ? "room" : "wall";
  const [tab, setTab] = useState<Tab>(defaultTab);

  // Make sure the wall has a blurred preview of you (once per visit)
  useEffect(() => {
    if (!e.i_am_going || !myPhoto || phase === "ended" || phase === "cancelled") return;
    const key = `dp-blur-${e.id}-${myPhoto}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode: just do it */
    }
    makeBlur(myPhoto).then((blur) => {
      if (blur) supabase.rpc("set_featured_photo", { p_event: e.id, p_photo: myPhoto, p_blur: blur });
    });
  }, [e.i_am_going, e.id, myPhoto, phase, supabase]);

  /* ---------- chats ---------- */
  const { chats, setChats } = useEventChats(e.id, e.i_am_going && (phase === "live" || phase === "ended"));
  const [matchIds, setMatchIds] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);

  async function vote(c: EventChatSummary, keep: boolean) {
    if (!keep && !confirm(`Let go of your chat with ${c.name || "them"}? It will be deleted for both of you.`)) return;
    setDeciding(c.id);
    const { data, error: err } = await supabase.rpc("vote_event_chat", { p_chat: c.id, p_keep: keep });
    setDeciding(null);
    if (err) return setError(eventError(err.message));
    const r = data as { status: string; match_id?: string };
    if (r.status === "matched" && r.match_id) {
      notify({ kind: "event_match", chatId: c.id });
      setMatchIds((m) => ({ ...m, [c.id]: r.match_id! }));
      setChats((l) => l?.map((x) => (x.id === c.id ? { ...x, status: "matched", my_keep: true } : x)) ?? l);
    } else if (r.status === "closed") {
      setChats((l) => l?.filter((x) => x.id !== c.id) ?? l);
    } else {
      setChats((l) => l?.map((x) => (x.id === c.id ? { ...x, my_keep: true } : x)) ?? l);
    }
  }

  /* ---------- the wall ---------- */
  const [wall, setWall] = useState<WallPerson[] | null>(null);
  const [wallBusy, setWallBusy] = useState(false);
  const loadWall = useCallback(async () => {
    setWallBusy(true);
    const { data } = await supabase.rpc("event_wall", { p_event: e.id });
    setWallBusy(false);
    if (data) setWall(data as WallPerson[]);
  }, [supabase, e.id]);

  useEffect(() => {
    if (!inside) return;
    loadWall();
    const t = setInterval(() => document.visibilityState === "visible" && loadWall(), 45_000);
    return () => clearInterval(t);
  }, [inside, loadWall]);

  const names = useMemo(() => new Map((wall ?? []).map((p) => [p.user_id, p.name])), [wall]);

  const [personId, setPersonId] = useState<string | null>(null);
  const person = wall?.find((p) => p.user_id === personId) ?? null;
  const [revealing, setRevealing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const price = revealPrice(s, revealsUsed);

  async function reveal(p: WallPerson) {
    setRevealing(true);
    setSheetError(null);
    const { data, error: err } = await supabase.rpc("reveal_photo", { p_event: e.id, p_target: p.user_id });
    setRevealing(false);
    if (err) return setSheetError(eventError(err.message));
    const r = data as { photo: string; paid: number; free_left: number; balance: number | null };
    setWall((l) => l?.map((x) => (x.user_id === p.user_id ? { ...x, photo: r.photo, revealed: true } : x)) ?? l);
    setChats((l) => l?.map((c) => (c.other_id === p.user_id ? { ...c, photo: r.photo } : c)) ?? l);
    if (!p.revealed) setRevealsUsed((u) => u + 1);
    if (r.paid) refreshWallet();
  }

  async function sayHi(p: WallPerson) {
    if (p.chat_id) return router.push(`/events/${e.id}/chat/${p.chat_id}`);
    setStarting(true);
    setSheetError(null);
    const { data, error: err } = await supabase.rpc("start_event_chat", { p_event: e.id, p_target: p.user_id });
    if (err || !data) {
      setStarting(false);
      return setSheetError(eventError(err?.message, { maxChats: s.max_chats }));
    }
    router.push(`/events/${e.id}/chat/${data as string}`);
  }

  /* ---------- going ---------- */
  async function rsvp() {
    setBusy("rsvp");
    setError(null);
    const { data, error: err } = await supabase.rpc("rsvp_event", { p_event: e.id });
    setBusy(null);
    if (err) return setError(eventError(err.message));
    const next = data as DashpadEvent;
    setE(next);
    refreshWallet();
    // Your main photo is featured by default; make its blurred preview now
    const photo = next.my_photo ?? myPhotos[0];
    if (photo) {
      setMyPhoto(photo);
      makeBlur(photo).then((blur) => supabase.rpc("set_featured_photo", { p_event: e.id, p_photo: photo, p_blur: blur }));
    }
  }

  async function unRsvp() {
    if (!confirm("Not going any more?" + (e.entry_keys ? ` Your ${plural(e.entry_keys, "Key")} will be returned.` : ""))) return;
    setBusy("cancel");
    const { data, error: err } = await supabase.rpc("cancel_rsvp", { p_event: e.id });
    setBusy(null);
    if (err) return setError(eventError(err.message));
    setE(data as DashpadEvent);
    refreshWallet();
  }

  function join() {
    // This tap is what lets phones play sound
    media.start(e, skew.current);
    setTab(defaultTab);
  }

  // Joined before (e.g. the app was closed): go straight back in, in step with everyone
  const startMedia = media.start;
  useEffect(() => {
    if (phase !== "live" || !e.i_am_going || joined) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("dp-event-joined");
    } catch {}
    if (saved === e.id) startMedia(e, skew.current, { auto: true });
  }, [phase, e, joined, startMedia]);

  const canAfford = (wallet?.balance ?? 0) >= e.entry_keys;
  const unreadTotal = joined ? media.unreadTotal : 0;

  const chatsPanel = (
    <ChatsPanel
      eventId={e.id}
      userId={userId}
      chats={chats}
      unread={joined ? media.unread : {}}
      maxChats={s.max_chats}
      phase={phase}
      decideBy={decideBy}
      matchIds={matchIds}
      deciding={deciding}
      onVote={vote}
    />
  );

  const photoPicker = (
    <FeaturedPhotoPicker eventId={e.id} photos={myPhotos} current={myPhoto} onChange={setMyPhoto} />
  );

  /* ================= Inside the live event ================= */
  if (inside) {
    const mainTab: Tab = tab === "chats" ? defaultTab : tab;
    const content = (t: Tab) =>
      t === "room" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:block lg:space-y-4 lg:pb-0">
          <div className="shrink-0">
            <MediaStage big={e.kind === "party"} />
          </div>
          <Room eventId={e.id} userId={userId} settings={s} names={names} live={phase === "live"} className="min-h-0 flex-1 lg:flex-none" />
        </div>
      ) : (
        <Wall people={wall} onOpen={(p) => { setSheetError(null); setStarting(false); setPersonId(p.user_id); }} onRefresh={loadWall} refreshing={wallBusy} />
      );

    return (
      <main
        ref={shell}
        className="fixed inset-x-0 top-0 z-40 mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-cream lg:static lg:z-auto lg:block lg:h-auto lg:max-w-6xl lg:overflow-visible lg:px-10 lg:pt-8 lg:pb-8"
      >
        {/* Compact header */}
        <header className={clsx("relative shrink-0 overflow-hidden bg-gradient-to-br text-white lg:static lg:rounded-[28px] lg:shadow-card", themeBg(e.theme))}>
          <CoverImage src={e.cover_url} />
          <div className="relative flex items-center gap-3 px-3 py-3 lg:px-6 lg:py-5">
            <Link href="/events" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur" aria-label="All events">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[19px] leading-tight font-semibold lg:text-[28px]">{e.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-white/85 lg:text-[13px]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6b6b]" /> Live · {now ? countdown(endsIn) : ""} left
                <span className="text-white/50">·</span>
                <Users size={12} /> {e.going_count}
              </p>
            </div>
            <button
              onClick={() => setPhotoSheet(true)}
              className="flex shrink-0 items-center gap-2 rounded-full bg-white/15 p-1 pr-3 text-[12px] font-semibold backdrop-blur transition active:scale-95"
              aria-label="Change your featured photo"
            >
              <BlurPhoto blur={null} photo={myPhoto} soft className="h-8 w-8 rounded-full" />
              <span className="hidden sm:inline">Your photo</span>
              <Eye size={14} className="sm:hidden" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 lg:mt-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:px-0">
          <div className="flex min-h-0 flex-1 flex-col lg:col-span-8 lg:block">
            <MiniPlayer className="mt-3 shrink-0 lg:mt-0" />
            {media.mediaOff && (
              <button
                onClick={() => media.start(e, skew.current)}
                className="mt-3 flex w-full shrink-0 items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 p-3 text-left transition hover:bg-surface lg:mt-0"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Headphones size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{e.kind === "party" ? "The music is off" : "Sound is off"}</span>
                  <span className="block text-[12px] text-muted">Tap to tune back in with everyone</span>
                </span>
              </button>
            )}

            {/* Tabs */}
            <div role="tablist" aria-label="Event sections" className="mt-3 grid shrink-0 grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card lg:grid-cols-2">
              <TabButton active={tab === "room"} desktopActive={mainTab === "room"} onClick={() => setTab("room")} icon={<MessagesSquare size={16} />} label="Room" />
              <TabButton active={tab === "wall"} desktopActive={mainTab === "wall"} onClick={() => setTab("wall")} icon={<LayoutGrid size={16} />} label="Wall" />
              <TabButton
                active={tab === "chats"}
                desktopActive={false}
                onClick={() => setTab("chats")}
                icon={<MessageCircle size={16} />}
                label="Chats"
                className="lg:hidden"
                badge={unreadTotal > 0 ? String(unreadTotal) : chats?.length ? String(chats.length) : null}
                hot={unreadTotal > 0}
              />
            </div>

            <div
              className={clsx(
                "mt-3 min-h-0 flex-1 lg:mt-4",
                tab === "room"
                  ? "flex flex-col lg:block"
                  : "-mx-4 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0",
              )}
            >
              {tab === "chats" && <div className="lg:hidden">{chatsPanel}</div>}
              <div className={clsx(tab === "chats" ? "hidden lg:block" : tab === "room" && "flex min-h-0 flex-1 flex-col lg:block")}>{content(mainTab)}</div>
            </div>
          </div>

          <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:block">
            {chatsPanel}
            <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center gap-3">
                <BlurPhoto blur={null} photo={myPhoto} className="h-14 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">Your featured photo</p>
                  <p className="text-[12px] text-muted">Blurred until someone reveals it</p>
                </div>
                <button onClick={() => setPhotoSheet(true)} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-semibold hover:bg-cream">
                  Change
                </button>
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Reveals: <span className="font-semibold text-ink-soft">{price.label}</span>
              </p>
            </div>
          </aside>
        </div>

        <PersonSheet
          open={!!person}
          onClose={() => setPersonId(null)}
          person={person}
          myInterests={myInterests}
          price={price}
          balance={wallet?.balance ?? null}
          revealing={revealing}
          onReveal={() => person && reveal(person)}
          error={sheetError}
        >
          {person && (
            <Button size="lg" onClick={() => sayHi(person)} loading={starting} loadingText="Opening chat…">
              <MessageCircle size={19} /> {person.chat_id ? "Open your chat" : "Say hi"}
            </Button>
          )}
        </PersonSheet>

        <Sheet open={photoSheet} onClose={() => setPhotoSheet(false)} title="Your featured photo" subtitle="People see it blurred until they tap to reveal it.">
          <FeaturedPhotoPicker eventId={e.id} photos={myPhotos} current={myPhoto} onChange={setMyPhoto} bare />
        </Sheet>
      </main>
    );
  }

  /* ================= Before, after, or not yet inside ================= */
  return (
    <main className="mx-auto max-w-md pb-8 lg:max-w-5xl lg:px-10 lg:pt-10">
      {/* Hero */}
      <section className={clsx("relative overflow-hidden bg-gradient-to-br px-5 pt-5 pb-8 text-white lg:rounded-[36px] lg:p-10", themeBg(e.theme))}>
        <CoverImage src={e.cover_url} />
        {!e.cover_url && (
          <>
            <div aria-hidden className="absolute -top-16 -right-16 h-56 w-56 animate-blob rounded-full bg-white/10" />
            <div aria-hidden className="absolute -bottom-20 -left-16 h-56 w-56 animate-blob rounded-full bg-black/10 [animation-delay:-6s]" />
          </>
        )}
        <div className="relative flex items-center justify-between">
          <Link href="/events" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur" aria-label="All events">
            <ArrowLeft size={20} />
          </Link>
          <PhaseBadge phase={phase} startsIn={startsIn} />
        </div>
        <div className={clsx("relative lg:flex lg:items-end lg:justify-between lg:gap-10", e.cover_url ? "mt-16 lg:mt-24" : "mt-6")}>
          <div>
            <KindChip kind={e.kind} />
            <h1 className="mt-3 font-display text-[34px] leading-[1.05] font-semibold lg:text-[48px]">{e.title}</h1>
            <p className="mt-2 text-[15px] text-white/85">{now ? eventWhen(e.starts_at, e.ends_at) : " "}</p>
          </div>
          {!e.cover_url && (
            <span className="mt-6 hidden h-28 w-28 shrink-0 animate-float place-items-center rounded-[32px] bg-white/15 lg:grid">
              {e.kind === "party" ? <Headphones size={56} strokeWidth={1.5} /> : <Sparkles size={56} strokeWidth={1.5} />}
            </span>
          )}
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2 text-[12px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm">{INTENT_ICONS[e.intent]({ size: 13 })} {intentLabel(e.intent)}</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm">Ages {e.age_min}–{e.age_max}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm"><Users size={13} /> {e.going_count} going</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm">
            {e.entry_keys > 0 ? <><KeyCoin size={14} /> {plural(e.entry_keys, "Key")}</> : "Free entry"}
          </span>
        </div>
      </section>

      <div className="px-5 lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 lg:px-0">
        <div className="relative z-10 -mt-5 space-y-4 lg:sticky lg:top-6 lg:col-span-7 lg:mt-0">
          <section className="rounded-[28px] bg-surface p-5 shadow-lift lg:p-7">
            {phase === "cancelled" && (
              <Center title="This event was cancelled" body={e.entry_keys ? "Any Keys you paid have been returned to you." : "Keep an eye out for the next one."}>
                <ButtonLink href="/events" variant="secondary" size="lg">See other events</ButtonLink>
              </Center>
            )}

            {phase === "upcoming" && (
              <div className="text-center">
                <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">Starts in</p>
                <p className="mt-1 font-display text-[44px] leading-none font-semibold tabular-nums">{now ? countdown(startsIn) : "…"}</p>
                {e.i_am_going ? (
                  <>
                    <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-mint-soft px-4 py-2 text-[14px] font-semibold text-mint">You&apos;re going ✓</p>
                    <p className="mt-3 text-[14px] text-muted">Come back here when it starts and tap Join to go in.</p>
                    <button onClick={unRsvp} disabled={!!busy} className="mt-4 text-[13px] font-semibold text-muted underline-offset-2 hover:text-chili hover:underline">
                      {busy === "cancel" ? "Updating…" : "I can't make it"}
                    </button>
                  </>
                ) : (
                  <RsvpButton e={e} busy={busy === "rsvp"} canAfford={canAfford} onRsvp={rsvp} />
                )}
              </div>
            )}

            {phase === "live" && !e.i_am_going && (
              <div className="text-center">
                <LiveLine left={now ? countdown(endsIn) : ""} />
                <p className="mt-2 text-[15px] text-muted">It&apos;s not too late — say you&apos;re going and come straight in.</p>
                <RsvpButton e={e} busy={busy === "rsvp"} canAfford={canAfford} onRsvp={rsvp} label="Join tonight" />
              </div>
            )}

            {phase === "live" && e.i_am_going && !joined && (
              <div className="text-center">
                <LiveLine left={now ? countdown(endsIn) : ""} />
                <p className="mt-3 font-display text-[30px] leading-tight font-semibold">{e.kind === "party" ? "The party's on" : "The wall is open"}</p>
                <p className="mt-1 text-[15px] text-muted">
                  {e.kind === "party" ? "Tap to go in — the music starts when you do." : "Tap to go in and see who's here."}
                </p>
                <Button size="lg" className="mt-5" onClick={join}>
                  <PartyPopper size={20} /> {e.kind === "party" ? "Join the party" : "Join the night"}
                </Button>
              </div>
            )}

            {phase === "ended" && (
              <Center
                title={e.i_am_going ? "That's a wrap!" : "This event has ended"}
                body={
                  e.i_am_going
                    ? chats?.length
                      ? `You chatted with ${plural(chats.length, "person", "people")}. Choose who to keep below.`
                      : "Thanks for coming along."
                    : "Look out for the next one."
                }
              >
                {!e.i_am_going && <ButtonLink href="/events" variant="secondary" size="lg">See other events</ButtonLink>}
              </Center>
            )}
            {error && <p className="mt-4 rounded-xl bg-chili-soft px-4 py-2.5 text-center text-[14px] font-medium text-chili">{error}</p>}
          </section>

          {phase === "ended" && e.i_am_going && chatsPanel}
        </div>

        <aside className="mt-6 space-y-4 lg:col-span-5 lg:mt-0">
          {e.i_am_going && (phase === "upcoming" || phase === "live") && photoPicker}
          {e.description && (
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">About tonight</h2>
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{e.description}</p>
            </div>
          )}
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">How it works</h2>
            <ul className="mt-3 space-y-3 text-[14px]">
              {e.kind === "party" && <Li icon={<Headphones size={16} />} text="Music or video plays for everyone at the same time. Chat and send hype in the room." />}
              <Li icon={<LayoutGrid size={16} />} text="Everyone's featured photo is on the wall, blurred until you tap to reveal it." />
              <Li
                icon={<Eye size={16} />}
                text={`Your first ${plural(s.free_reveals, "reveal")} are free${s.reveal_cost > 0 ? `, then ${plural(s.reveal_cost, "Key")} each` : ""}.`}
              />
              <Li icon={<MessageCircle size={16} />} text={`Say hi to up to ${plural(s.max_chats, "person", "people")} — no reveal needed. Chats last until the end.`} />
              <Li icon={<Handshake size={16} />} text="Afterwards you both choose: keep the chat and it's a match, or let it go." />
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function TabButton({
  active,
  desktopActive,
  onClick,
  icon,
  label,
  badge,
  hot,
  className,
}: {
  active: boolean;
  desktopActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string | null;
  hot?: boolean;
  className?: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition",
        active ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgb(91_63_217/0.7)]" : "bg-cream text-ink-soft hover:bg-line/70 hover:text-ink",
        desktopActive
          ? "lg:bg-brand lg:text-white lg:shadow-[0_6px_16px_-8px_rgb(91_63_217/0.7)]"
          : "lg:bg-cream lg:text-ink-soft lg:shadow-none lg:hover:bg-line/70 lg:hover:text-ink",
        className,
      )}
    >
      {icon} {label}
      {badge && (
        <span className={clsx("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold", hot ? "bg-chili text-white" : "bg-line text-ink-soft")}>{badge}</span>
      )}
    </button>
  );
}

function LiveLine({ left }: { left: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-chili">
      <span className="h-2 w-2 animate-pulse rounded-full bg-chili" /> Happening now · {left} left
    </p>
  );
}

function RsvpButton({ e, busy, canAfford, onRsvp, label }: { e: DashpadEvent; busy: boolean; canAfford: boolean; onRsvp: () => void; label?: string }) {
  if (e.entry_keys > 0 && !canAfford) {
    return (
      <div className="mt-5">
        <ButtonLink href="/wallet" variant="gold" size="lg">
          <KeyCoin size={22} /> Get Keys to join · {e.entry_keys}
        </ButtonLink>
        <p className="mt-2 text-[13px] text-muted">Entry is {plural(e.entry_keys, "Key")}.</p>
      </div>
    );
  }
  return (
    <Button size="lg" className="mt-5" onClick={onRsvp} loading={busy} loadingText="Saving your spot…">
      {label ?? "I'm going"} {e.entry_keys > 0 ? `· ${plural(e.entry_keys, "Key")}` : "· Free"}
    </Button>
  );
}

function Center({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <PartyPopper size={26} />
      </span>
      <p className="mt-3 font-display text-[26px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-muted">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function Li({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <span className="pt-1 leading-snug text-ink-soft">{text}</span>
    </li>
  );
}
