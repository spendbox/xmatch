"use client";

import { useState } from "react";
import { Check, Gift, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadPhoto, deletePhoto } from "@/lib/photos";
import { ageFromBirthdate, GENDERS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { logOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Label, Textarea } from "@/components/ui/Field";
import { PhotoGrid } from "./PhotoGrid";
import { InterestPicker, MAX_INTERESTS } from "./InterestPicker";

export function ProfileEditor({ profile, email, phone }: { profile: Profile; email: string; phone: string }) {
  const supabase = createClient();
  const [name, setName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio);
  const [interests, setInterests] = useState(profile.interests);
  const [photos, setPhotos] = useState(profile.photos);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const age = ageFromBirthdate(profile.birthdate);
  const gender = GENDERS.find((g) => g.value === profile.gender)?.label;

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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-6">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight">Profile</h1>
      <p className="mt-1.5 text-[15px] text-muted">
        {age} · {gender} · Shown only after you both unmask
      </p>

      <section className="mt-7">
        <h2 className="mb-3 text-[15px] font-semibold">Photos</h2>
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
      </section>

      <section className="mt-8 space-y-6">
        <div>
          <Label htmlFor="name">First name</Label>
          <Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bio">About me</Label>
          <Textarea id="bio" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div>
          <Label>
            Interests <span className="font-normal text-muted">· {interests.length}/{MAX_INTERESTS}</span>
          </Label>
          <InterestPicker value={interests} onChange={setInterests} />
        </div>
        <FormError message={error} />
        <Button size="lg" onClick={save} loading={saving}>
          {saved ? (
            <>
              <Check size={18} /> Saved
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </section>

      <section className="mt-8 flex items-center gap-4 rounded-3xl bg-gradient-to-br from-brand to-[#7b5cf0] p-5 text-white">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15">
          <Gift size={24} />
        </span>
        <div>
          <p className="font-semibold">Gifts are coming soon</p>
          <p className="text-[14px] text-white/80">Send something sweet to your matches.</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold">Account</h2>
        <dl className="divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-card">
          <Row label="Email" value={email} />
          <Row label="Phone" value={phone || "—"} />
        </dl>
        <form action={logOut} className="mt-4">
          <Button variant="ghost" size="lg" type="submit" className="text-chili">
            <LogOut size={18} /> Log out
          </Button>
        </form>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="truncate text-[15px] font-medium">{value}</dd>
    </div>
  );
}
