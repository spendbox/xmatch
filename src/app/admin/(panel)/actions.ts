"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { EVENT_KINDS, SETTING_DEFAULTS, type EventSettings } from "@/lib/events";
import { emailAttendees } from "@/lib/eventEmails";

export type Icebreaker = { id: number; spice: number; body: string; active: boolean; created_at: string };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------------- Icebreakers ----------------

export async function addIcebreakers(spice: number, text: string): Promise<{ added: Icebreaker[]; skipped: number; error?: string }> {
  await requireAdmin();
  if (![0, 1, 2, 3].includes(spice)) return { added: [], skipped: 0, error: "Pick a spice level." };
  const lines = [...new Set(text.split("\n").map(clean).filter((l) => l.length >= 5 && l.length <= 300))];
  if (!lines.length) return { added: [], skipped: 0, error: "Write at least one question (one per line)." };
  const db = createAdminClient();
  const { data: existing } = await db.from("icebreakers").select("body").is("event_id", null).in("body", lines);
  const taken = new Set((existing ?? []).map((r) => r.body.toLowerCase()));
  const fresh = lines.filter((l) => !taken.has(l.toLowerCase()));
  if (!fresh.length) return { added: [], skipped: lines.length };
  const { data, error } = await db
    .from("icebreakers")
    .insert(fresh.map((body) => ({ body, spice })))
    .select("id, spice, body, active, created_at");
  if (error) return { added: [], skipped: 0, error: "Couldn't save. Please try again." };
  revalidatePath("/admin/icebreakers");
  return { added: (data ?? []) as Icebreaker[], skipped: lines.length - fresh.length };
}

/** Adds a mixed list of questions (each with its own spice level). */
export async function addIcebreakersBulk(items: { spice: number; body: string }[]): Promise<{ added: Icebreaker[]; skipped: number; error?: string }> {
  await requireAdmin();
  const clean_ = items
    .map((i) => ({ spice: i.spice, body: clean(i.body) }))
    .filter((i) => [0, 1, 2, 3].includes(i.spice) && i.body.length >= 5 && i.body.length <= 300)
    .slice(0, 2000);
  if (!clean_.length) return { added: [], skipped: 0, error: "No questions found. Put one question per line." };
  const db = createAdminClient();
  const taken = new Set<string>();
  for (let i = 0; i < clean_.length; i += 200) {
    const { data } = await db.from("icebreakers").select("body").is("event_id", null).in("body", clean_.slice(i, i + 200).map((x) => x.body));
    (data ?? []).forEach((r) => taken.add((r.body as string).toLowerCase()));
  }
  const fresh = clean_.filter((x) => !taken.has(x.body.toLowerCase()));
  if (!fresh.length) return { added: [], skipped: clean_.length };
  const { data, error } = await db.from("icebreakers").insert(fresh).select("id, spice, body, active, created_at");
  if (error) return { added: [], skipped: 0, error: "Couldn't save. Please try again." };
  revalidatePath("/admin/icebreakers");
  return { added: (data ?? []) as Icebreaker[], skipped: clean_.length - fresh.length };
}

export async function updateIcebreaker(id: number, patch: { body?: string; spice?: number; active?: boolean }) {
  await requireAdmin();
  const row: Record<string, unknown> = {};
  if (patch.body !== undefined) {
    const b = clean(patch.body);
    if (b.length < 5 || b.length > 300) return { error: "Questions need 5–300 characters." };
    row.body = b;
  }
  if (patch.spice !== undefined) row.spice = patch.spice;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await createAdminClient().from("icebreakers").update(row).eq("id", id);
  if (error) return { error: "Couldn't save. Please try again." };
  return { ok: true };
}

export async function deleteIcebreaker(id: number) {
  await requireAdmin();
  const { error } = await createAdminClient().from("icebreakers").delete().eq("id", id);
  return error ? { error: "Couldn't delete." } : { ok: true };
}

/** Hide, show or delete many questions at once. */
export async function bulkIcebreakers(ids: number[], op: "hide" | "show" | "delete") {
  await requireAdmin();
  const clean = Array.from(new Set(ids.filter((n) => Number.isInteger(n)))).slice(0, 5000);
  if (!clean.length) return { error: "Nothing selected." };
  const db = createAdminClient();
  for (let i = 0; i < clean.length; i += 300) {
    const chunk = clean.slice(i, i + 300);
    const { error } =
      op === "delete"
        ? await db.from("icebreakers").delete().in("id", chunk)
        : await db.from("icebreakers").update({ active: op === "show" }).in("id", chunk);
    if (error) return { error: "Couldn't update all of them. Please try again.", done: i };
  }
  return { ok: true, count: clean.length };
}

