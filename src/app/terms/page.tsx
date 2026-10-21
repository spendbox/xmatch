import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata = { title: "Terms of Service" };

const UPDATED = "October 21, 2026";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "About these terms",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) are an agreement between you and Dashpad (&quot;Dashpad&quot;, &quot;we&quot;, &quot;us&quot;)
          and cover your use of the Dashpad website at dashpad.site and any related apps and services (the &quot;Service&quot;).
        </p>
        <p>
          By creating an account or using the Service, you agree to these Terms, our <Link href="/privacy">Privacy Policy</Link> and the
          Community Guidelines in section 5. If you don&apos;t agree, please don&apos;t use Dashpad.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use Dashpad",
    body: (
      <>
        <p>To use Dashpad you must:</p>
        <ul>
          <li>be at least <strong>18 years old</strong>;</li>
          <li>be legally able to enter into this agreement;</li>
          <li>not have been convicted of, or be required to register for, any sexual or violent offence;</li>
          <li>not have been banned from Dashpad before; and</li>
          <li>have only one account.</li>
        </ul>
        <p>We may ask you to confirm your age or identity, and we will remove any account we believe belongs to someone under 18.</p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <>
        <p>
          You are responsible for keeping your password safe and for everything that happens on your account. Give us accurate information
          about yourself, including your age and gender, and keep it up to date. Tell us straight away at{" "}
          <a href="mailto:support@dashpad.site">support@dashpad.site</a> if you think someone else has accessed your account.
        </p>
        <p>Your account is personal to you. You may not sell, transfer or share it.</p>
      </>
    ),
  },
  {
    id: "masquerade",
    title: "How Masquerade works",
    body: (
      <>
        <p>
          Masquerade pairs you with another member for a timed, masked chat (currently five minutes). While masked, you see only an alias
          and limited details such as age, gender, interests, approximate distance and their chosen question spice level. Names, photos and
          bios stay hidden.
        </p>
        <ul>
          <li>When the timer ends, each person privately chooses to unmask or stay masked.</li>
          <li>If you <strong>both</strong> unmask, you become a match, your profiles are revealed to each other and the conversation is kept.</li>
          <li>If either of you stays masked, leaves, or doesn&apos;t choose in time, the masked chat is <strong>deleted from Dashpad</strong>.</li>
        </ul>
        <p>
          Deletion means we remove it from our systems. We can&apos;t stop the other person from copying or screenshotting what you share,
          so only share what you&apos;re comfortable with. We don&apos;t guarantee that you will be matched, how quickly, or with whom.
        </p>
        <p>
          If you turn on <strong>Open to Masquerade</strong>, we may show you a pop-up invite when someone who fits your preferences is
          looking for a chat while you&apos;re online. You can switch this off at any time.
        </p>
      </>
    ),
  },
  {
    id: "guidelines",
    title: "Community Guidelines",
    body: (
      <>
        <p>Dashpad only works if people feel safe. You agree not to:</p>
        <ul>
          <li>harass, threaten, bully, stalk, intimidate or abuse anyone;</li>
          <li>post or send hate speech or content that discriminates based on race, ethnicity, religion, disability, gender, sexual orientation or similar;</li>
          <li>send sexual content or nudity to anyone who hasn&apos;t clearly agreed to receive it, or post nudity or sexual content in your profile photos;</li>
          <li>share any content involving minors in a sexual context — we report this to the authorities;</li>
          <li>offer or ask for money, gifts, investments or financial help, or run any scam;</li>
          <li>advertise, sell, solicit or promote commercial services, including escort or sex work;</li>
          <li>pretend to be someone else, use another person&apos;s photos, or misrepresent your age or identity;</li>
          <li>share another person&apos;s private information, or images of them, without their permission;</li>
          <li>encourage violence, self-harm or illegal activity;</li>
          <li>use bots, scrapers or automation, or try to interfere with or break the Service&apos;s security.</li>
        </ul>
        <p>
          The &quot;Spicy&quot; options make flirtier conversation possible between consenting adults. They are never permission to ignore
          someone&apos;s boundaries. If someone says no, or leaves, respect it.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep ownership of the photos, text and messages you add (&quot;Your Content&quot;). You give Dashpad a worldwide, non-exclusive,
          royalty-free licence to host, store, display and process Your Content only as needed to run, improve and protect the Service. This
          licence ends when Your Content is deleted, except where we must keep it for legal or safety reasons.
        </p>
        <p>
          You confirm that you have the right to share Your Content and that it follows these Terms. We may remove any content, at our
          discretion, that we believe breaks these Terms.
        </p>
      </>
    ),
  },
  {
    id: "safety",
    title: "Safety and reporting",
    body: (
      <>
        <p>
          Dashpad does <strong>not</strong> run criminal background checks or verify the identity of every member. You are responsible for
          your interactions with other members, online and offline. When meeting someone:
        </p>
        <ul>
          <li>meet in a busy public place and tell a friend where you&apos;re going;</li>
          <li>arrange your own transport and stay in control of your drinks and belongings;</li>
          <li>never send money or financial details to someone you met on Dashpad.</li>
        </ul>
        <p>
          You can leave any chat at any time and report anyone from within the app. Reported members are no longer matched with you. We
          review reports and may warn, suspend or ban accounts, and cooperate with law enforcement where appropriate.
        </p>
      </>
    ),
  },
  {
    id: "location",
    title: "Location",
    body: (
      <p>
        If you allow it, Dashpad uses your device&apos;s location when you start a Masquerade to match you with people nearby. We store it
        rounded to roughly one kilometre and only ever show other members an approximate distance, never your exact location. You can choose
        &quot;Anywhere&quot; to play without sharing location.
      </p>
    ),
  },
  {
    id: "payments",
    title: "Paid features and gifts",
    body: (
      <>
        <p>
          Dashpad is free to use today. We may introduce paid features in future, such as sending virtual gifts. If we do, prices and what you
          get will be shown clearly before you pay, and any extra terms will be shown at that time.
        </p>
        <p>
          Virtual items have no cash value, can&apos;t be exchanged for money, and are not refundable except where the law requires. Payments will
          be processed by a third-party payment provider.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Ending your account",
    body: (
      <>
        <p>
          You can delete your account at any time from your Profile page. We may suspend or close your account, with or without notice, if we
          believe you have broken these Terms, put others at risk, or if we are required to by law.
        </p>
        <p>Sections 6 and 10–14 continue to apply after your account ends.</p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent the law allows, we make no promises about
        the Service being uninterrupted, error-free or secure, or about the conduct of any member, and we are not responsible for what members
        say or do. Nothing in these Terms limits rights you have under consumer law that can&apos;t be excluded.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the fullest extent the law allows, Dashpad and its team will not be liable for any indirect, incidental, special, consequential or
        punitive damages, or for loss of data, profits or goodwill, arising from your use of the Service or your interactions with other
        members. Our total liability for any claim will not exceed the greater of the amount you paid us in the 12 months before the claim or
        USD 100. Nothing here excludes liability that can&apos;t be excluded by law, such as for fraud or for death or personal injury caused by
        negligence.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Your responsibility to us",
    body: (
      <p>
        You agree to compensate Dashpad for any claims, losses or costs (including reasonable legal fees) arising from your breach of these
        Terms or your conduct towards other members, to the extent the law allows.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms as Dashpad grows. If a change is significant, we&apos;ll let you know in the app or by email before it takes
        effect. Continuing to use Dashpad after that means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: (
      <p>
        These Terms are governed by the laws of the country in which Dashpad&apos;s operator is established, without affecting any mandatory
        consumer protections where you live. Before starting any formal dispute, please contact us so we can try to resolve it informally.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these Terms? Email <a href="mailto:support@dashpad.site">support@dashpad.site</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={UPDATED}
      other={{ href: "/privacy", label: "Privacy Policy" }}
      summary={[
        "You must be 18 or older, and honest about who you are.",
        "Masked chats are deleted unless you both choose to unmask.",
        "Be respectful. Harassment, scams, unwanted sexual content and impersonation get you banned.",
        "You own your photos and messages. We only use them to run Dashpad.",
        "We don't do background checks. Stay safe when meeting people, and report anyone who makes you uncomfortable.",
      ]}
      sections={sections}
    />
  );
}
