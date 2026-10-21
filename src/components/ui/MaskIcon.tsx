type Props = { className?: string; eyes?: string };

/** Dashpad's masquerade mask mark. */
export function MaskIcon({ className, eyes = "currentColor" }: Props) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
      <path
        d="M2 12C2 6 6 3 11 3c7 0 13 4 21 4s14-4 21-4c5 0 9 3 9 9 0 13-8 24-18 24-7 0-8-7-12-7s-5 7-12 7C10 36 2 25 2 12z"
        fill="currentColor"
      />
      <ellipse cx="18" cy="17" rx="7" ry="4.6" fill={eyes} className="opacity-100" />
      <ellipse cx="46" cy="17" rx="7" ry="4.6" fill={eyes} />
    </svg>
  );
}
