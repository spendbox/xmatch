"use client";

import type { Gender } from "@/lib/types";
import { Photo } from "@/components/ui/Photo";
import { KEY_REASONS } from "@/lib/keys";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowLeft, Ban, CalendarDays, Flag, Mail, MessageCircle, ShieldCheck, Trash2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { InterestIcon } from "@/components/ui/icons";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { adjustKeys, banMember, deleteMember, removeMemberPhoto, unbanMember } from "@/app/admin/(panel)/members/actions";
import { ago, sexOf } from "./MembersList";

export type MemberInfo = {
  profile: {
    id: string;
    display_name: string | null;
    gender: string | null;
    bio: string;
    interests: string[];
    photos: string[];
    open_to_masquerade: boolean;
    pref_intent: string;
    created_at: string;
    last_seen_at: string;
  };
  age: number | null;
  email: string | null;
  terms_accepted_at: string | null;
  banned_at: string | null;
  ban_reason: string | null;
  wallet: { balance: number; passes: number } | null;
  matches: number;
  masquerades: number;
  events: number;
  reports_against: { id: number; reason: string; created_at: string; reporter_id: string; reporter_name: string | null }[];
  reports_made: number;
  transactions: { id: number; amount: number; reason: string; ref: string | null; created_at: string }[];
  paid_naira: number;
  gifts_sent?: number;
  gifts_received?: number;
};

