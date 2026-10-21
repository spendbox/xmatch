/**
 * Turns a pasted list (or a .txt/.csv file) into questions with spice levels.
 * Lines can be plain (they use the chosen level), or say their level:
 *   "Naughty: What's your secret flirting weapon?"   "2, Morning kisses or goodnight kisses?"
 * A line with only a level name ("Spicy" or "Spicy:") switches the level for the lines after it.
 * Bullets, numbering and wrapping quotes are removed.
 */
const LEVELS: [RegExp, number][] = [
  [/^(a\s+)?little\s+spicy$/i, 1],
  [/^mild$/i, 0],
  [/^spicy$/i, 2],
  [/^(naughty|extra\s+spicy)$/i, 3],
  [/^[0-3]$/, -1],
];

function levelOf(word: string): number | null {
  const w = word.trim();
  for (const [re, n] of LEVELS) if (re.test(w)) return n === -1 ? Number(w) : n;
  return null;
}

export type ParsedQuestion = { spice: number; body: string };

export function parseIcebreakers(text: string, defaultLevel: number): ParsedQuestion[] {
  let current = defaultLevel;
  const out: ParsedQuestion[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    // A heading on its own: "Spicy" / "## Naughty:" / "[Mild]"
    const heading = line.replace(/^[#\[\s]+|[\]:\s]+$/g, "");
    const asHeading = levelOf(heading);
    if (asHeading !== null && heading.split(/\s+/).length <= 3) {
      current = asHeading;
      continue;
    }
    // "Level: question" or "Level, question" or "Level | question"
    let spice = current;
    const m =
      line.match(/^\[\s*((?:a\s+)?little\s+spicy|mild|spicy|naughty|extra\s+spicy|[0-3])\s*\]\s*[:,|\t-]?\s*(.+)$/i) ??
      line.match(/^((?:a\s+)?little\s+spicy|mild|spicy|naughty|extra\s+spicy|[0-3])\s*[:,|\t-]\s*(.+)$/i);
    if (m) {
      const lv = levelOf(m[1]);
      if (lv !== null) {
        spice = lv;
        line = m[2];
      }
    }
    line = line
      .replace(/^(\d+[.)]|[-*•–])\s+/, "")
      .replace(/^["“'‘](.*)["”'’]$/, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (line.length < 5 || line.length > 300) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ spice, body: line });
  }
  return out;
}
