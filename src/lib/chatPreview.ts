/**
 * One line about a chat's last message, for chat lists and pop-ups. A voice note, gift or call
 * has no text of its own, so it says what it was (it used to look like no message at all).
 */
export function chatPreview(kind: string | null | undefined, body: string | null | undefined, deleted?: boolean | null) {
  if (deleted) return "Message deleted";
  const text = (body ?? "").replace(/^💬 /, "").trim();
  switch (kind) {
    case "image":
      return text ? `📷 ${text}` : "📷 Photo";
    case "video":
      return text ? `🎬 ${text}` : "🎬 Video";
    case "audio":
      return "🎤 Voice note";
    case "call":
      return "📞 Call";
    case "gift":
      return "🎁 Gift";
    case "game":
      return `🎮 ${text || "Game"}`;
    case "masked":
      return "🎭 Your masked chat";
    default:
      // Before update 91 there's no kind: a message without text was still a message
      return text || "New message";
  }
}
