import type { MenuBadges } from "./useMenuBadges";

/** What to show on a menu item: a count, "Live", or null for nothing. */
export function badgeFor(href: string, b?: MenuBadges): string | null {
  if (!b) return null;
  if (href === "/matches" && b.chats > 0) return b.chats > 9 ? "9+" : String(b.chats);
  if (href === "/meet" && b.eventLive) return "Live";
  if (href === "/feed" && b.feedGifts > 0) return b.feedGifts > 9 ? "9+" : String(b.feedGifts);
  if (href === "/feed" && b.feedNew) return "New";
  return null;
}