// ---------------- Events ----------------

export type NightInput = {
  id?: string;
  kind: string;
  title: string;
  description: string;
  theme: string;
  intent: string;
  cover_url: string | null;
  stream_url: string | null;
  settings: EventSettings;
  starts_at: string; // ISO
  duration_min: number;
  age_min: number;
  age_max: number;
  entry_keys: number;
  max_attendees: number | null;
  status: "draft" | "published";
  questions: string;
};

const BUCKET = "event-media";

/** The path inside our bucket for a public URL, or null if it lives somewhere else. */
function bucketPath(url: string | null | undefined) {
  if (!url) return null;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length).split("?")[0]) : null;
}

const isHttp = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
};

const int = (v: unknown, d: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Only known settings, each within sensible limits. */
function cleanSettings(s: EventSettings): Required<EventSettings> {
  const d = SETTING_DEFAULTS;
  const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
  return {
    room_chat: bool(s.room_chat, d.room_chat),
    slow_mode: [0, 5, 10, 30, 60].includes(Number(s.slow_mode)) ? Number(s.slow_mode) : d.slow_mode,
    hype: bool(s.hype, d.hype),
    max_chats: int(s.max_chats, d.max_chats, 1, 100),
    free_reveals: int(s.free_reveals, d.free_reveals, 0, 1000),
    reveal_cost: int(s.reveal_cost, d.reveal_cost, 0, 100),
    media_under_chats: bool(s.media_under_chats, d.media_under_chats),
    show_video: bool(s.show_video, d.show_video),
    reminders: bool(s.reminders, d.reminders),
  };
}

export async function saveNight(input: NightInput): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  if (!EVENT_KINDS.some((k) => k.value === input.kind)) return { error: "Pick what kind of event this is." };
  const title = clean(input.title);
  if (title.length < 3) return { error: "Give the event a title." };
  const start = new Date(input.starts_at);
  if (Number.isNaN(start.getTime())) return { error: "Pick a date and start time." };
  const minutes = Math.min(Math.max(Math.round(input.duration_min) || 60, 15), 360);
  if (input.age_min < 18 || input.age_max < input.age_min) return { error: "Check the age range (18+)." };
  const stream = (input.stream_url ?? "").trim();
  if (stream && !isHttp(stream)) return { error: "The live stream or video link must start with https://" };
  const cover = (input.cover_url ?? "").trim();
  if (cover && !isHttp(cover)) return { error: "The cover image didn't upload properly. Please try again." };
  const row = {
    kind: input.kind,
    title,
    description: input.description.trim().slice(0, 600),
    theme: input.theme,
    intent: input.intent,
    cover_url: cover || null,
    stream_url: stream || null,
    settings: cleanSettings(input.settings ?? {}),
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    age_min: Math.round(input.age_min),
    age_max: Math.min(99, Math.round(input.age_max)),
    entry_keys: Math.max(0, Math.round(input.entry_keys) || 0),
    max_attendees: input.max_attendees && input.max_attendees > 0 ? Math.round(input.max_attendees) : null,
    status: input.status,
  };
  const db = createAdminClient();
  let id = input.id;
  if (id) {
    const { data: before } = await db.from("masquerade_events").select("cover_url").eq("id", id).maybeSingle();
    const { error } = await db.from("masquerade_events").update(row).eq("id", id);
    if (error) return { error: "Couldn't save the event." };
    // Old cover replaced or removed: tidy up the file
    const old = bucketPath(before?.cover_url as string | null);
    if (old && before?.cover_url !== row.cover_url) await db.storage.from(BUCKET).remove([old]);
  } else {
    const { data, error } = await db.from("masquerade_events").insert(row).select("id").single();
    if (error || !data) return { error: "Couldn't create the event." };
    id = data.id as string;
  }
  // The event's own questions (masquerade only): replace the list
  const qs =
    input.kind === "masquerade" ? [...new Set(input.questions.split("\n").map(clean).filter((l) => l.length >= 5 && l.length <= 300))] : [];
  await db.from("icebreakers").delete().eq("event_id", id);
  if (qs.length) await db.from("icebreakers").insert(qs.map((body) => ({ body, spice: 1, event_id: id })));
  revalidatePath("/admin/nights");
  revalidatePath("/events");
  return { id };
}

// ---------------- Event uploads & media ----------------

