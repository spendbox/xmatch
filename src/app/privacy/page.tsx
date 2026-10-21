import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy Policy" };

const UPDATED = "October 21, 2026";

const sections: LegalSection[] = [
  {
    id: "intro",
    title: "Who we are",
    body: (
      <p>
        This Privacy Policy explains how Dashpad (&quot;we&quot;, &quot;us&quot;) collects, uses and protects your information when you use
        dashpad.site and related services. It should be read with our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <>
        <p><strong>Information you give us</strong></p>
        <ul>
          <li><strong>Account:</strong> your email address and password (stored only in scrambled, hashed form).</li>
          <li><strong>Profile:</strong> first name, date of birth, gender, bio, interests and photos.</li>
          <li><strong>Preferences:</strong> what you&apos;re here for, who you&apos;d like to meet, age range, distance and question spice level.</li>
          <li><strong>Messages:</strong> what you send in masked chats and to your matches.</li>
          <li><strong>Reports:</strong> details you give when reporting someone.</li>
        </ul>
        <p><strong>Information collected when you use Dashpad</strong></p>
        <ul>
          <li><strong>Approximate location:</strong> only if you allow it, when you start a Masquerade. We round it to about 1 km before storing it.</li>
          <li><strong>Activity:</strong> when you were last online, your matches, and the outcome of your masked chats.</li>
          <li><strong>Technical data:</strong> basic device, browser and log information, and the cookies needed to keep you logged in.</li>
        </ul>
        <p>We don&apos;t use advertising cookies or sell your data to advertisers.</p>
      </>
    ),
  },
  {
    id: "visible",
    title: "What other members can see",
    body: (
      <>
        <p><strong>While you&apos;re masked:</strong> a random alias, your age, gender, interests, approximate distance and the spice level you picked.</p>
        <p><strong>After you both unmask:</strong> your first name, age, photos, bio and interests.</p>
        <p>Other members <strong>never</strong> see your email, date of birth or exact location.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use your information",
    body: (
      <ul>
        <li>to create and run your account;</li>
        <li>to match you with people based on intentions, preferences, shared interests and distance;</li>
        <li>to deliver messages, invites and notifications;</li>
        <li>to keep members safe — reviewing reports, preventing fraud and enforcing our Terms;</li>
        <li>to fix problems and improve Dashpad;</li>
        <li>to meet our legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "basis",
    title: "Legal reasons for using it",
    body: (
      <p>
        Where the law requires a legal basis, we rely on: performing our agreement with you (running the Service); your consent (for example
        location, which you can withdraw in your device settings); our legitimate interests in keeping Dashpad safe and working well; and
        complying with the law. Dashpad is a dating service, so some details — such as who you&apos;d like to meet — may reveal information
        about your sexual orientation. We use this only to provide matching, and you choose what to share.
      </p>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <ul>
          <li><strong>Other members</strong>, as described in section 3.</li>
          <li><strong>Service providers</strong> who host and run Dashpad for us, such as Supabase (database, file storage and login) and Vercel (website hosting), under contracts that protect your data.</li>
          <li><strong>Payment providers</strong>, if and when paid features launch.</li>
          <li><strong>Authorities</strong>, when required by law or to protect someone&apos;s safety.</li>
          <li><strong>A new owner</strong>, if Dashpad is ever sold or merged, under this same policy.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li><strong>Masked chats</strong> are deleted as soon as the Masquerade ends without a match.</li>
        <li><strong>Match conversations</strong> are kept until either of you unmatches or deletes your account.</li>
        <li><strong>Your account and profile</strong> are kept until you delete your account. Deleting your account removes your profile, photos and messages.</li>
        <li><strong>Reports and safety records</strong> may be kept longer where needed to keep people safe or meet legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <>
        <ul>
          <li>Edit your profile, photos and interests at any time from your Profile page.</li>
          <li>Turn &quot;Open to Masquerade&quot; on or off, and choose &quot;Anywhere&quot; to play without location.</li>
          <li>Delete your account from your Profile page.</li>
        </ul>
        <p>
          Depending on where you live, you may also have the right to access, correct, export or delete your data, or to object to or restrict
          how we use it. Email <a href="mailto:support@dashpad.site">support@dashpad.site</a> and we&apos;ll respond within the time the law
          requires. You can also complain to your local data protection authority.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use encryption in transit, hashed passwords and strict database access rules so members can only see what they&apos;re meant to see.
        No system is perfectly secure, so please use a strong password that you don&apos;t use anywhere else.
      </p>
    ),
  },
  {
    id: "age",
    title: "Adults only",
    body: <p>Dashpad is only for people aged 18 and over. If we learn that someone under 18 has an account, we delete it.</p>,
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our service providers may store and process data in countries other than yours. When that happens, we rely on appropriate safeguards
        to protect your information.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we make significant changes, we&apos;ll tell you in the app or by email before they take effect.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Privacy questions or requests: <a href="mailto:support@dashpad.site">support@dashpad.site</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      other={{ href: "/terms", label: "Terms of Service" }}
      summary={[
        "While masked, people only see an alias, age, gender, interests and a rough distance.",
        "Your email, birthday and exact location are never shown to other members.",
        "Masked chats are deleted unless you both unmask.",
        "Location is optional and rounded to about 1 km.",
        "We don't sell your data. You can delete your account any time.",
      ]}
      sections={sections}
    />
  );
}
