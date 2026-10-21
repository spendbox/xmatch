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
- Gifts button is in place, marked "coming soon"

## Setting it up (one time)

### 1. Supabase (the database)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste everything from `supabase/migrations/0001_dashpad.sql`, click **Run**.
3. Go to **Authentication → Sign In / Providers → Email** and switch **off** "Confirm email". (So people can sign up without a code.)
4. Go to **Authentication → URL Configuration**: set Site URL to `https://dashpad.site`, and under Redirect URLs add `https://dashpad.site/**` (needed for password-reset emails).
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
4. In the project, go to **Settings → Domains**, add `dashpad.site`, and follow the DNS instructions shown there at your domain registrar.

## For developers

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

`/preview/<screen>` shows each screen with sample data during development (`masquerade`, `waiting`, `chat`, `decide`, `matched`, `ended`, `invite`, `matches`, `match-chat`, `profile`, `onboarding`). It is switched off on the live site.

Database rules live in `supabase/migrations/0001_dashpad.sql`. Matching, timers, unmask decisions and chat deletion all run inside the database, so nobody can cheat them from the browser.

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
