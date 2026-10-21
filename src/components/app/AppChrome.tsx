"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { InviteListener } from "./InviteListener";
import { Sidebar, type ChromeUser } from "./Sidebar";
import { useHeartbeat } from "./useHeartbeat";
import { CallProvider } from "@/components/calls/CallProvider";

export function AppChrome({ user, children }: { user: ChromeUser; children: React.ReactNode }) {
  const path = usePathname();
  // Full-screen chats hide the phone tab bar
  const fullScreen = /^\/(masquerade|matches)\/[^/]+/.test(path);
  useHeartbeat();

  return (
    <CallProvider userId={user.id}>
      <Sidebar user={user} />
      <div className={(fullScreen ? "" : "pb-24 ") + "lg:pb-0 lg:pl-[260px]"}>{children}</div>
      {!fullScreen && <BottomNav />}
      {!path.startsWith("/masquerade/") && <InviteListener userId={user.id} />}
    </CallProvider>
  );
}
