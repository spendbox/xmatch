/** "1 Key", "2 Keys", "1 person", "3 people". */
export function plural(n: number, one: string, many?: string) {
  return `${n.toLocaleString()} ${n === 1 ? one : many ?? one + "s"}`;
}

/** Just the word, for when the number is shown separately. */
export function word(n: number, one: string, many?: string) {
  return n === 1 ? one : many ?? one + "s";
}