const UPLOAD_TYPES: Record<"image" | "audio" | "video", { types: string[]; maxMb: number }> = {
  image: { types: ["image/jpeg", "image/png", "image/webp"], maxMb: 10 },
  audio: { types: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg", "audio/webm"], maxMb: 50 },
  video: { types: ["video/mp4", "video/webm", "video/quicktime"], maxMb: 50 },
};
// Browsers name some types differently from what the bucket accepts
const TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-aac": "audio/aac",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
};
const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};

/**
 * Gives the browser a one-time link to upload a cover, song or video straight to storage
 * (server actions can't carry big files).
 */
export async function createEventUpload(
  eventId: string | null,
  fileName: string,
  contentType: string,
  size?: number,
  want?: "image" | "media",
): Promise<
  | { error: string }
  | { path: string; token: string; signedUrl: string; publicUrl: string; contentType: string; kind: "image" | "audio" | "video" }
> {
  await requireAdmin();
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  let type = (contentType || "").toLowerCase();
  type = TYPE_ALIASES[type] ?? type;
  if (!type || type === "application/octet-stream") type = EXT_TYPES[ext] ?? "";
  const kind = (Object.keys(UPLOAD_TYPES) as ("image" | "audio" | "video")[]).find((k) => UPLOAD_TYPES[k].types.includes(type));
  if (!kind) return { error: "That file type isn't supported. Use JPG, PNG or WebP for pictures, MP3, M4A or WAV for music, and MP4 or WebM for video." };
  if (want === "image" && kind !== "image") return { error: "Please choose a picture (JPG, PNG or WebP)." };
  if (want === "media" && kind === "image") return { error: "Please choose a music or video file." };
  const max = UPLOAD_TYPES[kind].maxMb;
  if (size && size > max * 1024 * 1024) return { error: `That file is too big. The limit is ${max} MB.` };
  if (eventId && !/^[0-9a-f-]{36}$/i.test(eventId)) return { error: "Unknown event." };

  const base = fileName.replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  const random = crypto.randomUUID().slice(0, 8);
  const path = `events/${eventId ?? "new"}/${random}-${base}${ext && EXT_TYPES[ext] ? `.${ext}` : ""}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload. Please try again." };
  const { data: pub } = storage.getPublicUrl(path);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl, publicUrl: pub.publicUrl, contentType: type, kind };
}

export type AdminMedia = { id: number; kind: "audio" | "video"; title: string; url: string; duration_sec: number; position: number };

export async function addEventMedia(
  eventId: string,
  m: { kind: "audio" | "video"; title: string; url: string; duration_sec: number },
): Promise<{ error?: string; media?: AdminMedia }> {
  await requireAdmin();
  if (m.kind !== "audio" && m.kind !== "video") return { error: "Unknown file type." };
  if (!isHttp(m.url)) return { error: "The file didn't upload properly. Please try again." };
  const db = createAdminClient();
  const { data: last } = await db.from("event_media").select("position").eq("event_id", eventId).order("position", { ascending: false }).limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;
  const { data, error } = await db
    .from("event_media")
    .insert({
      event_id: eventId,
      kind: m.kind,
      title: clean(m.title).slice(0, 120) || "Untitled",
      url: m.url,
      duration_sec: Math.max(0, Math.round(m.duration_sec) || 0),
      position,
    })
    .select("id, kind, title, url, duration_sec, position")
    .single();
  if (error || !data) return { error: "Couldn't add it. Please try again." };
  revalidatePath("/events");
  return { media: data as AdminMedia };
}

export async function updateEventMedia(id: number, patch: { title: string }) {
  await requireAdmin();
  const title = clean(patch.title).slice(0, 120);
  if (!title) return { error: "Give it a title." };
  const { error } = await createAdminClient().from("event_media").update({ title }).eq("id", id);
  return error ? { error: "Couldn't save the title." } : { ok: true };
}

/** Moves a song or video one place up or down, then renumbers the list. */
export async function moveEventMedia(id: number, direction: "up" | "down"): Promise<{ error?: string; media?: AdminMedia[] }> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: row } = await db.from("event_media").select("event_id").eq("id", id).maybeSingle();
  if (!row) return { error: "It's already gone." };
  const { data } = await db
    .from("event_media")
    .select("id, kind, title, url, duration_sec, position")
    .eq("event_id", row.event_id)
    .order("position")
    .order("id");
  const list = (data ?? []) as AdminMedia[];
  const i = list.findIndex((m) => m.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { media: list };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    if (list[k].position !== k) {
      list[k] = { ...list[k], position: k };
      await db.from("event_media").update({ position: k }).eq("id", list[k].id);
    }
  }
  revalidatePath("/events");
  return { media: list };
}

export async function deleteEventMedia(id: number) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: row } = await db.from("event_media").select("url").eq("id", id).maybeSingle();
  const { error } = await db.from("event_media").delete().eq("id", id);
  if (error) return { error: "Couldn't delete it." };
  const path = bucketPath(row?.url as string | undefined);
  if (path) await db.storage.from(BUCKET).remove([path]);
  revalidatePath("/events");
  return { ok: true };
}

/** Removes a file that was uploaded but never saved (e.g. a cover picked then removed). */
export async function discardEventUpload(url: string) {
  await requireAdmin();
  const path = bucketPath(url);
  if (!path) return { ok: true };
  const db = createAdminClient();
  const [{ count: used }, { count: inMedia }] = await Promise.all([
    db.from("masquerade_events").select("id", { count: "exact", head: true }).eq("cover_url", url),
    db.from("event_media").select("id", { count: "exact", head: true }).eq("url", url),
  ]);
  if (!used && !inMedia) await db.storage.from(BUCKET).remove([path]);
  return { ok: true };
}

// ---------------- Live room & emails ----------------

export type AdminRoomMessage = { id: number; user_id: string | null; kind: string; body: string; created_at: string; name: string };

export async function roomMessages(eventId: string): Promise<AdminRoomMessage[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("event_room_messages")
    .select("id, user_id, kind, body, created_at")
    .eq("event_id", eventId)
    .order("id", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as Omit<AdminRoomMessage, "name">[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await db.from("profiles").select("id, display_name").in("id", ids);
    (ps ?? []).forEach((p) => names.set(p.id as string, ((p.display_name as string) ?? "Someone").split(" ")[0]));
  }
  return rows.map((r) => ({ ...r, name: r.user_id ? (names.get(r.user_id) ?? "Someone") : "Dashpad" })).reverse();
}

/** Posts an announcement or a hype moment from Dashpad into the event room. */
export async function postToRoom(eventId: string, kind: "announce" | "moment", body: string) {
  await requireAdmin();
  if (kind !== "announce" && kind !== "moment") return { error: "Unknown message type." };
  const text = clean(body);
  if (!text) return { error: "Write something first." };
  if (text.length > 300) return { error: "Keep it under 300 characters." };
  const { error } = await createAdminClient().from("event_room_messages").insert({ event_id: eventId, user_id: null, kind, body: text });
  return error ? { error: "Couldn't post it. Please try again." } : { ok: true };
}

/** Emails everyone going to the event right now. */
export async function emailAttendeesNow(eventId: string, message: string): Promise<{ error?: string; sent?: number; failed?: number }> {
  await requireAdmin();
  if (!process.env.RESEND_API_KEY) return { error: "Email isn't set up yet (RESEND_API_KEY is missing in Vercel)." };
  const { data: e } = await createAdminClient()
    .from("masquerade_events")
    .select("id, title, kind, starts_at, ends_at, status")
    .eq("id", eventId)
    .maybeSingle();
  if (!e) return { error: "Event not found." };
  if (e.status === "cancelled") return { error: "This event is cancelled." };
  const text = clean(message || "") || "We're live — come in!";
  if (text.length > 500) return { error: "Keep the message under 500 characters." };
  try {
    const res = await emailAttendees(e as { id: string; title: string; kind: string; starts_at: string; ends_at: string }, {
      subject: `${e.title}: ${text.length > 60 ? text.slice(0, 57) + "…" : text}`,
      heading: e.title as string,
      message: text,
      button: "Come in",
    });
    return res;
  } catch {
    return { error: "Couldn't send the emails. Please try again." };
  }
}

export async function cancelNight(id: string) {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("admin_cancel_event", { p_event: id });
  revalidatePath("/admin/nights");
  revalidatePath("/events");
  return error ? { error: "Couldn't cancel." } : { refunded: (data as number) ?? 0 };
}

export async function deleteNight(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { count } = await db.from("event_attendees").select("user_id", { count: "exact", head: true }).eq("event_id", id);
  if (count) return { error: "People are going to this event. Cancel it instead (that refunds their Keys)." };
  const [{ data: ev }, { data: media }] = await Promise.all([
    db.from("masquerade_events").select("cover_url").eq("id", id).maybeSingle(),
    db.from("event_media").select("url").eq("event_id", id),
  ]);
  const { error } = await db.from("masquerade_events").delete().eq("id", id);
  if (!error) {
    const paths = [ev?.cover_url, ...(media ?? []).map((m) => m.url)].map((u) => bucketPath(u as string | null)).filter(Boolean) as string[];
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
  }
  revalidatePath("/admin/nights");
  return error ? { error: "Couldn't delete." } : { ok: true };
}
