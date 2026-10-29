# Dashpad

Dating by personality. **Masquerade**: chat masked for 5 minutes; unmask only if you both say yes. If you don't, the chat is deleted.

Live at **dashpad.site** · Built with Next.js (hosted on Vercel) and Supabase (accounts, database, photos, live chat).

## What's in it

- Sign up with **email + password** (no codes), agree to Terms & Privacy, confirm 18+
- Log in with email and password
- Forgot password (email link), delete account, unmatch
- Terms of Service (`/terms`) and Privacy Policy (`/privacy`)
- Profile setup: name, birthday (18+), gender, bio, interests, up to 6 photos
- **Masquerade**: choose what you're here for (Friends / Dating / Spicy link-up), who you'd like to meet, age range and icebreaker spice. The questions use the average of both people's spice picks.
- 5-minute masked chat with a live timer and icebreaker questions. You only see the other person's alias, age, gender and interests.
- When time is up, each person chooses **Unmask** or **Stay masked**. Both unmask → it's a match and the chat is kept. Otherwise → the chat is deleted.
- **Open to Masquerade** switch: if you're online, you get a pop-up when someone masked is looking for someone like you.
- Matches list and chat: replies (swipe or press and hold), photos & videos, voice notes, delete for everyone, voice & video calls
- Report & unmatch, leave any time
- **Masquerade Nights**: themed hours of 5-minute masked rounds, someone new each round, set up from the admin dashboard
- **Games in chats**: Two Truths & a Lie, This or That, Connect 4, Word Hunt, Whot, Checkers, Chess and Ayo. No move timers (a game ends if nobody moves for 5 minutes). Whot, Checkers, Chess and Ayo moves go through `/api/games/move`, which checks the rules in `src/lib/boardgames` (the same rules the app uses to show legal moves); Whot hands and the market stay hidden.
- **Explore** (the Meet tab): people whose Masquerade settings fit yours (and yours fit theirs) in a grid of circles, plus a search to find anyone by name. You see someone's main photo; their other photos unlock with Keys, or for free once you're connected. Messaging someone you're not connected to costs Keys and opens a chat. Both prices are set in admin → Prices.
- **Meets** (switched off for now, see `src/lib/features.ts`): a floating **+** button on Home (drag it anywhere) posts a game challenge or a line of text for 3 hours. Only people whose Masquerade settings fit yours, and yours fit theirs, see it (on Home and the **Meet** page, which also holds Events). Tapping Meet opens a masked chat; on game posts people wait their turn and play one at a time. Both unmask → it's a match. The first post is free, then 10 Keys (no refunds). Price, free posts and length are set in admin → Prices.
- **Keys** (in-app currency) bought with **Paystack**: gifts, +2 minutes in a masked chat, and extra masquerades after 5 free a day

## Setting it up (one time)

### 1. Supabase (the database)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste everything from `supabase/migrations/0001_dashpad.sql`, click **Run**.
3. Go to **Authentication → Sign In / Providers → Email** and switch **off** "Confirm email". (So people can sign up without a code.)
4. Go to **Authentication → URL Configuration** and set Site URL to `https://dashpad.site`.
5. Go to **Project Settings → API** and copy: Project URL, `anon` public key, `service_role` secret key.

