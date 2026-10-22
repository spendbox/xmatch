"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  AtSign, BellOff, BellRing, Cake, ChevronRight, Eye, FileText, ImagePlus, MessageCircle, LogOut, PenLine, Shapes, ShieldCheck, SlidersHorizontal, Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { ageFromBirthdate, GENDERS } from "@/lib/constants";
import { replyLabel } from "@/lib/hourly";
import { InviteCard } from "./InviteCard";
import { plural, word } from "@/lib/plural";
import type { Profile } from "@/lib/types";
import { logOut } from "@/app/(auth)/actions";
import { Button, SubmitButton, tapFeedback } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { Sheet } from "@/components/ui/Sheet";
import { deleteAccount } from "@/app/(app)/profile/actions";
import Link from "next/link";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { InterestIcon } from "@/components/ui/icons";
import { ProfileSheet } from "@/components/matches/ProfileSheet";
import { NotificationsPanel, pushStateText, usePushState } from "@/components/app/Notifications";
import { PhotoGrid, MAX_PHOTOS } from "./PhotoGrid";
import { InterestPicker, MAX_INTERESTS } from "./InterestPicker";

type Panel = null | "photos" | "about" | "interests" | "account" | "delete" | "logout" | "notifications";

/** How complete the profile looks, from 0 to 100. */
function strength(p: { name: string; bio: string; interests: string[]; photos: string[] }) {
  const tips: string[] = [];
  let score = 0;
  if (p.name.trim()) score += 10;
  score += Math.min(p.photos.length, 3) * 15;
  if (p.photos.length < 3) tips.push(`Add ${plural(3 - p.photos.length, "more photo", "more photos")}`);
  if (p.bio.trim().length >= 60) score += 25;
  else if (p.bio.trim().length >= 10) {
    score += 12;
    tips.push("Write a little more about yourself");
  } else tips.push("Write your bio");
  score += Math.min(p.interests.length, 5) * 4;
  if (p.interests.length < 5) tips.push("Pick at least 5 interests");
  return { score: Math.min(100, score), tip: tips[0] };
}

