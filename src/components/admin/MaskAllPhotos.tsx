"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, Pause, Play } from "lucide-react";
import { Button, Spinner } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { compress } from "@/lib/photos";
import { drawMasked, maskFor, maskName, starterMask, toCanvas } from "@/lib/maskedPhotos";

type Todo = { user: string; index: number; url: string; name: string | null };
type Done = { name: string | null; mask?: string; problem?: string; url?: string };

/**
 * Masks every member's photos that aren't masked yet, one by one, in this browser: finds the face,
 * picks a mask (a different one for each of their photos), saves the masked copy to their profile.
 * Photos with no face found are left for the member to deal with (they get asked when they open Dashpad).
 */
/** A request to the admin masking route; its error message if it fails */
async function post(body: unknown) {
  const res = await fetch("/api/admin/mask-photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) throw new Error("No connection");
  const out = (await res.json().catch(() => null)) as Record<string, string> | null;
  if (!res.ok) throw new Error(out?.error ?? `The server said ${res.status}`);
  return out ?? {};
}

export function MaskAllPhotos() {
  const supabase = useMemo(() => createClient(), []);
  const [todo, setTodo] = useState<Todo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<Done[]>([]);
  const stop = useRef(false);

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/mask-photos?list=1").catch(() => null);
    if (!res?.ok) return setError("Couldn't load the list. Refresh and try again.");
    setTodo(((await res.json()) as { todo: Todo[] }).todo);
  }
  useEffect(() => {
    load();
  }, []);

  async function run() {
    if (!todo?.length) return;
    stop.current = false;
    setRunning(true);
    // Masks already used per member, so each of their photos gets a different one
    const used = new Map<string, string[]>();
    const left = [...todo];
    while (left.length && !stop.current) {
      const t = left[0];
      try {
        // Straight from storage first (any size); through Dashpad if storage doesn't allow that
        let res = await fetch(t.url, { mode: "cors", cache: "no-store" }).catch(() => null);
        if (!res?.ok || !(res.headers.get("Content-Type") ?? "image/").startsWith("image/")) res = await fetch(`/api/admin/mask-photos?user=${t.user}&url=${encodeURIComponent(t.url)}`);
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Couldn't open it (${res.status})`);
        const canvas = await toCanvas(await res.blob());
        const mine = used.get(t.user) ?? [];
        const id = starterMask(mine);
        const mask = await maskFor(canvas, id);
        if (!mask) {
          setDone((d) => [{ name: t.name, problem: "No face found: they'll be asked about it" }, ...d]);
        } else {
          const full = await drawMasked(canvas, mask);
          const thumb = await compress(full, 400);
          // Upload straight to storage (big photos never pass through the server)
          const links = await post({ action: "links", user: t.user });
          if (links.kind === "r2") {
            const put = (to: string, b: Blob) => fetch(to, { method: "PUT", body: b, headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
            const res = await put(links.upload, full);
            if (!res.ok) throw new Error(`Storage refused the upload (${res.status})`);
            await put(links.uploadThumb, thumb).catch(() => null);
          } else {
            const store = supabase.storage.from("photos");
            const { error: upErr } = await store.uploadToSignedUrl(links.path, links.token, full, { contentType: "image/jpeg", cacheControl: "31536000" });
            if (upErr) throw new Error(`Storage refused the upload: ${upErr.message}`);
            if (links.thumbPath && links.thumbToken) await store.uploadToSignedUrl(links.thumbPath, links.thumbToken, thumb, { contentType: "image/jpeg", cacheControl: "31536000" }).catch(() => null);
          }
          const out = await post({ action: "attach", user: t.user, index: t.index, url: t.url, mask, masked: links.url });
          used.set(t.user, [...mine, id]);
          setDone((d) => [{ name: t.name, mask: id, url: out.skipped ? undefined : out.url, problem: out.skipped ? "They changed it meanwhile: left as it is" : undefined }, ...d]);
        }
      } catch (e) {
        setDone((d) => [{ name: t.name, problem: e instanceof Error ? e.message : "Something went wrong" }, ...d]);
      }
      left.shift();
      setTodo([...left]);
    }
    setRunning(false);
  }

  const masked = done.filter((d) => d.mask && !d.problem).length;
  const total = (todo?.length ?? 0) + done.length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-surface p-5 shadow-card">
        {todo === null && !error && <Spinner className="h-6 w-6" />}
        {error && <p className="text-[14px] text-chili">{error}</p>}
        {todo !== null && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
                <MaskIcon className="w-9" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[22px] font-bold">{todo.length ? `${todo.length} photos waiting` : done.length ? "All done" : "Every photo is masked"}</p>
                <p className="text-[14px] text-muted">
                  {done.length ? `${masked} masked this time` : "Members see a plain mask instead of these photos until they're masked."}
                  {running && " · keep this page open"}
                </p>
              </div>
              {todo.length > 0 &&
                (running ? (
                  <Button variant="ghost" onClick={() => (stop.current = true)}>
                    <Pause size={18} /> Pause
                  </Button>
                ) : (
                  <Button onClick={run}>
                    <Play size={18} /> {done.length ? "Carry on" : "Mask everyone's photos"}
                  </Button>
                ))}
            </div>
            {total > 0 && (
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(done.length / total) * 100}%` }} />
              </div>
            )}
            <p className="mt-3 text-[13px] text-muted">
              Each photo gets a different free mask. Members are told when they next open Dashpad, and can change any mask. Photos with no face found are left for them to check.
            </p>
          </>
        )}
      </section>

      {done.length > 0 && (
        <section className="rounded-3xl bg-surface p-5 shadow-card">
          <p className="mb-3 text-[15px] font-semibold">This time</p>
          <ul className="divide-y divide-line">
            {done.slice(0, 200).map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-[14px]">
                {d.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.url} alt="" className="h-12 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-12 w-10 shrink-0 rounded-lg bg-line" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.name ?? "A member"}</span>
                  <span className={"block truncate text-[13px] " + (d.problem ? "text-chili" : "text-muted")}>{d.problem ?? `Masked · ${maskName(d.mask!)}`}</span>
                </span>
                {!d.problem && <Check size={18} className="shrink-0 text-mint" />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
