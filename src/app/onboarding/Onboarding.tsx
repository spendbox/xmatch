"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { GENDERS, ageFromBirthdate } from "@/lib/constants";
import type { Gender, Profile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Label, Textarea } from "@/components/ui/Field";
import { Choice } from "@/components/ui/Choice";
import { Logo } from "@/components/ui/Logo";
import { StepDots } from "@/components/profile/StepHeader";
import { PhotoGrid } from "@/components/profile/PhotoGrid";
import { InterestPicker, MAX_INTERESTS } from "@/components/profile/InterestPicker";

const STEPS = [
  { title: "First, the basics", subtitle: "Only shown to people after you both unmask." },
  { title: "Your personality", subtitle: "This is what people see while you're masked." },
  { title: "Add your photos", subtitle: "Revealed only when you both choose to unmask." },
];

export function Onboarding({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.display_name ?? "");
  const [birthdate, setBirthdate] = useState(profile.birthdate ?? "");
  const [gender, setGender] = useState<Gender | "">(profile.gender ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [photos, setPhotos] = useState<string[]>(profile.photos ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function validate(): string | null {
    if (step === 0) {
      if (!name.trim()) return "What should we call you?";
      const age = ageFromBirthdate(birthdate);
      if (age === null) return "Please add your birthday.";
      if (age < 18) return "You must be 18 or older to use Dashpad.";
      if (age > 99) return "Please check your birthday.";
      if (!gender) return "Please choose how you identify.";
    }
    if (step === 1) {
      if (bio.trim().length < 10) return "Write a little about yourself (at least 10 characters).";
      if (interests.length < 3) return "Pick at least 3 interests.";
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
        ? { display_name: name.trim(), birthdate, gender }
        : step === 1
          ? { bio: bio.trim(), interests }
          : { photos };
    const { error: err } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setSaving(false);
    if (err) return setError("Couldn't save. Please check your connection and try again.");
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      router.replace("/masquerade");
      router.refresh();
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

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe">
      <header className="flex h-16 items-center justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Back">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <Logo />
        )}
        <span className="text-sm font-medium text-muted">
          {step + 1} of {STEPS.length}
        </span>
      </header>
      <StepDots step={step} total={STEPS.length} />

      <div key={step} className="pt-8 animate-fade-up">
        <h1 className="font-display text-[30px] leading-tight font-semibold tracking-tight">{STEPS[step].title}</h1>
        <p className="mt-2 text-[16px] text-muted">{STEPS[step].subtitle}</p>

        <div className="mt-8 space-y-6">
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="name">First name</Label>
                <Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada" autoComplete="given-name" />
              </div>
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <Input id="birthday" type="date" value={birthdate} max={maxDate.toISOString().slice(0, 10)}
                  onChange={(e) => setBirthdate(e.target.value)} />
                <p className="mt-2 text-sm text-muted">Only your age is shown, never your birthday.</p>
              </div>
              <div>
                <Label>I am a</Label>
                <Choice name="Gender" options={GENDERS} value={gender as Gender} onChange={setGender} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <Label htmlFor="bio">About me</Label>
                <Textarea id="bio" rows={5} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="What makes you laugh? What are you into lately? What's a perfect Sunday?" />
                <p className="mt-1 text-right text-xs text-muted">{bio.length}/500</p>
              </div>
              <div>
                <Label>
                  Interests <span className="font-normal text-muted">· {interests.length}/{MAX_INTERESTS}</span>
                </Label>
                <InterestPicker value={interests} onChange={setInterests} />
              </div>
            </>
          )}

          {step === 2 && <PhotoGrid photos={photos} onAdd={addPhoto} onRemove={removePhoto} />}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-8 pb-2">
        <FormError message={error} />
        <Button size="lg" onClick={next} loading={saving}>
          {step < STEPS.length - 1 ? "Continue" : "Finish"}
        </Button>
      </div>
    </main>
  );
}
