"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  AtSign, BellRing, Check, ChevronRight, Eye, Gift, Heart, ImagePlus, LogOut, PenLine, Phone, Shapes, ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { ageFromBirthdate, GENDERS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { logOut } from "@/app/(auth)/actions";
import { Button, ButtonLink, SubmitButton, tapFeedback } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { ProfileSheet } from "@/components/matches/ProfileSheet";
import { PhotoGrid } from "./PhotoGrid";
import { InterestPicker, MAX_INTERESTS } from "./InterestPicker";

/** How complete the profile looks, from 0 to 100. */
function strength(p: { name: string; bio: string; interests: string[]; photos: string[] }) {
  const tips: string[] = [];
  let score = 0;
  if (p.name.trim()) score += 10;
  score += Math.min(p.photos.length, 3) * 15;
  if (p.photos.length < 3) tips.push(`Add ${3 - p.photos.length} more photo${p.photos.length === 2 ? "" : "s"}`);
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
  phone,
  matchCount = 0,
}: {
  profile: Profile;
  email: string;
  phone: string;
  matchCount?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio);
  const [interests, setInterests] = useState(profile.interests);
  const [photos, setPhotos] = useState(profile.photos);
  const [open, setOpen] = useState(profile.open_to_masquerade);
  const [saved, setSaved] = useState({ name: profile.display_name ?? "", bio: profile.bio, interests: profile.interests });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const age = ageFromBirthdate(profile.birthdate);
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label;
  const { score, tip } = strength({ name, bio, interests, photos });
  const dirty = name !== saved.name || bio !== saved.bio || interests.join() !== saved.interests.join();

  async function savePhotos(next: string[]) {
    setPhotos(next);
    await supabase.from("profiles").update({ photos: next }).eq("id", profile.id);
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Please add your name.");
    if (interests.length < 3) return setError("Pick at least 3 interests.");
    setSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), bio: bio.trim(), interests })
      .eq("id", profile.id);
    setSaving(false);
    if (err) return setError("Couldn't save. Please try again.");
    setSaved({ name, bio, interests });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  }

  async function toggleOpen(v: boolean) {
    setOpen(v);
    const { error: err } = await supabase.from("profiles").update({ open_to_masquerade: v }).eq("id", profile.id);
    if (err) setOpen(!v);
  }

  const ring = 2 * Math.PI * 22;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-6">
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

      {/* Hero */}
      <section className="relative mt-5 animate-fade-up overflow-hidden rounded-[30px] bg-ink shadow-lift">
        {photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="relative flex min-h-[300px] flex-col justify-end p-5 text-white">
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold backdrop-blur">
            <MaskIcon className="w-4 text-white" eyes="transparent" /> Hidden until you both unmask
          </span>
          <h2 className="font-display text-[34px] leading-none font-semibold">
            {name || "Your name"}
            <span className="font-normal text-white/80">, {age}</span>
          </h2>
          <p className="mt-1.5 text-[14px] text-white/75">{gender}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat icon={<Heart size={16} />} value={String(matchCount)} label={matchCount === 1 ? "match" : "matches"} />
            <Stat icon={<Shapes size={16} />} value={String(interests.length)} label="interests" />
          </div>
        </div>
      </section>

      {/* Profile strength */}
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

      {/* Photos */}
      <Card icon={<ImagePlus size={20} strokeWidth={1.75} />} tone="bg-[#fde8f1] text-[#c2306b]" title="Photos" subtitle={`${photos.length} of 6 · first one is your main photo`}>
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
            savePhotos(photos.filter((p) => p !== url));
            deletePhoto(supabase, url);
          }}
        />
      </Card>

      {/* About */}
      <Card icon={<PenLine size={20} strokeWidth={1.75} />} tone="bg-brand-soft text-brand" title="About you" subtitle="Revealed when you both unmask">
        <div className="space-y-5">
          <div>
            <Label htmlFor="name">First name</Label>
            <Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="What makes you laugh? What are you into lately?" />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/500</p>
          </div>
        </div>
      </Card>

      {/* Interests */}
      <Card icon={<Shapes size={20} strokeWidth={1.75} />} tone="bg-gold-soft text-[#a26b00]" title="Interests" subtitle={`${interests.length} of ${MAX_INTERESTS} · shown while masked, shared ones help you match`}>
        <InterestPicker value={interests} onChange={setInterests} />
      </Card>

      {/* Masquerade */}
      <section className="mt-3 rounded-3xl border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3.5">
          <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-[14px] transition", open ? "bg-brand text-white" : "bg-cream text-ink-soft")}>
            <BellRing size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Open to Masquerade</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">Pop-ups when someone masked is looking for you.</p>
          </div>
          <Toggle checked={open} onChange={toggleOpen} label="Open to Masquerade" />
        </div>
        <ButtonLink href="/masquerade" variant="ghost" className="mt-3 w-full rounded-2xl bg-cream px-4 text-[14px]">
          Change who you meet <ChevronRight size={18} />
        </ButtonLink>
      </section>

      {/* Gifts */}
      <section className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#7b5cf0] to-[#c2306b] p-5 text-white">
        <div aria-hidden className="absolute -top-10 -right-6 h-32 w-32 animate-blob rounded-full bg-gold/30 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 animate-float place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <Gift size={24} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Gifts are coming soon</p>
            <p className="text-[13px] text-white/80">Send something sweet to your matches.</p>
          </div>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">Soon</span>
        </div>
      </section>

      {/* Account */}
      <section className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <p className="px-4 pt-4 pb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">Account</p>
        <Row icon={<AtSign size={18} strokeWidth={1.75} />} label="Email" value={email} />
        <Row icon={<Phone size={18} strokeWidth={1.75} />} label="Phone" value={phone || "—"} />
        <Row icon={<ShieldCheck size={18} strokeWidth={1.75} />} label="Privacy" value="Exact location never shown" />
        <form action={logOut} className="border-t border-line p-2">
          <SubmitButton variant="ghost" className="h-12 w-full rounded-2xl text-chili! hover:bg-chili-soft" loadingText="Logging out…">
            <LogOut size={18} /> Log out
          </SubmitButton>
        </form>
      </section>

      <p className="mt-6 text-center text-[12px] text-muted">Dashpad · dashpad.site</p>

      {/* Floating save bar */}
      {(dirty || justSaved || error) && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
          <div className="mx-auto flex max-w-md animate-fade-up items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2.5 pl-4 shadow-lift backdrop-blur">
            <p className={clsx("min-w-0 flex-1 truncate text-[14px] font-medium", error ? "text-chili" : "text-ink-soft")}>
              {error ?? (justSaved && !dirty ? "All changes saved" : "You have unsaved changes")}
            </p>
            {dirty ? (
              <Button onClick={save} loading={saving} loadingText="Saving…" className="h-10 rounded-xl px-4">
                Save
              </Button>
            ) : (
              <span className="grid h-10 w-10 animate-pop place-items-center rounded-xl bg-mint text-white">
                <Check size={18} strokeWidth={3} />
              </span>
            )}
          </div>
        </div>
      )}

      {preview && (
        <ProfileSheet
          profile={{ ...profile, display_name: name, bio, interests, photos }}
          onClose={() => setPreview(false)}
          note="This is how you look to a match after you both unmask."
        />
      )}
    </main>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur">
      <span className="text-white/80">{icon}</span>
      <span className="text-[16px] font-semibold">{value}</span>
      <span className="text-[13px] text-white/70">{label}</span>
    </div>
  );
}

function Card({
  icon, tone, title, subtitle, children,
}: { icon: React.ReactNode; tone: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-[13px] " + tone}>{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream text-ink-soft">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-muted">{label}</p>
        <p className="truncate text-[15px] font-medium">{value}</p>
      </div>
    </div>
  );
}
