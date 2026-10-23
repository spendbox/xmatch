"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Film, Music, Trash2, Upload } from "lucide-react";
import { addEventMedia, deleteEventMedia, discardEventUpload, moveEventMedia, updateEventMedia, type AdminMedia } from "@/app/admin/(panel)/actions";
import { FormError } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Button";
import { fileTitle, formatDuration, readDuration, uploadEventFile } from "./eventUpload";

type Uploading = { key: string; name: string };

/** Songs and videos for an event. Changes save straight away. */
export function EventMediaList({ eventId, initial }: { eventId: string | null; initial: AdminMedia[] }) {
  const [items, setItems] = useState<AdminMedia[]>(initial);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (!eventId) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-cream/60 p-4 text-[14px] text-ink-soft">
        <Music size={18} className="shrink-0 text-brand" />
        Save the event first (a draft is fine) to add music and videos.
      </div>
    );
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length || !eventId) return;
    setError(null);
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setUploading((u) => [...u, { key, name: file.name }]);
      let uploaded: string | null = null;
      try {
        const kind: "audio" | "video" = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name) ? "video" : "audio";
        const duration = await readDuration(file, kind);
        const up = await uploadEventFile(eventId, file, "media");
        uploaded = up.url;
        const real = up.kind === "video" ? "video" : "audio";
        const res = await addEventMedia(eventId, { kind: real, title: fileTitle(file.name), url: up.url, duration_sec: duration });
        if (res.error || !res.media) throw new Error(res.error ?? "Couldn't add it.");
        setItems((list) => [...list, res.media!]);
      } catch (e) {
        if (uploaded) discardEventUpload(uploaded);
        setError(`${file.name}: ${e instanceof Error ? e.message : "Upload failed."}`);
      } finally {
        setUploading((u) => u.filter((x) => x.key !== key));
      }
    }
    if (input.current) input.current.value = "";
  }

  async function move(id: number, dir: "up" | "down") {
    setBusy(id);
    const res = await moveEventMedia(id, dir);
    setBusy(null);
    if (res.error) setError(res.error);
    else if (res.media) setItems(res.media);
  }

  async function remove(m: AdminMedia) {
    if (!confirm(`Remove "${m.title}"?`)) return;
    setBusy(m.id);
    const res = await deleteEventMedia(m.id);
    setBusy(null);
    if ("error" in res && res.error) setError(res.error);
    else setItems((list) => list.filter((x) => x.id !== m.id));
  }

  async function rename(m: AdminMedia, title: string) {
    const t = title.trim();
    if (!t || t === m.title) return;
    setItems((list) => list.map((x) => (x.id === m.id ? { ...x, title: t } : x)));
    const res = await updateEventMedia(m.id, { title: t });
    if ("error" in res && res.error) setError(res.error);
  }

  const total = items.reduce((s, m) => s + m.duration_sec, 0);

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {items.map((m, i) => (
            <li key={m.id} className={clsx("flex items-center gap-3 bg-surface p-3", busy === m.id && "opacity-60")}>
              <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", m.kind === "video" ? "bg-[#fde8f1] text-[#c2306b]" : "bg-brand-soft text-brand")}>
                {m.kind === "video" ? <Film size={18} /> : <Music size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={m.title}
                  maxLength={120}
                  aria-label="Title"
                  onBlur={(e) => rename(m, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="w-full truncate rounded-lg bg-transparent px-1 py-0.5 text-[15px] font-semibold outline-none focus:bg-cream focus:ring-2 focus:ring-brand/20"
                />
                <p className="px-1 text-[12px] text-muted">
                  {i + 1}. {m.kind === "video" ? "Video" : "Audio"} · {formatDuration(m.duration_sec)}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <IconBtn label="Move up" disabled={i === 0 || busy !== null} onClick={() => move(m.id, "up")}><ChevronUp size={17} /></IconBtn>
                <IconBtn label="Move down" disabled={i === items.length - 1 || busy !== null} onClick={() => move(m.id, "down")}><ChevronDown size={17} /></IconBtn>
                <IconBtn label="Remove" disabled={busy !== null} onClick={() => remove(m)} danger><Trash2 size={16} /></IconBtn>
              </div>
            </li>
          ))}
        </ol>
      )}

      {uploading.map((u) => (
        <div key={u.key} className="flex items-center gap-3 rounded-2xl bg-brand-soft/60 px-4 py-3 text-[14px] text-brand-ink">
          <Spinner className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">Uploading {u.name}…</span>
        </div>
      ))}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line-strong bg-cream/50 px-4 py-6 text-center transition hover:border-brand hover:bg-brand-soft/40">
        <Upload size={22} className="text-brand" />
        <span className="text-[15px] font-semibold">Add songs or videos</span>
        <span className="text-[12px] text-muted">MP3, M4A, WAV, MP4 or WebM · up to 50 MB each</span>
        <input
          ref={input}
          type="file"
          multiple
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>

      {items.length > 0 && (
        <p className="text-[12px] text-muted">
          Plays in this order from the start time · total {formatDuration(total)}. Changes here save straight away.
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-30",
        danger ? "text-chili hover:bg-chili-soft" : "text-ink-soft hover:bg-cream",
      )}
    >
      {children}
    </button>
  );
}
