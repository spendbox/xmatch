"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Bell, BellOff, BellRing, Share, SquarePlus, X } from "lucide-react";
import { Button, tapFeedback } from "@/components/ui/Button";
import { disablePush, enablePush, getPushState, isIOS, type PushState } from "@/lib/pushClient";

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);
  const turnOn = useCallback(async () => {
    setBusy(true);
    try {
      setState(await enablePush());
    } catch {
      setState(await getPushState().catch(() => "off" as PushState));
    } finally {
      setBusy(false);
    }
  }, []);
  const turnOff = useCallback(async () => {
    setBusy(true);
    try {
      setState(await disablePush());
    } finally {
      setBusy(false);
    }
  }, []);
  return { state, busy, turnOn, turnOff };
}

export const pushStateText: Record<PushState, string> = {
  on: "On for this device",
  off: "Off",
  blocked: "Blocked in your browser settings",
  "needs-install": "Add Dashpad to your home screen first",
  unsupported: "Not available in this browser",
};

/** Everything about notifications on this device: turn on/off, or how to get there. */
export function NotificationsPanel({ push }: { push: ReturnType<typeof usePushState> }) {
  const { state, busy, turnOn, turnOff } = push;
  if (!state) return <p className="text-[14px] text-muted">Checking…</p>;

  const what = (
    <ul className="space-y-1.5 text-[14px] text-ink-soft">
      <li>• Your new masked pair, every hour</li>
      <li>• New messages and gifts from your people</li>
      <li>• Incoming voice and video calls</li>
      <li>• Someone saying hi at an event, and new connections from events</li>
      <li>• Reminders and news for events you&apos;re going to</li>
    </ul>
  );

  if (state === "needs-install") {
    return (
      <div className="space-y-4">
        <p className="text-[14px] text-muted">
          Apple only lets apps on your home screen send notifications, so on iPhone Dashpad needs to be there first. It takes a few seconds, and Dashpad then opens
          full screen like any app:
        </p>
        <ol className="space-y-2.5">
          <Step n={1} icon={<Share size={16} />}>
            Tap the <b>Share</b> button in Safari
          </Step>
          <Step n={2} icon={<SquarePlus size={16} />}>
            Choose <b>Add to Home Screen</b>, then <b>Add</b>
          </Step>
          <Step n={3} icon={<Bell size={16} />}>
            Open Dashpad from your home screen, then tap <b>Turn on notifications</b>. That&apos;s it, one tap from then on
          </Step>
        </ol>
      </div>
    );
  }
  if (state === "blocked") {
    return (
      <div className="space-y-3">
        <p className="text-[14px] text-muted">
          Notifications are blocked for Dashpad in this browser. To allow them, open your browser&apos;s site settings for dashpad.site (the icon
          next to the address bar), set <b>Notifications</b> to <b>Allow</b>, then come back here.
        </p>
      </div>
    );
  }
  if (state === "unsupported") {
    return <p className="text-[14px] text-muted">This browser can&apos;t show notifications. Try Chrome, Edge, Firefox or Safari{isIOS() ? " (from your home screen)" : ""}.</p>;
  }
  return (
    <div className="space-y-4">
      <div className={clsx("flex items-center gap-3 rounded-2xl p-3.5", state === "on" ? "bg-mint-soft" : "bg-cream")}>
        <span className={clsx("grid h-10 w-10 place-items-center rounded-xl", state === "on" ? "bg-mint text-white" : "bg-surface text-ink-soft")}>
          {state === "on" ? <BellRing size={19} /> : <BellOff size={19} />}
        </span>
        <p className="text-[14px] font-semibold">{state === "on" ? "Notifications are on for this device" : "Notifications are off"}</p>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">You&apos;ll hear about</p>
        {what}
      </div>
      <p className="text-[12px] text-muted">We won&apos;t buzz you while you&apos;re using Dashpad. Turn them on separately on each phone or computer you use.</p>
      {state === "on" ? (
        <Button size="lg" variant="secondary" onClick={turnOff} loading={busy} loadingText="Turning off…">
          <BellOff size={18} /> Turn off on this device
        </Button>
      ) : (
        <Button size="lg" onClick={turnOn} loading={busy} loadingText="Turning on…">
          <BellRing size={18} /> Turn on notifications
        </Button>
      )}
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-cream p-3 text-[14px]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-white">{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className="text-ink-soft">{icon}</span>
    </li>
  );
}

/** A one-time nudge on Home to turn notifications on. */
export function NotificationsPrompt({ className }: { className?: string }) {
  const push = usePushState();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(!!localStorage.getItem("dp-push-prompt"));
    } catch {
      setDismissed(false);
    }
  }, []);
  const dismiss = () => {
    tapFeedback();
    setDismissed(true);
    try {
      localStorage.setItem("dp-push-prompt", "1");
    } catch {}
  };
  if (dismissed || !push.state || !(push.state === "off" || push.state === "needs-install")) return null;
  return (
    <div className={clsx("relative flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-card", className)}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-soft text-brand">
        <BellRing size={20} />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        <p className="text-[15px] font-semibold">Don&apos;t miss a message</p>
        <p className="text-[13px] leading-snug text-muted">
          {push.state === "needs-install" ? "Add Dashpad to your home screen to get notifications. See Profile → Notifications." : "Get a notification for new messages, calls and events."}
        </p>
        {push.state === "off" && (
          <button
            onClick={async () => {
              await push.turnOn();
              dismiss();
            }}
            disabled={push.busy}
            className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {push.busy ? "Turning on…" : "Turn on"}
          </button>
        )}
      </div>
      <button onClick={dismiss} className="absolute top-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Not now">
        <X size={16} />
      </button>
    </div>
  );
}
