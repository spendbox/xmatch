"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, ChevronRight, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/pushClient";
import { thumbFallback, thumbUrl } from "@/lib/photos";
import type { Viewer, Viewers } from "@/lib/explore";
import { Sheet } from "@/components/ui/Sheet";
import { Spinner, tapFeedback } from "@/components/ui/Button";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { keysError } from "@/components/keys/GiftSheet";
import { ExploreProfileSheet } from "@/components/explore/ExploreProfileSheet";

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

function Face({ v, size }: { v: Pick<Viewer, "name" | "photo">; size: number }) {
  return (
    <span className="block shrink-0 overflow-hidden rounded-full bg-brand-soft ring-2 ring-surface" style={{ width: size, height: size }}>
      {v.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl(v.photo) ?? v.photo} onError={thumbFallback(v.photo)} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center font-semibold text-brand" style={{ fontSize: size * 0.4 }}>
          {v.name.charAt(0)}
        </span>
      )}
    </span>
  );
}

/** Home: "10 people viewed you today". Tap to see who, and wave at them. */
export function ProfileViews({ demo, onKeys }: { demo?: Viewers; /** Keys were spent on a wave */ onKeys?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [data, setData] = useState<Viewers | null>(demo ?? null);
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (demo) return;
    const { data: d, error: err } = await supabase.rpc("my_viewers");
    if (!err && d) setData(d as Viewers);
  }, [supabase, demo]);

  useEffect(() => {
    void load();
    // From a "waved at you" notification
    try {
      if (new URLSearchParams(window.location.search).get("views") === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [load]);

  async function wave(v: Viewer) {
    tapFeedback();
    setError(null);
    if (demo) {
      setData((d) => d && { ...d, people: d.people.map((x) => (x.id === v.id ? { ...x, i_waved: true } : x)) });
      return;
    }
    setBusy(v.id);
    const { data: r, error: err } = await supabase.rpc("wave_person", { p_id: v.id });
    setBusy(null);
    if (err || !r) return setError((err?.message?.includes("NOT_ENOUGH_KEYS") ? keysError(err.message) : err?.message?.replace(/^.*?: /, "")) || "Couldn't wave. Try again.");
    onKeys?.();
    const res = r as { kind: "waved" | "match" | "masked"; id?: string; again?: boolean; mutual?: boolean };
    if (res.kind === "waved") {
      if (!res.again) notify({ kind: "wave", personId: v.id });
      setData((d) => d && { ...d, people: d.people.map((x) => (x.id === v.id ? { ...x, i_waved: true } : x)) });
      return;
    }
    if (res.mutual) notify({ kind: "wave", personId: v.id });
    router.push(res.kind === "match" ? `/matches/${res.id}` : `/masquerade/${res.id}`);
  }

  if (!data || data.people.length === 0) return null;
  const today = data.today;
  const count = today > 0 ? today : data.people.length;
  const waves = data.people.filter((p) => p.waved_me && !p.connected).length;
  const faces = data.people.slice(0, 3);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          setOpen(true);
        }}
        className="mt-5 flex w-full items-center gap-3 rounded-[24px] border border-line bg-surface px-4 py-3 text-left shadow-card transition active:scale-[0.99] lg:mt-6"
        aria-label={`${count} ${count === 1 ? "person" : "people"} viewed you ${today > 0 ? "today" : "this week"}. See who`}
      >
        <span className="flex shrink-0 -space-x-3">
          {faces.map((v) => (
            <Face key={v.id} v={v} size={38} />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">
            {count} {count === 1 ? "person" : "people"} viewed you {today > 0 ? "today" : "this week"}
          </span>
          <span className="block truncate text-[12.5px] text-muted">
            {waves > 0 ? `${waves} waved at you 👋` : "Tap to see who"}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Who viewed you"
        subtitle={`The last 7 days. Wave at someone${(data.wave_cost ?? 0) > 0 ? "" : " for free"}: if you both wave, your chat opens free.`}
        icon={<Eye size={20} />}
      >
        {error && <p className="mb-2 text-center text-[13px] font-medium text-chili">{error}</p>}
        <ul className="-mx-1 divide-y divide-line">
          {data.people.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-1 py-2.5">
              <button type="button" onClick={() => setPerson(v.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`See ${v.name}'s profile`}>
                <span className="relative">
                  <Face v={v} size={48} />
                  {v.online && <span className="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full bg-mint ring-2 ring-surface" aria-label="Online" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{v.name.split(" ")[0]}</span>
                  <span className={clsx("block truncate text-[12.5px]", v.waved_me && !v.connected ? "font-semibold text-[#8a5a00]" : "text-muted")}>
                    {v.waved_me && !v.connected ? "Waved at you 👋" : `Viewed you ${ago(v.seen_at)}`}
                  </span>
                </span>
              </button>
              {v.connected ? (
                <span className="text-[12.5px] font-semibold text-brand">Connected</span>
              ) : v.waved_me ? (
                <button type="button" onClick={() => wave(v)} disabled={!!busy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 text-[13.5px] font-bold text-ink active:scale-95 disabled:opacity-60">
                  {busy === v.id ? <Spinner className="h-4 w-4" /> : <span aria-hidden>👋</span>} Wave back
                </button>
              ) : v.i_waved ? (
                <span className="inline-flex h-10 shrink-0 items-center gap-1 px-2 text-[13px] font-semibold text-muted">
                  <Check size={15} /> Waved
                </span>
              ) : (
                <button type="button" onClick={() => wave(v)} disabled={!!busy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13.5px] font-bold text-ink active:scale-95 disabled:opacity-60" aria-label={`Wave at ${v.name.split(" ")[0]}${(data.wave_cost ?? 0) > 0 ? ` for ${data.wave_cost} Keys` : ""}`}>
                  {busy === v.id ? <Spinner className="h-4 w-4" /> : <span aria-hidden>👋</span>} Wave
                  {(data.wave_cost ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      · <KeyCoin size={15} /> {data.wave_cost}
                    </span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Sheet>

      {person && (
        <ExploreProfileSheet
          personId={person}
          onClose={() => setPerson(null)}
          onChanged={() => {
            void load();
            onKeys?.();
          }}
          demo={demo ? demoProfileOf(data.people.find((x) => x.id === person)) : undefined}
        />
      )}
    </>
  );
}

/** Design previews: a simple profile for someone in the list */
function demoProfileOf(v?: Viewer) {
  if (!v) return undefined;
  return {
    id: v.id, name: v.name, age: null, gender: null, bio: "", interests: ["Food", "Music"], place: "Lagos", intent: null, online: v.online,
    photos: v.photo ? [v.photo] : [], photo_count: v.photo ? 3 : 0, photos_unlocked: false, photos_paid: true, match_id: null,
    shared_interests: ["Food"], message_cost: 2, photos_cost: 5, waved_me: v.waved_me, i_waved: v.i_waved,
  };
}
