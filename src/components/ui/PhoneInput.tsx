"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  countryFromInternational, countryOptions, dialCode, flagEmoji, formatAsYouType, guessCountry, normalizePhone, type CountryCode,
} from "@/lib/phone";
import { Sheet } from "./Sheet";
import { tapFeedback } from "./Button";

export type PhoneValue = { country: CountryCode; national: string; e164: string | null };

/**
 * Phone field with a country picker. Shows the flag and dial code,
 * formats the number as you type and tells you if it's valid.
 */
export function PhoneInput({
  value,
  onChange,
  id = "phone",
  name,
  autoFocus,
}: {
  value?: PhoneValue;
  onChange: (v: PhoneValue) => void;
  id?: string;
  /** If set, a hidden field with this name carries the full number for forms. */
  name?: string;
  autoFocus?: boolean;
}) {
  const [country, setCountry] = useState<CountryCode>(value?.country ?? "US");
  const [national, setNational] = useState(value?.national ?? "");
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);

  // Guess the country on the phone itself (not on the server)
  useEffect(() => {
    if (!value?.country) setCountry(guessCountry());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const e164 = national ? normalizePhone(national, country) : null;
  useEffect(() => {
    onChange({ country, national, e164 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, national]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    const all = countryOptions();
    if (!q) {
      // Your current country first, then everyone else A–Z
      const mine = all.find((c) => c.code === country);
      return mine ? [mine, ...all.filter((c) => c !== mine)] : all;
    }
    const rank = (c: (typeof all)[number]) =>
      c.name.toLowerCase().startsWith(q) || c.code.toLowerCase() === q ? 0 : c.dial.slice(1).startsWith(q) ? 1 : 2;
    return all
      .filter((c) => c.name.toLowerCase().includes(q) || c.dial.slice(1).startsWith(q) || c.code.toLowerCase() === q)
      .sort((a, b) => rank(a) - rank(b));
  }, [query, country]);

  function handleInput(raw: string) {
    // Someone pasted a full international number: switch country to match
    if (raw.trim().startsWith("+")) {
      const found = countryFromInternational(raw);
      if (found) {
        setCountry(found.country);
        setNational(found.national);
        return;
      }
    }
    setNational(formatAsYouType(raw, country));
  }

  const invalid = touched && national.replace(/\D/g, "").length > 3 && !e164;

  return (
    <>
      <div
        className={clsx(
          "flex h-14 items-center rounded-2xl border bg-surface transition focus-within:ring-4",
          invalid ? "border-chili focus-within:ring-chili/10" : "border-line-strong focus-within:border-brand focus-within:ring-brand/10",
        )}
      >
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setPicking(true);
          }}
          className="flex h-full shrink-0 items-center gap-1.5 rounded-l-2xl border-r border-line pr-2.5 pl-3.5 transition hover:bg-cream"
          aria-label={`Country code ${dialCode(country)}. Change country`}
        >
          <span className="text-[20px] leading-none">{flagEmoji(country)}</span>
          <span className="text-[15px] font-semibold tabular-nums">{dialCode(country)}</span>
          <ChevronDown size={16} className="text-muted" />
        </button>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={national}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Phone number"
          className="h-full min-w-0 flex-1 rounded-r-2xl bg-transparent px-3.5 text-[16px] tabular-nums outline-none placeholder:text-muted/70"
        />
        {e164 && (
          <span className="mr-3.5 grid h-6 w-6 shrink-0 animate-pop place-items-center rounded-full bg-mint text-white" aria-label="Valid number">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </div>
      {invalid && <p className="mt-1.5 text-[13px] text-chili">That number doesn&apos;t look right for {countryOptions().find((c) => c.code === country)?.name}.</p>}
      {name && <input type="hidden" name={name} value={e164 ?? ""} />}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose your country" subtitle="We'll add the right country code for you.">
        <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
          <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line-strong bg-cream px-4 focus-within:border-brand">
            <Search size={18} className="text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
          </label>
        </div>
        <ul className="-mx-2 max-h-[52dvh] overflow-y-auto pb-2">
          {list.map((c) => {
            const on = c.code === country;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setCountry(c.code);
                    setNational((n) => formatAsYouType(n.replace(/\D/g, ""), c.code));
                    setPicking(false);
                    setQuery("");
                  }}
                  className={clsx("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition", on ? "bg-brand-soft" : "hover:bg-cream")}
                >
                  <span className="text-[22px] leading-none">{c.flag}</span>
                  <span className={clsx("min-w-0 flex-1 truncate text-[15px]", on && "font-semibold text-brand-ink")}>{c.name}</span>
                  <span className="text-[14px] text-muted tabular-nums">{c.dial}</span>
                  {on && <Check size={18} className="text-brand" />}
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-muted">No country matches “{query}”.</li>}
        </ul>
      </Sheet>
    </>
  );
}
