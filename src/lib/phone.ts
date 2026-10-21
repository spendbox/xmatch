/** Turns "+234 801-234 5678" into "+2348012345678". Returns null if it doesn't look like a phone number. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}