### 2. Vercel (the website)
1. On [vercel.com](https://vercel.com) click **Add New → Project** and import this GitHub repo.
2. Under **Environment Variables** add:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret key (keep private; used for account deletion) |
   | `NEXT_PUBLIC_SITE_URL` | `https://dashpad.site` |
3. Click **Deploy**.
   The website's servers run in Dublin (`"regions": ["dub1"]` in `vercel.json`), next to the database in Supabase's Ireland region (eu-west-1). If the database ever moves, change this to match: every page's trips to the database stay a few milliseconds instead of crossing an ocean.
4. In the project, go to **Settings → Domains**, add `dashpad.site`, and follow the DNS instructions shown there at your domain registrar.

## For developers

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

`/preview/<screen>` shows each screen with sample data during development (`masquerade`, `waiting`, `chat`, `decide`, `matched`, `ended`, `invite`, `matches`, `match-chat`, `profile`, `onboarding`). It is switched off on the live site.

Database rules live in `supabase/migrations/0001_dashpad.sql`. Matching, timers, unmask decisions and chat deletion all run inside the database, so nobody can cheat them from the browser.

## Admin dashboard

Go to **dashpad.site/admin**. Log in with the email and password you set in Vercel:

| Name | Value |
|---|---|
| `ADMIN_EMAIL` | the admin login email |
| `ADMIN_PASSWORD` | a long, strong password |

To change them, edit the values in Vercel → Settings → Environment Variables and redeploy (everyone logged in to admin is logged out).

Admin has: an **Overview** (members, online now, masquerades, matches, revenue, gifts, reports), **Masquerade Nights** (create, edit, publish, cancel with automatic refunds, night-specific icebreakers, live preview) and **Icebreakers** (browse by spice level, search, edit, switch off, delete, and bulk-add by pasting one question per line).

**Link-Ups** (called Pacts in the code and database): questionnaire events at `dashpad.site/link/<link>` (admin → Link-Ups at `/admin/link-ups`). Old `/pact/`, `/twin/` and `/link-up/` links redirect there.

**Feedback**: people tap the help button (life ring) at the top of Home, or "Help and feedback" in the side menu on computers, to send feedback, report a problem, ask for help or share an idea. Messages show in admin → Feedback, where you mark them handled or delete them. Run `supabase/updates/45_feedback.sql` once in Supabase to switch it on.

## Photos on Cloudflare R2 (optional, saves download costs)

New profile photos go to R2 once these are set in Vercel (then redeploy). Until then, Supabase storage is used. Older photos keep working from Supabase.

| Name | Value |
|---|---|
| `R2_ACCOUNT_ID` | your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token's Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token's Secret Access Key (keep private) |
| `R2_BUCKET` | the bucket name, e.g. `dashpad-media` |
| `NEXT_PUBLIC_MEDIA_URL` | the bucket's address, e.g. `https://media.dashpad.site` |

Also run `supabase/updates/57_r2_photos.sql` (with your media address in it), and allow uploads from dashpad.site in the bucket's CORS settings.

## Bot protection (Cloudflare Turnstile)

1. In Cloudflare go to **Turnstile → Add widget**. Add the domain `dashpad.site`, choose **Managed**.
2. Copy the **Site Key** and **Secret Key** into Vercel, then redeploy:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | the Site Key |
   | `TURNSTILE_SECRET_KEY` | the Secret Key (keep private) |

It protects sign-up and the admin login. Most real people never see a challenge.

## Password reset emails (Resend)

Dashpad sends its own password reset emails through [Resend](https://resend.com) (not Supabase's email).

1. Sign up at resend.com → **Domains → Add domain** → `dashpad.site`, and add the DNS records it shows at your domain registrar. Wait until it says **Verified**.
2. **API Keys → Create API key** (Sending access).
3. Add to Vercel → Environment Variables, then redeploy:
   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the API key (keep private) |
   | `EMAIL_FROM` | `Dashpad <no-reply@dashpad.site>` |

Reset links last 1 hour, work once, and each account can request at most 3 per hour.

## Event reminder emails

Dashpad emails everyone going to an event the day before and on the day (each reminder goes out once). It uses Resend, so set that up first (above).

1. Add to Vercel → Environment Variables, then redeploy:
   | Name | Value |
   |---|---|
   | `CRON_SECRET` | any long random text (keep private). Vercel uses it to call the reminder job. |
2. That's it. `vercel.json` tells Vercel to run the job every morning at 8:00 UTC (9:00 in Lagos). You can see it under **Settings → Cron Jobs** in Vercel.

You can turn reminders off for one event in its settings. On an event's admin page, **Email attendees now** sends everyone going a message straight away (handy when you go live).

## Payments (Paystack)

1. Log in to [dashboard.paystack.com](https://dashboard.paystack.com) → **Settings → API Keys & Webhooks**.
2. Copy your **Secret Key** (use the *test* key first, then the *live* key when you launch).
3. Set **Webhook URL** to `https://dashpad.site/api/paystack/webhook` and save. (This makes sure Keys arrive even if someone closes the page after paying.)
4. Add to Vercel → Environment Variables, then redeploy:
   | Name | Value |
   |---|---|
   | `PAYSTACK_SECRET_KEY` | your Paystack secret key (keep private) |

Key packs and prices live in `src/lib/keys.ts` (50 for ₦750 · 150 for ₦2,000 · 500 for ₦4,500). Gift prices are in the database (`gifts` table).

## Calls (voice & video)

Calls connect the two phones directly. That works on most Wi-Fi, but many mobile networks need a **relay (TURN) server**. Dashpad uses **Cloudflare's** (first 1,000 GB a month free, then $0.05/GB):

1. In the Cloudflare dashboard go to **Realtime → TURN Server** and create a TURN key.
2. Copy the **Turn Token ID** and **API Token** it shows you.
3. Add them in Vercel → Settings → Environment Variables, then redeploy:
   | Name | Value |
   |---|---|
   | `CLOUDFLARE_TURN_KEY_ID` | the Turn Token ID |
   | `CLOUDFLARE_TURN_API_TOKEN` | the API Token (keep private) |

(Any other TURN provider works too: set `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` instead.)

## Before launch

- Create the mailbox **support@dashpad.site** — the Terms, Privacy Policy and app point people there.
- Have a lawyer review `/terms` and `/privacy` for your country, and fill in the operator's legal name and governing law (section 15 of the Terms).

## Push notifications

Members turn them on in **Profile → Notifications** (or from the prompt on Home). They get notified about new messages and gifts, calls, people saying hi at events, matches from events, and event announcements. Nobody is notified while they're actively using Dashpad.

Set these in Vercel → Settings → Environment Variables, then redeploy:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: a matching pair. Generate with `npx web-push generate-vapid-keys`. Keep the private one secret. Don't change them later, or everyone has to turn notifications on again.
- `VAPID_SUBJECT`: `mailto:` plus an email push services can contact, e.g. `mailto:support@dashpad.site`.

On iPhone, notifications only work after the member adds Dashpad to their home screen (Safari → Share → Add to Home Screen), on iOS 16.4 or later.
