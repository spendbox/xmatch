"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Plus } from "lucide-react";
import { naira } from "@/lib/keys";
import { KeyCoin } from "@/components/keys/KeyIcon";
import { GiftArt } from "@/components/keys/GiftArt";
import { addPack, saveGift, savePack, saveSetting } from "@/app/admin/(panel)/prices/actions";
import { AdminTitle } from "./AdminShell";
import { FEATURES } from "@/lib/features";

export type AdminGift = { id: string; name: string; emoji: string; price: number; sort: number; retired: boolean };
export type AdminPack = { id: string; keys: number; naira: number; tag: string | null; sort: number; active: boolean };
type Settings = {
  reopen_cost: number;
  reveal_cost: number;
  free_reveals: number;
  invite_reward: number;
  meet_cost: number;
  meet_free_posts: number;
  meet_hours: number;
  explore_message_cost: number;
  explore_photos_cost: number;
  ghost_cost: number;
  setup_reward: number;
};
export type InviteStats = { joined: number; joined_7d: number; buyers: number; keys_paid: number; top: { name: string | null; joined: number; earned: number }[] };

const input = "h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[15px] outline-none focus:border-brand";

export function PricesManager({ settings, gifts, packs, invites = null }: { settings: Settings; gifts: AdminGift[]; packs: AdminPack[]; invites?: InviteStats | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const refresh = () => start(() => router.refresh());

  return (
    <>
      <AdminTitle title="Prices" subtitle="What things cost in Keys, and what Keys cost in naira. Changes apply right away." />

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Keys prices</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SettingField k="reopen_cost" label="Reopen a past pair" hint="Keys to reopen a chat the hour cut short" value={settings.reopen_cost} />
          <SettingField k="reveal_cost" label="Photo reveal at events" hint="Keys per reveal after the free ones (default for new events)" value={settings.reveal_cost} />
          <SettingField k="free_reveals" label="Free reveals per event" hint="Default for new events" value={settings.free_reveals} keysIcon={false} />
        </div>
        <p className="mt-3 text-[12px] text-muted">Existing events keep their own reveal prices. Change them on the event itself.</p>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Explore</h2>
        <p className="mt-1 text-[13px] text-muted">The Meet page. Both are free between people who are already connected.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SettingField k="explore_message_cost" label="Message someone" hint="Keys to start a chat with someone you're not connected to" value={settings.explore_message_cost} />
          <SettingField k="explore_photos_cost" label="Unlock photos" hint="Keys to unblur someone's photos and see the rest" value={settings.explore_photos_cost} />
          <SettingField k="ghost_cost" label="Ghost mode" hint="Keys for 30 days hidden from the Meet page" value={settings.ghost_cost} />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Getting set up</h2>
        <p className="mt-1 text-[13px] text-muted">
          The checklist on Home: add where you are, turn on notifications and add 10 things about you. Paid once per member. Set it to 0 to stop paying it.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SettingField k="setup_reward" label="Setup reward" hint="Keys for finishing the Home checklist" value={settings.setup_reward} />
        </div>
      </section>

      {FEATURES.meets && (
      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Meets</h2>
        <p className="mt-1 text-[13px] text-muted">Posts on Home and Meet. People who meet someone from a post always join free. Keys aren&apos;t refunded.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SettingField k="meet_cost" label="Post a meet" hint="Keys per post after the free ones" value={settings.meet_cost} />
          <SettingField k="meet_free_posts" label="Free posts per person" hint="Before they start paying" value={settings.meet_free_posts} keysIcon={false} />
          <SettingField k="meet_hours" label="How long a meet stays up" hint="In hours (1 to 48)" value={settings.meet_hours} keysIcon={false} />
        </div>
      </section>
      )}

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Invites</h2>
        <p className="mt-1 text-[13px] text-muted">Members earn Keys when a friend they invited makes their first purchase. Set it to 0 to pause rewards.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SettingField k="invite_reward" label="Invite reward" hint="Keys the inviter gets when their friend makes their first purchase" value={settings.invite_reward} />
          {invites && (
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-cream p-4 text-center lg:col-span-2">
              <div><p className="font-display text-[24px] font-semibold">{invites.joined}</p><p className="text-[12px] text-muted">joined by invite · {invites.joined_7d} this week</p></div>
              <div><p className="font-display text-[24px] font-semibold">{invites.buyers}</p><p className="text-[12px] text-muted">of them bought Keys</p></div>
              <div><p className="font-display text-[24px] font-semibold">{invites.keys_paid}</p><p className="text-[12px] text-muted">Keys paid as rewards</p></div>
              {invites.top.length > 0 && (
                <p className="col-span-3 mt-2 text-left text-[12px] text-muted">
                  Top inviters: {invites.top.map((t) => `${t.name ?? "Someone"} (${t.joined})`).join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold">Gifts</h2>
        <p className="mt-1 text-[13px] text-muted">Retired gifts can&apos;t be sent but still show in old chats.</p>
        <ul className="mt-4 divide-y divide-line">
          {gifts.map((g) => (
            <GiftRow key={g.id} g={g} onSaved={refresh} />
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Key packs</h2>
          <button
            onClick={async () => {
              await addPack();
              refresh();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-semibold"
          >
            <Plus size={15} /> Add pack
          </button>
        </div>
        <p className="mt-1 text-[13px] text-muted">What people pay on the Keys page. Only active packs are shown.</p>
        <ul className="mt-4 divide-y divide-line">
          {packs.map((p) => (
            <PackRow key={p.id} p={p} onSaved={refresh} />
          ))}
        </ul>
      </section>
    </>
  );
}

function Saved({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-mint">
      <Check size={14} /> Saved
    </span>
  ) : null;
}

function SettingField({ k, label, hint, value, keysIcon = true }: { k: keyof Settings; label: string; hint: string; value: number; keysIcon?: boolean }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <label className="block rounded-2xl bg-cream p-4">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold">{label}</span>
        <Saved on={saved} />
      </span>
      <span className="mt-0.5 block text-[12px] text-muted">{hint}</span>
      <span className="mt-3 flex items-center gap-2">
        {keysIcon && <KeyCoin size={20} />}
        <input type="number" min={0} value={v} onChange={(e) => { setV(Number(e.target.value)); setSaved(false); }} className={input} />
        <button
          type="button"
          disabled={busy || v === value}
          onClick={async () => {
            setBusy(true);
            const r = await saveSetting(k, v);
            setBusy(false);
            setSaved(!r.error);
          }}
          className="h-11 shrink-0 rounded-xl bg-brand px-4 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </span>
    </label>
  );
}

function GiftRow({ g, onSaved }: { g: AdminGift; onSaved: () => void }) {
  const [d, setD] = useState({ name: g.name, price: g.price, retired: g.retired });
  const [saved, setSaved] = useState(false);
  const dirty = d.name !== g.name || d.price !== g.price || d.retired !== g.retired;
  return (
    <li className={clsx("flex flex-wrap items-center gap-3 py-3", d.retired && "opacity-60")}>
      <GiftArt id={g.id} size={36} />
      <input value={d.name} onChange={(e) => { setD({ ...d, name: e.target.value }); setSaved(false); }} className={clsx(input, "w-40 flex-1")} aria-label="Gift name" />
      <span className="flex items-center gap-1.5">
        <KeyCoin size={18} />
        <input type="number" min={1} value={d.price} onChange={(e) => { setD({ ...d, price: Number(e.target.value) }); setSaved(false); }} className={clsx(input, "w-24")} aria-label="Price in Keys" />
      </span>
      <label className="flex items-center gap-2 text-[13px] font-medium">
        <input type="checkbox" checked={d.retired} onChange={(e) => { setD({ ...d, retired: e.target.checked }); setSaved(false); }} /> Retired
      </label>
      <button
        type="button"
        disabled={!dirty}
        onClick={async () => {
          const r = await saveGift(g.id, d);
          setSaved(!r.error);
          onSaved();
        }}
        className="h-10 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
      <Saved on={saved && !dirty} />
    </li>
  );
}

function PackRow({ p, onSaved }: { p: AdminPack; onSaved: () => void }) {
  const [d, setD] = useState({ keys: p.keys, naira: p.naira, tag: p.tag ?? "", active: p.active });
  const [saved, setSaved] = useState(false);
  const dirty = d.keys !== p.keys || d.naira !== p.naira || d.tag !== (p.tag ?? "") || d.active !== p.active;
  return (
    <li className={clsx("flex flex-wrap items-center gap-3 py-3", !d.active && "opacity-60")}>
      <span className="flex items-center gap-1.5">
        <KeyCoin size={20} />
        <input type="number" min={1} value={d.keys} onChange={(e) => { setD({ ...d, keys: Number(e.target.value) }); setSaved(false); }} className={clsx(input, "w-24")} aria-label="Keys" />
      </span>
      <span className="flex items-center gap-1.5 text-[14px] font-semibold">
        ₦
        <input type="number" min={50} value={d.naira} onChange={(e) => { setD({ ...d, naira: Number(e.target.value) }); setSaved(false); }} className={clsx(input, "w-28")} aria-label="Price in naira" />
      </span>
      <input value={d.tag} placeholder="Tag (e.g. Popular)" onChange={(e) => { setD({ ...d, tag: e.target.value }); setSaved(false); }} className={clsx(input, "w-40 flex-1")} aria-label="Tag" />
      <label className="flex items-center gap-2 text-[13px] font-medium">
        <input type="checkbox" checked={d.active} onChange={(e) => { setD({ ...d, active: e.target.checked }); setSaved(false); }} /> Active
      </label>
      <span className="text-[12px] text-muted">{d.keys > 0 ? `${naira(Math.round(d.naira / d.keys))}/Key` : ""}</span>
      <button
        type="button"
        disabled={!dirty}
        onClick={async () => {
          const r = await savePack(p.id, d);
          setSaved(!r.error);
          onSaved();
        }}
        className="h-10 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
      <Saved on={saved && !dirty} />
    </li>
  );
}