export function ProfileEditor({
  profile,
  email,
  matchCount = 0,
  week = null,
  replySeconds = null,
}: {
  profile: Profile;
  email: string;
  matchCount?: number;
  /** Your last 7 days */
  week?: { week_chats: number; week_unmasks: number; gifts_received: number } | null;
  /** Your usual reply time (others see this while you're masked) */
  replySeconds?: number | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const push = usePushState();
  const [name, setName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio);
  const [interests, setInterests] = useState(profile.interests);
  const [photos, setPhotos] = useState(profile.photos);
  const [open, setOpen] = useState(profile.open_to_masquerade);
  const [panel, setPanel] = useState<Panel>(null);
  const [preview, setPreview] = useState(false);

  // Drafts used inside the edit pop-ups, so cancelling leaves the profile untouched.
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bio);
  const [draftInterests, setDraftInterests] = useState(interests);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const age = ageFromBirthdate(profile.birthdate);
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label;
  const { score, tip } = strength({ name, bio, interests, photos });

  function openPanel(p: Panel) {
    tapFeedback();
    setError(null);
    if (p === "about") {
      setDraftName(name);
      setDraftBio(bio);
    }
    if (p === "interests") setDraftInterests(interests);
    setPanel(p);
  }
  const close = () => setPanel(null);

  async function update(fields: Record<string, unknown>) {
    setSaving(true);
    const { error: err } = await supabase.from("profiles").update(fields).eq("id", profile.id);
    setSaving(false);
    if (err) {
      setError("Couldn't save. Please try again.");
      return false;
    }
    return true;
  }

  async function saveAbout() {
    setError(null);
    if (!draftName.trim()) return setError("Please add your name.");
    if (await update({ display_name: draftName.trim(), bio: draftBio.trim() })) {
      setName(draftName.trim());
      setBio(draftBio.trim());
      close();
    }
  }

  async function saveInterests() {
    setError(null);
    if (draftInterests.length < 3) return setError("Pick at least 3 interests.");
    if (await update({ interests: draftInterests })) {
      setInterests(draftInterests);
      close();
    }
  }

  async function toggleOpen(v: boolean) {
    setOpen(v);
    const { error: err } = await supabase.from("profiles").update({ open_to_masquerade: v }).eq("id", profile.id);
    if (err) setOpen(!v);
  }

  const ring = 2 * Math.PI * 22;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-6 lg:max-w-6xl lg:px-10 lg:pt-10">
      <header className="flex items-end justify-between">
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Profile</h1>
        <button
          onClick={() => {
            tapFeedback();
            setPreview(true);
          }}
          className="mb-1 inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold transition active:scale-95"
        >
          <Eye size={17} /> Preview
        </button>
      </header>

      <div className="lg:mt-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* Left: who you are */}
        <div className="lg:sticky lg:top-8 lg:col-span-5">
          <section className="relative mt-5 overflow-hidden rounded-[30px] bg-ink shadow-lift lg:mt-0">
            {photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
            <div className="relative flex min-h-[300px] flex-col justify-end p-5 text-white">
              <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[12px] font-semibold">
                <MaskIcon className="w-4 text-white" eyes="transparent" /> Hidden until you both unmask
              </span>
              <h2 className="font-display text-[34px] leading-none font-semibold">
                {name || "Your name"}
                <span className="font-normal text-white/80">, {age}</span>
              </h2>
              <p className="mt-1.5 text-[14px] text-white/75">{gender}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat icon={<Cake size={16} />} value={age != null ? String(age) : "–"} label={age === 1 ? "year" : "years"} />
                <Stat icon={<MessageCircle size={16} />} value={matchCount.toLocaleString()} label={word(matchCount, "connection")} />
                <Stat icon={<Shapes size={16} />} value={String(interests.length)} label={word(interests.length, "interest")} />
              </div>
            </div>
          </section>

          {/* Your week */}
          <section className="mt-3 rounded-3xl border border-line bg-surface px-2 py-3 shadow-card">
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Your week</p>
              <p className="text-[11px] font-semibold text-brand">{replyLabel(replySeconds)}</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line text-center">
              {[
                [week?.week_chats ?? 0, `masked ${word(week?.week_chats ?? 0, "chat")}`],
                [week?.week_unmasks ?? 0, word(week?.week_unmasks ?? 0, "unmask")],
                [week?.gifts_received ?? 0, word(week?.gifts_received ?? 0, "gift")],
              ].map(([v, l]) => (
                <div key={String(l)} className="px-1">
                  <p className="font-display text-[22px] leading-tight font-semibold text-brand">{v}</p>
                  <p className="truncate text-[11px] text-muted">{l}</p>
                </div>
              ))}
            </div>
          </section>

          <InviteCard />

          <section className="mt-3 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card">
            <div className="relative grid h-14 w-14 shrink-0 place-items-center">
              <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
                <circle cx="26" cy="26" r="22" fill="none" stroke="var(--color-line)" strokeWidth="5" />
                <circle
                  cx="26" cy="26" r="22" fill="none" strokeWidth="5" strokeLinecap="round"
                  stroke={score >= 100 ? "var(--color-mint)" : "var(--color-brand)"}
                  strokeDasharray={ring} strokeDashoffset={ring * (1 - score / 100)}
                  className="transition-[stroke-dashoffset] duration-700"
                />
              </svg>
              <span className="text-[13px] font-bold">{score}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{score >= 100 ? "Your profile is looking great" : "Profile strength"}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {score >= 100 ? "You're all set for your next reveal." : `${tip} to stand out when you unmask.`}
              </p>
            </div>
          </section>
        </div>

        {/* Right: management cards */}
        <div className="lg:col-span-7">
          <SectionTitle className="lg:mt-0">Your profile</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile
              icon={<ImagePlus size={20} strokeWidth={1.75} />}
              tone="bg-[#fde8f1] text-[#c2306b]"
              title="Photos"
              detail={`${photos.length} of ${MAX_PHOTOS}`}
              onClick={() => openPanel("photos")}
            >
              <div className="mt-3 flex -space-x-2">
                {photos.slice(0, 4).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p} src={p} alt="" className="h-8 w-8 rounded-full border-2 border-surface object-cover" />
                ))}
              </div>
            </Tile>
            <Tile
              icon={<PenLine size={20} strokeWidth={1.75} />}
              tone="bg-brand-soft text-brand"
              title="Name & bio"
              detail={bio.trim() ? bio : "Add a bio"}
              onClick={() => openPanel("about")}
            />
            <Tile
              icon={<Shapes size={20} strokeWidth={1.75} />}
              tone="bg-gold-soft text-[#a26b00]"
              title="Interests"
              detail={`${interests.length} of ${MAX_INTERESTS}`}
              onClick={() => openPanel("interests")}
              className="col-span-2 lg:col-span-1"
            >
              <div className="mt-3 flex gap-1.5 text-ink-soft">
                {interests.slice(0, 5).map((t) => (
                  <span key={t} className="grid h-8 w-8 place-items-center rounded-full bg-cream" title={t}>
                    <InterestIcon name={t} size={15} />
                  </span>
                ))}
              </div>
            </Tile>
          </div>

          <SectionTitle>Masquerade</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px] transition", open ? "bg-brand text-white" : "bg-[#e6f0fd] text-[#2f6fd1]")}>
                  <BellRing size={20} strokeWidth={1.75} />
                </span>
                <Toggle checked={open} onChange={toggleOpen} label="Masquerade pairing" />
              </div>
              <p className="mt-3 text-[15px] font-semibold">Masquerade</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">
                {open ? "On · a new masked pair every hour" : "Off · you won't be paired"}
              </p>
            </div>
            <Link
              href="/home"
              onClick={() => tapFeedback()}
              className="flex flex-col rounded-3xl border border-line bg-surface p-4 shadow-card transition active:scale-[0.97]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#e3f6ee] text-[#16865a]">
                <SlidersHorizontal size={20} strokeWidth={1.75} />
              </span>
              <p className="mt-3 flex items-center justify-between text-[15px] font-semibold">
                Who you meet <ChevronRight size={18} className="text-muted" />
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">Mood, spice, where you are and who</p>
            </Link>
          </div>

          <Link
            href="/wallet"
            className="relative mt-3 flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffcf5c] via-gold to-[#e8962a] p-5 text-ink transition active:scale-[0.98]"
          >
            <div aria-hidden className="absolute -top-10 -right-6 h-32 w-32 rounded-full bg-white/25" />
            <KeyCoin size={48} className="relative" />
            <div className="relative flex-1">
              <p className="font-semibold">Keys</p>
              <p className="text-[13px] text-ink/70">Gifts, reopening past pairs and more</p>
            </div>
            <span className="relative inline-flex items-center gap-1 rounded-full bg-white/40 px-3 py-1.5 text-[13px] font-bold">
              Get Keys <ChevronRight size={15} />
            </span>
          </Link>

          <button
            type="button"
            onClick={() => openPanel("notifications")}
            className="mt-3 flex w-full items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 text-left shadow-card transition hover:border-line-strong active:scale-[0.98]"
          >
            <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px]", push.state === "on" ? "bg-mint-soft text-mint" : "bg-brand-soft text-brand")}>
              {push.state === "on" ? <BellRing size={20} strokeWidth={1.75} /> : <BellOff size={20} strokeWidth={1.75} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Notifications</span>
              <span className={clsx("block truncate text-[13px]", push.state === "on" ? "font-medium text-mint" : "text-muted")}>
                {push.state ? pushStateText[push.state] : "Checking…"}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </button>

          <SectionTitle>Account</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={<AtSign size={20} strokeWidth={1.75} />}
              tone="bg-[#e6f0fd] text-[#2f6fd1]"
              title="Account"
              detail={email}
              onClick={() => openPanel("account")}
            />
            <Tile
              icon={<ShieldCheck size={20} strokeWidth={1.75} />}
              tone="bg-[#e3f6ee] text-[#16865a]"
              title="Privacy"
              detail="Exact location never shown"
              href="/privacy"
            />
            <Tile
              icon={<FileText size={20} strokeWidth={1.75} />}
              tone="bg-cream text-ink-soft"
              title="Terms"
              detail="The rules of Dashpad"
              href="/terms"
            />
            <Tile
              icon={<Trash2 size={20} strokeWidth={1.75} />}
              tone="bg-chili-soft text-chili"
              title="Delete account"
              detail="Remove everything"
              onClick={() => openPanel("delete")}
            />
          </div>

          <Button
            variant="ghost"
            className="mt-3 h-14 w-full rounded-3xl border border-line bg-surface text-chili! shadow-card hover:bg-chili-soft"
            onClick={() => openPanel("logout")}
          >
            <LogOut size={18} /> Log out
          </Button>
          <p className="mt-4 text-center text-[12px] text-muted">dashpad.site</p>
        </div>
      </div>

      {/* Photos */}
      <Sheet
        open={panel === "photos"}
        onClose={close}
        title="Photos"
        subtitle={`${photos.length} of ${MAX_PHOTOS} · the first one is your main photo. Changes save straight away.`}
        icon={<ImagePlus size={22} strokeWidth={1.75} />}
        footer={<Button size="lg" onClick={close}>Done</Button>}
      >
        <PhotoGrid
          photos={photos}
          onAdd={async (f) => {
            const url = await uploadPhoto(supabase, profile.id, f);
            setPhotos((p) => {
              const next = [...p, url];
              supabase.from("profiles").update({ photos: next }).eq("id", profile.id).then(() => {});
              return next;
            });
          }}
          onRemove={(url) => {
            if (photos.length <= 1) return setError("Keep at least one photo.");
            setError(null);
            const next = photos.filter((p) => p !== url);
            setPhotos(next);
            supabase.from("profiles").update({ photos: next }).eq("id", profile.id).then(() => {});
            deletePhoto(supabase, url);
          }}
        />
        {error && <p className="mt-3 text-[14px] font-medium text-chili">{error}</p>}
      </Sheet>

      {/* Name & bio */}
      <Sheet
        open={panel === "about"}
        onClose={close}
        title="Name & bio"
        subtitle="Revealed when you both unmask"
        icon={<PenLine size={22} strokeWidth={1.75} />}
        footer={
          <>
            {error && <p className="mb-3 text-[14px] font-medium text-chili">{error}</p>}
            <Button size="lg" onClick={saveAbout} loading={saving} loadingText="Saving…">Save</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
            <Cake size={18} className="shrink-0 text-ink-soft" />
            <p className="text-[14px]">
              <span className="font-semibold">{age != null ? `${age} years old` : "Age not set"}</span>
              {gender ? ` · ${gender}` : ""}
              <span className="block text-[12px] text-muted">Worked out from your birthday, which is never shown</span>
            </p>
          </div>
          <div>
            <Label htmlFor="name">First name</Label>
            <Input id="name" value={draftName} maxLength={40} onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={5} maxLength={500} value={draftBio} onChange={(e) => setDraftBio(e.target.value)}
              placeholder="What makes you laugh? What are you up to lately?" />
            <p className="mt-1 text-right text-xs text-muted">{draftBio.length}/500</p>
          </div>
        </div>
      </Sheet>

      {/* Interests */}
      <Sheet
        open={panel === "interests"}
        onClose={close}
        title="Interests"
        subtitle={`${draftInterests.length} of ${MAX_INTERESTS} · shown while masked, shared ones help you connect`}
        icon={<Shapes size={22} strokeWidth={1.75} />}
        footer={
          <>
            {error && <p className="mb-3 text-[14px] font-medium text-chili">{error}</p>}
            <Button size="lg" onClick={saveInterests} loading={saving} loadingText="Saving…">Save</Button>
          </>
        }
      >
        <InterestPicker value={draftInterests} onChange={setDraftInterests} />
      </Sheet>

      {/* Account */}
      <Sheet
        open={panel === "account"}
        onClose={close}
        title="Account"
        icon={<AtSign size={22} strokeWidth={1.75} />}
        footer={
          <Button size="lg" variant="secondary" className="text-chili!" onClick={() => openPanel("logout")}>
            <LogOut size={18} /> Log out
          </Button>
        }
      >
        <div className="divide-y divide-line rounded-2xl border border-line">
          <Row label="Email" value={email} />
          <Row label="Password" value="Forgot it? Use “Forgot password” on the login page" />
          <Row label="Age" value={age != null ? `${age} years old` : "Not set"} />
        </div>
      </Sheet>

      {/* Notifications */}
      <Sheet
        open={panel === "notifications"}
        onClose={close}
        title="Notifications"
        subtitle="Get a heads-up on your phone or computer, even when Dashpad is closed."
        icon={<BellRing size={22} strokeWidth={1.75} />}
      >
        <NotificationsPanel push={push} />
      </Sheet>

      {/* Log out */}
      <Sheet
        open={panel === "logout"}
        onClose={close}
        title="Log out of Dashpad?"
        subtitle="You'll need your email and password to log back in."
        icon={<LogOut size={22} strokeWidth={1.75} />}
        footer={
          <div className="space-y-2">
            <form action={logOut}>
              <SubmitButton size="lg" variant="danger" loadingText="Logging out…">
                Yes, log out
              </SubmitButton>
            </form>
            <Button size="lg" variant="secondary" onClick={close}>
              Stay logged in
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-muted">You won&apos;t get pairing or call alerts while you&apos;re logged out.</p>
      </Sheet>

      {/* Delete */}
      <Sheet
        open={panel === "delete"}
        onClose={close}
        title="Delete your account?"
        subtitle="This permanently removes your profile, photos, connections, messages and Keys. It can't be undone."
        icon={<Trash2 size={22} strokeWidth={1.75} className="text-chili" />}
        footer={
          <div className="space-y-2">
            {error && <p className="text-[14px] font-medium text-chili">{error}</p>}
            <form
              action={async () => {
                const res = await deleteAccount();
                if (res?.error) setError(res.error);
              }}
            >
              <SubmitButton size="lg" variant="danger" loadingText="Deleting…">
                Yes, delete my account
              </SubmitButton>
            </form>
            <Button size="lg" variant="secondary" onClick={close}>
              Keep my account
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-muted">If you just need a break, you can simply log out and come back any time.</p>
      </Sheet>

      {preview && (
        <ProfileSheet
          profile={{ ...profile, display_name: name, bio, interests, photos }}
          onClose={() => setPreview(false)}
          note="This is how you look to someone after you both unmask."
        />
      )}
    </main>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={clsx("mt-6 mb-3 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase", className)}>{children}</h2>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-2xl bg-black/35 px-2 py-2.5 text-center">
      <span className="flex items-center gap-1.5">
        <span className="text-white/80">{icon}</span>
        <span className="text-[17px] leading-none font-semibold">{value}</span>
      </span>
      <span className="mt-1 text-[12px] text-white/75">{label}</span>
    </div>
  );
}

/** A tappable settings card: icon, title, one-line summary. Opens a pop-up or a page. */
function Tile({
  icon, tone, title, detail, onClick, href, className, children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  detail: string;
  onClick?: () => void;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-[14px] " + tone}>{icon}</span>
        <ChevronRight size={18} className="text-muted" />
      </div>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-0.5 truncate text-[13px] text-muted">{detail}</p>
      {children}
    </>
  );
  const cls = clsx(
    "flex min-w-0 flex-col rounded-3xl border border-line bg-surface p-4 text-left shadow-card transition hover:border-line-strong active:scale-[0.97]",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[15px] font-medium break-words">{value}</p>
    </div>
  );
}
