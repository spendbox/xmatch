import { getAuth, getMatches } from "@/lib/auth";
import { MatchesList } from "@/components/matches/MatchesList";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { title: "Chats" };

export default async function MatchesPage() {
  const { user } = await getAuth();
  const matches = await getMatches();
  return (
    <>
      <div className="lg:hidden">
        <MatchesList matches={matches} myId={user!.id} />
      </div>
      {/* On computers the list is already on the left */}
      <div className="hidden h-dvh flex-col items-center justify-center px-10 text-center lg:flex">
        <span className="grid h-24 w-24 animate-float place-items-center rounded-[28px] bg-brand text-white shadow-lift">
          <MaskIcon className="w-14" eyes="#5b3fd9" />
        </span>
        <h1 className="mt-6 font-display text-[32px] font-semibold">
          {matches.length ? "Pick a conversation" : "No chats yet"}
        </h1>
        <p className="mt-2 max-w-sm text-[15px] text-muted">
          {matches.length
            ? "Choose someone on the left to keep chatting, call or send a gift."
            : "Your chats show up here: people you unmask with in Masquerade, and people you message from Meet."}
        </p>
        {!matches.length && (
          <ButtonLink href="/home" variant="gold" className="mt-6 h-12 px-6">
            Start a Masquerade
          </ButtonLink>
        )}
      </div>
    </>
  );
}
