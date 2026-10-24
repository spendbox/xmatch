"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Camera, Check, Lightbulb, MapPin, Mars, PenLine, Shapes, Smile, UserRound, Venus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { ageFromBirthdate } from "@/lib/constants";
import type { Gender, Profile } from "@/lib/types";
import { Button, ButtonLink, tapFeedback } from "@/components/ui/Button";
import { FormError, IconInput, Label, Textarea } from "@/components/ui/Field";
import { Choice } from "@/components/ui/Choice";
import { Logo } from "@/components/ui/Logo";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { PhotoGrid } from "@/components/profile/PhotoGrid";
import { InterestPicker, MAX_INTERESTS } from "@/components/profile/InterestPicker";
import { PlacePicker } from "@/components/home/PlacePicker";

const STEPS = [
  { title: "First, the basics", subtitle: "Only your age is shown while masked. The rest is revealed when you both unmask.", icon: UserRound },
  { title: "Show your personality", subtitle: "Your interests are what people see while you're masked. Your bio is revealed after.", icon: PenLine },
  { title: "Add your photos", subtitle: "Hidden until you both choose to unmask. Add at least one.", icon: Camera },
];

const BIO_PROMPTS = [
  "My perfect Sunday looks like ",
  "I'm weirdly good at ",
  "You'll win me over if ",
  "Lately I can't stop ",
  "My friends would describe me as ",
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function Onboarding({ profile, demoStep, demoDone }: { profile: Profile; demoStep?: number; demoDone?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(demoStep ?? 0);
  const [done, setDone] = useState(!!demoDone);
  const [name, setName] = useState(profile.display_name ?? "");
  const initial = profile.birthdate ? profile.birthdate.split("-").map(Number) : [];
  const [year, setYear] = useState<number | "">(initial[0] ?? "");
  const [month, setMonth] = useState<number | "">(initial[1] ?? "");
  const [day, setDay] = useState<number | "">(initial[2] ?? "");
  const [gender, setGender] = useState<Gender | "">(profile.gender ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [photos, setPhotos] = useState<string[]>(profile.photos ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<string | null>(profile.place_label ?? null);
  const [placeOpen, setPlaceOpen] = useState(false);

  // Just took a pact? Start from what they told it (they still check and finish it)
  useEffect(() => {
    if (demoStep !== undefined) return;
    try {
      const key = Object.keys(localStorage).find((k) => k.startsWith("dp_pact_draft_"));
      const about = key ? (JSON.parse(localStorage.getItem(key) ?? "null")?.about as { gender?: Gender; age?: number } | undefined) : undefined;
      if (!about) return;
      if (about.gender && !profile.gender) setGender(about.gender);
      if (about.age && !profile.birthdate) setYear(new Date().getFullYear() - about.age);
    } catch {
      /* nothing kept */
    }
  }, [demoStep, profile.gender, profile.birthdate]);

  const birthdate = year && month && day ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  const age = ageFromBirthdate(birthdate || null);
  const thisYear = new Date().getFullYear();
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;

  function validate(): string | null {
    if (step === 0) {
      if (!name.trim()) return "What should we call you?";
      if (!birthdate || age === null) return "Please add your birthday.";
      if (age < 18) return "You must be 18 or older to use Dashpad.";
      if (!gender) return "Please choose how you identify.";
      if (!place) return "Tell us where you are.";
    }
    if (step === 1) {
      if (interests.length < 3) return "Pick at least 3 interests.";
      if (bio.trim().length < 10) return "Write a little about yourself (at least 10 characters).";
    }
    if (step === 2 && photos.length < 1) return "Add at least one photo.";
    return null;
  }

  async function next() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    setSaving(true);
    const patch =
      step === 0
        ? // Brand-new members start with "Open to Masquerade" switched on
          { display_name: name.trim(), birthdate, gender, ...(profile.display_name ? {} : { open_to_masquerade: true }) }
        : step === 1 ? { bio: bio.trim(), interests } : { photos };
    const { error: err } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setSaving(false);
    if (err) return setError("Couldn't save. Please check your connection and try again.");
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      // Came through a friend's invite link? Credit them (anonymously)
      const ref = document.cookie.match(/(?:^|; )dp_ref=([^;]+)/)?.[1];
      if (ref) {
        await supabase.rpc("claim_invite", { p_code: ref });
        document.cookie = "dp_ref=; max-age=0; path=/";
      }
      setDone(true);
    }
  }

  async function addPhoto(file: File) {
    const url = await uploadPhoto(supabase, profile.id, file);
    setPhotos((p) => [...p, url]);
  }
  function removePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
    deletePhoto(supabase, url);
  }

  if (done) return <AllSet name={name} />;

  const Current = STEPS[step];

  return (
    <main className="relative min-h-dvh overflow-x-clip lg:flex lg:items-center lg:justify-center lg:py-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden lg:inset-0 lg:h-auto">
        <div className="absolute -top-24 -left-16 h-64 w-64 animate-blob rounded-full text-brand/20 glow" />
        <div className="absolute -top-10 -right-20 h-64 w-64 animate-blob rounded-full text-[#ff8fb8]/20 glow [animation-delay:-6s]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 lg:min-h-0 lg:w-full lg:max-w-xl lg:rounded-[36px] lg:border lg:border-white/80 lg:bg-surface lg:px-10 lg:pt-4 lg:pb-8 lg:shadow-lift">
        <header className="flex h-16 items-center justify-between">
          {step > 0 ? (
            <button onClick={() => { setError(null); setStep(step - 1); }} className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Back">
              <ArrowLeft size={22} />
            </button>
          ) : (
            <Logo />
          )}
          <span className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-muted shadow-card">
            Step {step + 1} of {STEPS.length}
          </span>
        </header>

        {/* Progress with icons */}
        <ol className="mt-2 flex items-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < step ? "done" : i === step ? "now" : "next";
            return (
              <li key={s.title} className={clsx("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                <span
                  className={clsx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-300",
                    state === "done" && "bg-mint text-white",
                    state === "now" && "scale-110 bg-brand text-white shadow-[0_6px_18px_-6px_rgb(91_63_217/0.7)]",
                    state === "next" && "border border-line-strong bg-surface text-muted",
                  )}
                >
                  {state === "done" ? <Check size={18} strokeWidth={3} /> : <Icon size={18} strokeWidth={1.9} />}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="mx-2 h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <span className={clsx("block h-full rounded-full bg-mint transition-all duration-500", i < step ? "w-full" : "w-0")} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div key={step} className="animate-fade-up pt-7">
          <h1 className="font-display text-[30px] leading-tight font-semibold tracking-tight">{Current.title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{Current.subtitle}</p>

          <div className="mt-7 space-y-6">
            {step === 0 && (
              <>
                <div>
                  <Label htmlFor="name">First name</Label>
                  <IconInput id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada"
                    autoComplete="given-name" icon={<Smile size={19} strokeWidth={1.75} />} />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Birthday</Label>
                    {age !== null && age >= 18 && (
                      <span className="-mt-2 animate-pop rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-semibold text-brand">You&apos;re {age}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
                    <Select label="Day" value={day} onChange={setDay} options={Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} />
                    <Select label="Month" value={month} onChange={(m) => { setMonth(m); if (day && year && m && day > new Date(Number(year), Number(m), 0).getDate()) setDay(""); }}
                      options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} />
                    <Select label="Year" value={year} onChange={setYear} options={Array.from({ length: 82 }, (_, i) => ({ value: thisYear - 18 - i, label: String(thisYear - 18 - i) }))} />
                  </div>
                  <p className="mt-2 text-[13px] text-muted">We only ever show your age, never your birthday.</p>
                </div>

                <div>
                  <Label>Where are you?</Label>
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setPlaceOpen(true);
                    }}
                    className="flex h-14 w-full items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-left transition hover:border-brand"
                  >
                    <MapPin size={19} strokeWidth={1.75} className="shrink-0 text-muted" />
                    <span className={clsx("min-w-0 flex-1 truncate text-[16px]", place ? "text-ink" : "text-muted")}>{place ?? "Choose your country and state"}</span>
                    <ArrowRight size={18} className="shrink-0 text-muted" />
                  </button>
                  <p className="mt-2 text-[13px] text-muted">We pair you with people near you first. No GPS, and only your state and country are shown.</p>
                  <PlacePicker
                    open={placeOpen}
                    onClose={() => setPlaceOpen(false)}
                    userId={profile.id}
                    current={{ country: profile.place_country ?? null, region: profile.place_region ?? null }}
                    onSaved={(p) => setPlace(p.label)}
                  />
                </div>

                <div>
                  <Label>I am a</Label>
                  <Choice
                    name="Gender"
                    value={gender as Gender}
                    onChange={setGender}
                    options={[
                      { value: "woman", label: "Female", icon: <Venus size={22} strokeWidth={1.75} /> },
                      { value: "man", label: "Male", icon: <Mars size={22} strokeWidth={1.75} /> },
                      { value: "other", label: "Other", icon: <UserRound size={22} strokeWidth={1.75} /> },
                    ]}
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <Label>
                    <span className="inline-flex items-center gap-1.5"><Shapes size={16} /> Interests</span>{" "}
                    <span className="font-normal text-muted">· {interests.length}/{MAX_INTERESTS}, pick at least 3</span>
                  </Label>
                  <InterestPicker value={interests} onChange={setInterests} />
                </div>
                <div>
                  <Label htmlFor="bio">About me</Label>
                  <Textarea id="bio" rows={5} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)}
                    placeholder="What makes you laugh? What are you into lately?" />
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {BIO_PROMPTS.filter((p) => !bio.includes(p)).slice(0, 3).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            tapFeedback();
                            setBio((b) => (b.trim() ? b.trimEnd() + "\n" : "") + p);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand/40 bg-brand-soft/50 px-2.5 py-1 text-[12px] font-medium text-brand-ink active:scale-95"
                        >
                          <Lightbulb size={12} /> {p.trim()}…
                        </button>
                      ))}
                    </div>
                    <span className="shrink-0 text-xs text-muted">{bio.length}/500</span>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <PhotoGrid photos={photos} onAdd={addPhoto} onRemove={removePhoto} onReorder={setPhotos} />
                <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
                  <p className="flex items-center gap-2 text-[14px] font-semibold">
                    <Lightbulb size={17} className="text-gold" /> Photos that get the best reveals
                  </p>
                  <ul className="mt-2.5 space-y-1.5 text-[13px] text-muted">
                    {["A clear, smiling photo of just you first", "Recent photos — no heavy filters", "Something that shows what you love doing"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <Check size={14} className="shrink-0 text-mint" strokeWidth={3} /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 mt-auto -mx-5 space-y-3 bg-gradient-to-t from-cream via-cream to-transparent px-5 pt-8 pb-safe lg:static lg:mx-0 lg:bg-none lg:px-0 lg:pb-0">
          <FormError message={error} />
          <Button size="lg" onClick={next} loading={saving} loadingText="Saving…">
            {step < STEPS.length - 1 ? "Continue" : "Finish"} <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </main>
  );
}

function Select<T extends number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | "";
  onChange: (v: T | "") => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className={clsx("relative flex h-14 flex-col justify-center rounded-2xl border bg-surface px-3.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10", value ? "border-line-strong" : "border-line-strong")}>
      <span className="text-[11px] font-medium text-muted">{label}</span>
      <span className={clsx("truncate text-[15px] font-semibold", !value && "text-muted/60")}>{value ? options.find((o) => o.value === value)?.label : "Select"}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as T) : "")}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AllSet({ name }: { name: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute top-10 -left-20 h-80 w-80 animate-blob rounded-full text-brand/25 glow" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 animate-blob rounded-full text-gold/30 glow [animation-delay:-5s]" />
      </div>
      <div className="relative max-w-sm animate-pop text-center">
        <div className="relative mx-auto grid h-32 w-32 place-items-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand/25" />
          <span className="relative grid h-24 w-24 animate-float place-items-center rounded-full bg-brand text-white shadow-lift">
            <MaskIcon className="w-14" eyes="#5b3fd9" />
          </span>
        </div>
        <h1 className="mt-8 font-display text-[34px] leading-tight font-semibold">You&apos;re all set{name ? `, ${name}` : ""}!</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">Your mask is ready. Find someone on your wavelength and see if the vibe is mutual.</p>
        <ButtonLink href="/home" variant="gold" size="lg" className="mt-8" loadingText="Opening…">
          Put on your mask <ArrowRight size={18} />
        </ButtonLink>
      </div>
    </main>
  );
}
