/** Flat chess pieces drawn for Dashpad: cream for white, deep navy for black. */
export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";

const FILL = { w: "#f7f3ea", b: "#2b2547" };
const LINE = { w: "#1c1828", b: "#0e0b1c" };
const DETAIL = { w: "#1c1828", b: "#a9a3c8" };

export function ChessPiece({ type, color, className }: { type: PieceType; color: "w" | "b"; className?: string }) {
  const fill = FILL[color];
  const line = LINE[color];
  const detail = DETAIL[color];
  const common = { fill, stroke: line, strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" style={{ filter: "drop-shadow(0 1.5px 0 rgba(0,0,0,0.25))" }}>
      {/* Base */}
      <rect x="9.5" y="31" width="21" height="4.5" rx="1.6" {...common} />
      {type === "p" && (
        <>
          <path d="M15.5 30.5 17 20h6l1.5 10.5z" {...common} />
          <ellipse cx="20" cy="19.5" rx="5" ry="1.8" {...common} />
          <circle cx="20" cy="12.5" r="5.2" {...common} />
        </>
      )}
      {type === "r" && (
        <>
          <path d="M12.5 30.5 14 15h12l1.5 15.5z" {...common} />
          <path d="M11 7.5h4v3.2h3.2V7.5h3.6v3.2H25V7.5h4V15H11z" {...common} />
          <path d="M14.3 20h11.4" stroke={detail} strokeWidth="1.3" />
        </>
      )}
      {type === "b" && (
        <>
          <path d="M14 30.5 15.5 24h9l1.5 6.5z" {...common} />
          <path d="M20 7.5c4.6 3.8 7.2 7.6 7.2 11.2a7.2 7.2 0 0 1-14.4 0c0-3.6 2.6-7.4 7.2-11.2z" {...common} />
          <circle cx="20" cy="5.4" r="2" {...common} />
          <path d="M22.6 13.2 18.6 17.6" stroke={detail} strokeWidth="1.5" />
          <path d="M14.5 24h11" stroke={line} strokeWidth="1.6" />
        </>
      )}
      {type === "n" && (
        <>
          <path
            d="M13 30.5V26c0-3.6 2.4-6 4.8-7.8l-3.6.9c-1.9.5-3.7-.6-3.7-2.6 0-2.3 2.6-5.6 5.6-7.6l1-3.4 2.2 2.8c5.9.6 9.7 5.4 9.7 12.3v9.9z"
            {...common}
          />
          <circle cx="18.7" cy="12.4" r="1.2" fill={detail} />
          <path d="M23.5 12.5c1.6 2.2 2.4 5 2.2 8.8" stroke={detail} strokeWidth="1.3" fill="none" />
        </>
      )}
      {type === "q" && (
        <>
          <path d="M12 30.5 10 15l5 6 2-9 3 8 3-8 2 9 5-6-2 15.5z" {...common} />
          {[
            [10, 14],
            [17, 10.8],
            [23, 10.8],
            [30, 14],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="2" {...common} />
          ))}
          <path d="M12.6 26h14.8" stroke={detail} strokeWidth="1.3" />
        </>
      )}
      {type === "k" && (
        <>
          <path d="M13 30.5 14 19c2-2.2 4-3.2 6-3.2s4 1 6 3.2l1 11.5z" {...common} />
          <path d="M18.8 4.5h2.4v3h3v2.4h-3v5.4h-2.4V9.9h-3V7.5h3z" {...common} />
          <path d="M13.5 25.5h13" stroke={detail} strokeWidth="1.3" />
        </>
      )}
    </svg>
  );
}
