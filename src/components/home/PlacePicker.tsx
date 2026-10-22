"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, MapPin, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/Sheet";
import { tapFeedback } from "@/components/ui/Button";

// [country code, country name, continent code, states/regions]
type Country = [string, string, string, string[]];

export type Place = { country: string; region: string; continent: string; label: string };

let cache: Promise<Country[]> | null = null;
function loadPlaces() {
  cache ??= fetch("/places.json").then((r) => r.json() as Promise<Country[]>);
  return cache;
}

/** 🇳🇬 from "NG" */
export const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

/** Pick your country, then your state or region. No GPS needed. */
export function PlacePicker({
  open,
  onClose,
  userId,
  current,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  current: { country: string | null; region: string | null };
  onSaved: (p: Place) => void;
}) {
  const [all, setAll] = useState<Country[] | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setError(null);
    loadPlaces()
      .then((list) => {
        setAll(list);
        setCountry(current.country ? list.find((c) => c[0] === current.country) ?? null : null);
      })
      .catch(() => setError("Couldn't load places. Check your connection."));
  }, [open, current.country]);

  const results = useMemo(() => {
    if (!all) return [];
    const s = q.trim().toLowerCase();
    if (country) return country[3].filter((r) => !s || r.toLowerCase().includes(s));
    if (!s) return all;
    // Search countries, and states across all countries ("Lagos" finds Lagos, Nigeria)
    return all.filter((c) => c[1].toLowerCase().includes(s) || c[3].some((r) => r.toLowerCase().includes(s)));
  }, [all, country, q]);

  async function save(c: Country, region: string) {
    tapFeedback();
    setSaving(true);
    setError(null);
    const place: Place = { country: c[0], region, continent: c[2], label: `${region}, ${c[1]}` };
    const { error: err } = await createClient()
      .from("profiles")
      .update({ place_country: place.country, place_region: place.region, place_continent: place.continent, place_label: place.label })
      .eq("id", userId);
    setSaving(false);
    if (err) return setError("Couldn't save. Please try again.");
    onSaved(place);
    onClose();
  }

  const s = q.trim().toLowerCase();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={country ? `Where in ${country[1]}?` : "Where are you?"}
      subtitle="We pair you with people closest to you first. Only your state and country are shown."
      icon={<MapPin size={22} />}
    >
      <div className="sticky -top-1 z-10 -mx-1 bg-surface px-1 pb-3">
        {country && (
          <button
            type="button"
            onClick={() => {
              setCountry(null);
              setQ("");
            }}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"
          >
            <ArrowLeft size={15} /> All countries
          </button>
        )}
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-line-strong bg-cream px-4 focus-within:border-brand">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={country ? "Search states and regions" : "Search a country or state"}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            autoFocus
          />
        </label>
      </div>
      {error && <p className="mb-3 rounded-xl bg-chili-soft px-4 py-2.5 text-[14px] font-medium text-chili">{error}</p>}
      {!all ? (
        <p className="py-8 text-center text-[14px] text-muted">Loading…</p>
      ) : (
        <ul className={clsx("max-h-[50dvh] divide-y divide-line overflow-y-auto rounded-2xl border border-line", saving && "opacity-60")}>
          {country
            ? (results as string[]).map((r) => {
                const on = current.country === country[0] && current.region === r;
                return (
                  <li key={r}>
                    <button type="button" disabled={saving} onClick={() => save(country, r)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-cream">
                      <span className="min-w-0 flex-1 truncate">{r}</span>
                      {on && <Check size={18} className="shrink-0 text-brand" />}
                    </button>
                  </li>
                );
              })
            : (results as Country[]).flatMap((c) => {
                // When searching, also offer matching states directly
                const states = s && !c[1].toLowerCase().includes(s) ? c[3].filter((r) => r.toLowerCase().includes(s)).slice(0, 5) : [];
                return [
                  ...states.map((r) => (
                    <li key={c[0] + r}>
                      <button type="button" disabled={saving} onClick={() => save(c, r)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-cream">
                        <span className="text-[20px] leading-none">{flag(c[0])}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {r}, <span className="text-muted">{c[1]}</span>
                        </span>
                      </button>
                    </li>
                  )),
                  ...(states.length && !c[1].toLowerCase().includes(s)
                    ? []
                    : [
                        <li key={c[0]}>
                          <button
                            type="button"
                            onClick={() => {
                              tapFeedback();
                              setCountry(c);
                              setQ("");
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-cream"
                          >
                            <span className="text-[20px] leading-none">{flag(c[0])}</span>
                            <span className="min-w-0 flex-1 truncate">{c[1]}</span>
                            {current.country === c[0] && <Check size={18} className="shrink-0 text-brand" />}
                          </button>
                        </li>,
                      ]),
                ];
              })}
          {results.length === 0 && <li className="px-4 py-6 text-center text-[14px] text-muted">No places match.</li>}
        </ul>
      )}
    </Sheet>
  );
}
