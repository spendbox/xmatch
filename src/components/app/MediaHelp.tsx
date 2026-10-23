"use client";

import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Mic } from "lucide-react";
import { device, mediaState, requestMedia, type Device, type MediaKind } from "@/lib/mediaPermission";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

const STEPS: Record<Device, { title: string; steps: string[] }> = {
  iphone: {
    title: "On your iPhone (Safari)",
    steps: [
      "Tap aA on the left of the address bar.",
      "Tap Website Settings.",
      "Set Microphone and Camera to Allow.",
      "Come back here and tap Try again.",
    ],
  },
  "iphone-app": {
    title: "On your iPhone",
    steps: [
      "Open the Settings app.",
      "Tap Apps, then Safari (on older iPhones, just Safari).",
      "Tap Microphone, choose Allow. Do the same for Camera.",
      "Close Dashpad fully, open it again, and tap Try again.",
    ],
  },
  android: {
    title: "On your Android phone (Chrome)",
    steps: [
      "Tap the icon on the left of the address bar.",
      "Tap Permissions (or Site settings).",
      "Turn on Microphone and Camera.",
      "Come back here and tap Try again.",
    ],
  },
  "android-app": {
    title: "On your Android phone",
    steps: [
      "Press and hold the Dashpad icon on your home screen, then tap App info (ⓘ).",
      "Tap Permissions.",
      "Set Microphone and Camera to Allow.",
      "Come back here and tap Try again.",
    ],
  },
  computer: {
    title: "On your computer",
    steps: ["Click the icon on the left of the address bar.", "Set Microphone and Camera to Allow.", "Click Try again."],
  },
};

/** The sheet that helps people allow the microphone and camera. Opened with showMediaHelp(). */
export function MediaHelp({ demo }: { demo?: { kind: MediaKind; status: "idle" | "denied"; dev: Device } } = {}) {
  const [open, setOpen] = useState(!!demo);
  const [kind, setKind] = useState<MediaKind>(demo?.kind ?? "audio");
  const [status, setStatus] = useState<"idle" | "asking" | "granted" | "denied" | "unsupported">(demo?.status ?? "idle");
  const [dev, setDev] = useState<Device>(demo?.dev ?? "computer");

  useEffect(() => {
    const onHelp = (e: Event) => {
      const k = ((e as CustomEvent).detail?.kind ?? "audio") as MediaKind;
      setKind(k);
      setDev(device());
      setOpen(true);
      // If the browser already knows it's blocked, go straight to the steps
      mediaState(k).then((s) => setStatus(s === "denied" ? "denied" : s === "granted" ? "granted" : "idle"));
    };
    window.addEventListener("dp:media-help", onHelp);
    return () => window.removeEventListener("dp:media-help", onHelp);
  }, []);

  async function ask() {
    setStatus("asking");
    setStatus(await requestMedia(kind));
  }

  const what = kind === "video" ? "microphone and camera" : "microphone";
  const guide = STEPS[dev];

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={status === "granted" ? "You're all set" : `Let Dashpad use your ${what}`}
      subtitle={
        status === "granted"
          ? `Your ${what} ${kind === "video" ? "are" : "is"} on. Calls and voice notes will work.`
          : status === "denied"
            ? `Your phone is blocking the ${what} for Dashpad. Here's how to turn it on:`
            : `For calls and voice notes. Tap the button, then tap Allow when your phone asks.`
      }
      icon={kind === "video" ? <Camera size={22} strokeWidth={1.75} /> : <Mic size={22} strokeWidth={1.75} />}
      footer={
        status === "granted" ? (
          <Button size="lg" onClick={() => setOpen(false)}>
            Done
          </Button>
        ) : (
          <Button size="lg" onClick={ask} loading={status === "asking"} loadingText="Waiting for your phone…">
            {status === "denied" ? "Try again" : `Allow ${what}`}
          </Button>
        )
      }
    >
      {status === "granted" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-mint-soft p-4 text-mint">
          <CheckCircle2 size={22} />
          <p className="text-[15px] font-semibold">Allowed</p>
        </div>
      ) : status === "denied" ? (
        <div className="rounded-2xl border border-line bg-cream p-4">
          <p className="text-[14px] font-semibold">{guide.title}</p>
          <ol className="mt-3 space-y-2.5">
            {guide.steps.map((s, k) => (
              <li key={k} className="flex gap-3 text-[14px] leading-snug">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-bold text-white">{k + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          {dev === "android" && (
            <p className="mt-3 text-[12px] leading-relaxed text-muted">Still blocked? Your phone may be blocking Chrome itself: Settings → Apps → Chrome → Permissions.</p>
          )}
        </div>
      ) : status === "unsupported" ? (
        <p className="rounded-2xl bg-cream p-4 text-[14px] text-muted">We couldn&apos;t find a {what} on this device.</p>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-brand-soft/60 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
            {kind === "video" ? <Camera size={18} /> : <Mic size={18} />}
          </span>
          <p className="text-[14px] leading-snug text-ink-soft">Your phone will show a small pop-up. Choose <b>Allow</b>.</p>
        </div>
      )}
    </Sheet>
  );
}
