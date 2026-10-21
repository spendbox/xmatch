"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { InviteListener } from "./InviteListener";
import { Sidebar, type ChromeUser } from "./Sidebar";
import { useHeartbeat } from "./useHeartbeat";
import { useMenuBadges } from "./useMenuBadges";
import { CallProvider } from "@/components/calls/CallProvider";

export function AppChrome({ user, children }: { user: ChromeUser; children: React.ReactNode }) {
  const path = usePathname();
  // Full-screen chats hide the phone tab bar
  const fullScreen = /^\/(masquerade|matches)\/[^/]+/.test(path);
  useHeartbeat();
  const badges = useMenuBadges(user.id);

  return (
    <CallProvider userId={user.id}>
      <Sidebar user={user} badges={badges} />
      <div className={(fullScreen ? "" : "pb-24 ") + "lg:pb-0 lg:pl-[var(--sidebar-w)] lg:transition-[padding] lg:duration-300"}>{children}</div>
      {!fullScreen && <BottomNav badges={badges} />}
      {!path.startsWith("/masquerade/") && <InviteListener userId={user.id} />}
    </CallProvider>
  );
}
