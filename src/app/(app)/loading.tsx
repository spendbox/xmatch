/** Shown instantly while a page loads, so taps never feel stuck. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-md animate-fade-in px-5 pt-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-44 animate-pulse rounded-xl bg-line" />
      <div className="mt-3 h-4 w-60 animate-pulse rounded-lg bg-line/70" />
      <div className="mt-6 h-40 animate-pulse rounded-[28px] bg-line/80" />
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-line/60" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <div className="mt-2.5 h-20 animate-pulse rounded-3xl bg-line/60" />
    </main>
  );
}
