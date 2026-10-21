export function Chilis({ level, className }: { level: number; className?: string }) {
  if (level <= 0) return <span className={className}>🌿</span>;
  return <span className={className}>{"🌶️".repeat(level)}</span>;
}
