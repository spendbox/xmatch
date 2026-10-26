"use client";

import { registerWorker, refreshSubscription } from "@/lib/pushClient";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Sidebar, type ChromeUser } from "./Sidebar";
import { useHeartbeat } from "./useHeartbeat";
import { MenuBadgesContext, useMenuBadges } from "./useMenuBadges";
import { CallProvider } from "@/components/calls/CallProvider";
import { EventMediaProvider } from "@/components/events/media/EventMediaProvider";
import { MediaHelp } from "./MediaHelp";
import { PlayProvider } from "@/components/play/PlayGame";
import { chime } from "@/lib/chime";
import { claimSavedPacts, takeAfterJoin } from "@/components/pacts/pactTokens";

export function AppChrome({ user, children }: { user: ChromeUser; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  // Full-screen chats hide the phone tab bar
  const fullScreen = /^\/play$|^\/masquerade\/[^/]+|^\/matches\/(?!people)[^/]+|^\/events\/[^/]+\/chat\/|^\/feed\/chat\//.test(path);
  useHeartbeat();
  const badges = useMenuBadges(user.id);
  // Background helper for notifications; keeps this phone's subscription fresh
  useEffect(() => {
    registerWorker().then(() => refreshSubscription());
    // Pacts answered before joining become part of this account; someone who joined to reveal their match goes straight back to it
    claimSavedPacts().then(() => {
      const back = takeAfterJoin();
      if (back) router.push(back);
    });
  }, [router]);
  // A notification arrived while Dashpad is open: chime
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "dp-push") chime();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return (
    <CallProvider userId={user.id}>
      <EventMediaProvider userId={user.id}>
        <Sidebar user={user} badges={badges} />
        <MenuBadgesContext.Provider value={badges}>
          <PlayProvider userId={user.id}>
            <div className={(fullScreen ? "" : "pb-24 ") + "lg:pb-0 lg:pl-[var(--sidebar-w)] lg:transition-[padding] lg:duration-300"}>{children}</div>
          </PlayProvider>
        </MenuBadgesContext.Provider>
        {!fullScreen && <BottomNav badges={badges} />}
        <MediaHelp />
      </EventMediaProvider>
    </CallProvider>
  );
}
