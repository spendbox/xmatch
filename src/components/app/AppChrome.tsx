"use client";

import { registerWorker, refreshSubscription } from "@/lib/pushClient";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { InviteListener } from "./InviteListener";
import { Sidebar, type ChromeUser } from "./Sidebar";
import { useHeartbeat } from "./useHeartbeat";
import { MenuBadgesContext, useMenuBadges } from "./useMenuBadges";
import { CallProvider } from "@/components/calls/CallProvider";
import { EventMediaProvider } from "@/components/events/media/EventMediaProvider";

export function AppChrome({ user, children }: { user: ChromeUser; children: React.ReactNode }) {
  const path = usePathname();
  // Full-screen chats hide the phone tab bar
  const fullScreen = /^\/(masquerade|matches)\/[^/]+|^\/events\/[^/]+\/chat\/|^\/feed\/chat\//.test(path);
  useHeartbeat();
  const badges = useMenuBadges(user.id);
  // Background helper for notifications; keeps this phone's subscription fresh
  useEffect(() => {
    registerWorker().then(() => refreshSubscription());
  }, []);

  return (
    <CallProvider userId={user.id}>
      <EventMediaProvider userId={user.id}>
        <Sidebar user={user} badges={badges} />
        <MenuBadgesContext.Provider value={badges}>
        <div className={(fullScreen ? "" : "pb-24 ") + "lg:pb-0 lg:pl-[var(--sidebar-w)] lg:transition-[padding] lg:duration-300"}>{children}</div>
        </MenuBadgesContext.Provider>
        {!fullScreen && <BottomNav badges={badges} />}
        {!path.startsWith("/masquerade/") && <InviteListener userId={user.id} />}
      </EventMediaProvider>
    </CallProvider>
  );
}