const REASONS = KEY_REASONS;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export function MemberDetail({ id, info }: { id: string; info: MemberInfo }) {
  const router = useRouter();
  const p = info.profile;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keys, setKeys] = useState("");
  const [note, setNote] = useState("");
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, done: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.error) return setMsg({ ok: false, text: res.error });
      setMsg({ ok: true, text: done });
      after?.();
      router.refresh();
    });

  const balance = info.wallet?.balance ?? 0;
  const name = p.display_name ?? "This member";

  return (
    <>
      <Link href="/admin/members" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> All members
      </Link>

      {/* Header */}
      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-line">
          {p.photos?.[0] && (
            <Photo src={p.photos[0]} id={p.id} gender={p.gender as Gender | null} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            {p.display_name ?? <span className="text-muted">No name yet</span>}
            {info.age ? <span className="font-normal text-muted">, {info.age}</span> : null}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
            {sexOf(p.gender) && <span>{sexOf(p.gender)}</span>}
            <span className="inline-flex items-center gap-1"><Mail size={14} /> {info.email}</span>
            <span className={clsx(ago(p.last_seen_at) === "online" && "font-semibold text-mint")}>
              {ago(p.last_seen_at) === "online" ? "Online now" : `Seen ${ago(p.last_seen_at)}`}
            </span>
          </p>
        </div>
        {info.banned_at ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-chili-soft px-3 py-1.5 text-[13px] font-bold text-chili">
            <Ban size={14} /> Banned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1.5 text-[13px] font-bold text-mint">
            <ShieldCheck size={14} /> Active
          </span>
        )}
      </section>

      {msg && (
        <p className={clsx("mt-3 rounded-2xl px-4 py-3 text-[14px] font-medium", msg.ok ? "bg-mint-soft text-mint" : "bg-chili-soft text-chili")}>{msg.text}</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-7">
          {/* Numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<KeyCoin size={18} />} value={balance.toLocaleString()} label="Keys" />
            <Stat icon={<MessageCircle size={18} className="text-brand" />} value={String(info.matches)} label="Matches" />
            <Stat icon={<MaskIcon className="w-5 text-ink" eyes="#ffffff" />} value={String(info.masquerades)} label="Masquerades" />
            <Stat icon={<CalendarDays size={18} className="text-brand" />} value={String(info.events)} label="Events" />
          </div>

          {/* Profile */}
          <Card title="Profile">
            {p.photos?.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {p.photos.map((url) => (
                  <button key={url} onClick={() => setPhoto(url)} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-line">
                    <Photo src={url} id={p.id} gender={p.gender as Gender | null} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-muted">No photos.</p>
            )}
            <p className="mt-4 text-[12px] font-semibold tracking-wide text-muted uppercase">Bio</p>
            <p className="mt-1 text-[15px] whitespace-pre-wrap text-ink-soft">{p.bio || <span className="text-muted">No bio.</span>}</p>
            {p.interests?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.interests.map((t) => (
                  <span key={t} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-[13px] font-medium">
                    <InterestIcon name={t} size={14} /> {t}
                  </span>
                ))}
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted">Joined</dt>
              <dd className="font-medium">{when(p.created_at)}</dd>
              <dt className="text-muted">Accepted terms</dt>
              <dd className="font-medium">{when(info.terms_accepted_at)}</dd>
              <dt className="text-muted">Open to Masquerade</dt>
              <dd className="font-medium">{p.open_to_masquerade ? "On" : "Off"}</dd>
              <dt className="text-muted">Spent on Keys</dt>
              <dd className="font-medium">₦{Number(info.paid_naira ?? 0).toLocaleString()}</dd>
              <dt className="text-muted">Gifts sent</dt>
              <dd className="font-medium">{info.gifts_sent ?? 0}</dd>
              <dt className="text-muted">Gifts received</dt>
              <dd className="font-medium">{info.gifts_received ?? 0}</dd>
              <dt className="text-muted">Reports they made</dt>
              <dd className="font-medium">{info.reports_made}</dd>
            </dl>
          </Card>

          {/* Reports */}
          <Card title={`Reports against them (${info.reports_against.length})`} icon={<Flag size={16} className="text-chili" />}>
            {info.reports_against.length === 0 ? (
              <p className="text-[14px] text-muted">No reports.</p>
            ) : (
              <ul className="divide-y divide-line">
                {info.reports_against.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <p className="text-[14px] font-medium">{r.reason || "No reason given"}</p>
                    <p className="text-[12px] text-muted">
                      By{" "}
                      <Link href={`/admin/members/${r.reporter_id}`} className="font-semibold text-brand">
                        {r.reporter_name ?? "a member"}
                      </Link>{" "}
                      · {when(r.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:col-span-5">
          {/* Keys */}
          <Card title="Keys" icon={<KeyCoin size={16} />}>
            <p className="text-[14px] text-muted">
              Balance: <span className="font-semibold text-ink">{balance.toLocaleString()}</span>
              {info.wallet?.passes ? ` · ${info.wallet.passes} saved masquerades` : ""}
            </p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label htmlFor="keys">Add or take away</Label>
                <Input
                  id="keys"
                  inputMode="numeric"
                  value={keys}
                  onChange={(e) => setKeys(e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, ""))}
                  placeholder="e.g. 20 or -10"
                />
              </div>
              <div className="flex items-end gap-1.5">
                {[10, 50].map((n) => (
                  <button key={n} type="button" onClick={() => setKeys(String(n))} className="h-12 rounded-xl border border-line-strong px-3 text-[13px] font-semibold hover:bg-cream">
                    +{n}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              <Label htmlFor="note">Note (shows in their history)</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sorry about the failed payment" maxLength={120} />
            </div>
            <Button
              className="mt-3 w-full"
              loading={pending}
              loadingText="Saving…"
              disabled={!Number(keys)}
              onClick={() => {
                const n = Number(keys);
                run(() => adjustKeys(id, n, note), n > 0 ? `Added ${n} Keys.` : `Took away ${Math.min(-n, balance)} Keys.`, () => {
                  setKeys("");
                  setNote("");
                });
              }}
            >
              {Number(keys) < 0 ? "Take away Keys" : "Add Keys"}
            </Button>

            {info.transactions.length > 0 && (
              <>
                <p className="mt-5 text-[12px] font-semibold tracking-wide text-muted uppercase">Recent history</p>
                <ul className="mt-1 max-h-72 divide-y divide-line overflow-y-auto">
                  {info.transactions.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">
                          {REASONS[t.reason] ?? t.reason}
                          {t.reason === "admin" && t.ref && t.ref !== "admin" ? <span className="text-muted"> · {t.ref}</span> : null}
                        </p>
                        <p className="text-[11px] text-muted">{when(t.created_at)}</p>
                      </div>
                      <span className={clsx("shrink-0 text-[14px] font-bold tabular-nums", t.amount > 0 ? "text-mint" : "text-ink")}>
                        {t.amount > 0 ? "+" : ""}
                        {t.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Account actions */}
          <Card title="Account">
            {info.banned_at ? (
              <>
                <p className="text-[14px] text-muted">
                  Banned {when(info.banned_at)}
                  {info.ban_reason ? ` · “${info.ban_reason}”` : ""}. They can&apos;t log in.
                </p>
                <Button variant="secondary" className="mt-3 w-full" loading={pending} onClick={() => run(() => unbanMember(id), `${name} can log in again.`)}>
                  <UserCheck size={17} /> Unban
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="w-full text-chili!" onClick={() => setBanOpen(true)}>
                <Ban size={17} /> Ban from Dashpad
              </Button>
            )}
            <button
              onClick={() => setDeleteOpen(true)}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium text-muted transition hover:bg-chili-soft hover:text-chili"
            >
              <Trash2 size={16} /> Delete account
            </button>
          </Card>
        </div>
      </div>

      {/* Ban */}
      <Sheet
        open={banOpen}
        onClose={() => setBanOpen(false)}
        title={`Ban ${name}?`}
        subtitle="They're logged out, can't log back in, and are taken out of matching. You can unban them later."
        icon={<Ban size={22} className="text-chili" />}
        footer={
          <div className="space-y-2">
            <Button size="lg" variant="danger" loading={pending} loadingText="Banning…" onClick={() => run(() => banMember(id, banReason), `${name} is banned.`, () => setBanOpen(false))}>
              Ban
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setBanOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <Label htmlFor="reason">Reason (only admins see this)</Label>
        <Textarea id="reason" rows={3} value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="e.g. Harassment reported by several members" />
      </Sheet>

      {/* Delete */}
      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${name}'s account?`}
        subtitle="Their profile, photos, connections, messages and Keys are removed for good. This can't be undone."
        icon={<Trash2 size={22} className="text-chili" />}
        footer={
          <div className="space-y-2">
            <Button
              size="lg"
              variant="danger"
              loading={pending}
              loadingText="Deleting…"
              onClick={() =>
                start(async () => {
                  const res = await deleteMember(id);
                  if (res.error) return setMsg({ ok: false, text: res.error });
                  router.replace("/admin/members");
                })
              }
            >
              Delete for good
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setDeleteOpen(false)}>
              Keep account
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-muted">If they broke the rules and you want to stop them signing up again with this email, ban them instead.</p>
      </Sheet>

      {/* Photo */}
      <Sheet open={!!photo} onClose={() => setPhoto(null)} title="Photo" subtitle="Remove it if it breaks the rules. They'll keep their other photos.">
        {photo && (
          <>
            <Photo
              src={photo}
              small={false}
              className="mx-auto max-h-[55dvh] rounded-2xl object-contain"
              fallback={<p className="rounded-2xl bg-chili-soft p-4 text-center text-[14px] font-semibold text-chili">This photo won&apos;t load. The file may be missing from storage.</p>}
            />
            <Button
              size="lg"
              variant="danger"
              className="mt-4"
              loading={pending}
              loadingText="Removing…"
              onClick={() => run(() => removeMemberPhoto(id, photo), "Photo removed.", () => setPhoto(null))}
            >
              <X size={17} /> Remove this photo
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream">{icon}</span>
      <p className="mt-2 font-display text-[22px] leading-none font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] text-muted">{label}</p>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
