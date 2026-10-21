import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

export type { CountryCode };

/** Turns a number into the standard international form, e.g. "+2348012345678". Null if it isn't a real number. */
export function normalizePhone(input: string, country?: CountryCode): string | null {
  const p = parsePhoneNumberFromString(input.trim(), country);
  return p && p.isValid() ? p.number : null;
}

/** "+234 801 234 5678" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export function formatAsYouType(input: string, country: CountryCode) {
  return new AsYouType(country).input(input);
}

export function dialCode(country: CountryCode) {
  return "+" + getCountryCallingCode(country);
}

export function flagEmoji(country: string) {
  return country.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export type CountryOption = { code: CountryCode; name: string; dial: string; flag: string };

let cache: CountryOption[] | null = null;
export function countryOptions(): CountryOption[] {
  if (cache) return cache;
  const names = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  cache = getCountries()
    .map((code) => ({ code, name: names?.of(code) ?? code, dial: dialCode(code), flag: flagEmoji(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

const TIMEZONE_COUNTRY: Record<string, CountryCode> = {
  "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA",
  "Africa/Cairo": "EG", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ", "Africa/Abidjan": "CI",
  "Africa/Kigali": "RW", "Africa/Addis_Ababa": "ET", "Africa/Douala": "CM", "Africa/Dakar": "SN",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE",
  "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "America/Toronto": "CA",
  "America/Vancouver": "CA", "Asia/Dubai": "AE", "Asia/Kolkata": "IN", "Australia/Sydney": "AU",
};

/** Best guess of the person's country from their phone's settings. */
export function guessCountry(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz];
    if (tz?.startsWith("America/")) return "US";
    const valid = new Set<string>(getCountries());
    for (const lang of navigator.languages ?? [navigator.language]) {
      const region = lang.split("-")[1]?.toUpperCase();
      if (region && valid.has(region)) return region as CountryCode;
    }
  } catch {
    /* fall through */
  }
  return "US";
}

// When several countries share a code, this is the one people usually mean
const MAIN_FOR_CODE: Record<string, CountryCode> = {
  "1": "US", "7": "RU", "44": "GB", "47": "NO", "61": "AU", "212": "MA", "262": "RE", "290": "SH",
  "358": "FI", "590": "GP", "599": "CW",
};

/** Works out the country from a full number like "+44 7911 123456". */
export function countryFromInternational(raw: string): { country: CountryCode; national: string } | null {
  const compact = raw.replace(/[^\d+]/g, "");
  const parsed = parsePhoneNumberFromString(compact);
  const t = new AsYouType();
  t.input(compact);
  const code = parsed?.countryCallingCode ?? t.getCallingCode();
  if (!code) return null;
  const country =
    (parsed?.country as CountryCode | undefined) ?? MAIN_FOR_CODE[code] ?? getCountries().find((c) => getCountryCallingCode(c) === code);
  if (!country) return null;
  const national = parsed?.isValid() ? parsed.formatNational() : formatAsYouType(compact.slice(code.length + 1), country);
  return { country, national };
}
