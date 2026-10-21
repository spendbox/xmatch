"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { InviteListener } from "./InviteListener";
import { useHeartbeat } from "./useHeartbeat";
import { CallProvider } from "@/components/calls/CallProvider";

export function AppChrome({ userId, children }: { userId: string; children: React.ReactNode }) {
  const path = usePathname();
  // Full-screen chats hide the tab bar
  const fullScreen = /^\/(masquerade|matches)\/[^/]+/.test(path);
  useHeartbeat();

  return (
    <CallProvider userId={userId}>
      <div className={fullScreen ? "" : "pb-24"}>{children}</div>
      {!fullScreen && <BottomNav />}
      {!path.startsWith("/masquerade/") && <InviteListener userId={userId} />}
    </CallProvider>
  );
}
