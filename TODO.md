# Dashpad to-do

Planned work that isn't built yet. Newest ideas at the bottom of each list.

Last updated: October 2026.

## Next up

### Dashpad Voices (short public voice posts)
Prototype and screens are done. Building starts once the open choices below are confirmed.

Decided:
- [ ] Tapping the greeting corner (top left of Home) folds Home away and shows the Voices feed; tap it again to go back
- [ ] Home keeps Recent chats, Link-Up and People for you
- [ ] Floating mic button records a voice, up to 30 seconds
- [ ] Masked voices use a disguised voice; remove Echo from the voice styles (keep Deep, Light, Robot)
- [ ] Public voices can use your real voice (optional)
- [ ] A title is suggested from what you said; you can edit it
- [ ] Attach images to a voice
- [ ] Each voice lasts 24 hours; pay Keys to keep it longer
- [ ] People react, like and send gifts on a voice
- [ ] Feedback button stays visible on the feed
- [ ] Light mode only, like the rest of the app

To confirm (suggested defaults):
- [ ] Masked voices show a mask name; real-voice posts show your name and photo
- [ ] Reply opens a masked chat (free to start; admin can set a price)
- [ ] Feed shows people near you first
- [ ] Keep longer: 3 days for 10 Keys, 7 days for 20 Keys (admin can change)
- [ ] Gifts on a voice turn into Keys for the poster (uses the gift share setting)

Build:
- [ ] Database: voices, reactions, likes, gifts, expiry and cleanup (files deleted from R2 when a voice ends)
- [ ] Record, disguise, title, images and post
- [ ] Feed with play, reactions, likes, gifts and reply
- [ ] Keep longer with Keys
- [ ] Admin: prices, remove a voice, reports
- [ ] Notifications: reactions, gifts and replies on your voice

### On hold
- [ ] Test version of Dashpad to try updates before they go live (later)
- [ ] Posts (think about later)

### Move photos and event media to Cloudflare R2
Why: R2 doesn't charge for downloads. Photos and event music/video are the biggest download cost on Supabase.

Free each month: 10 GB storage, 1M uploads, 10M reads, and no download fees. After that, storage is $0.015/GB-month.

Owner setup (about 30 min):
- [x] Cloudflare → R2 → create a bucket (e.g. `dashpad-media`)
- [x] Connect a custom domain to it, e.g. `media.dashpad.site` (served and cached by Cloudflare)
- [x] Create an R2 API token and add the settings to Vercel: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `NEXT_PUBLIC_MEDIA_URL`
- [x] Allow uploads from dashpad.site in the bucket's CORS settings

Build (about 1 day):
- [x] Server route that gives the phone a one-time upload link to R2 (`/api/media/photo`, profile photos)
- [x] Phone makes two sizes before upload: full (1280px) and a small preview (400px)
- [ ] Use the small preview on lists, the event wall, chat headers and avatars
- [ ] Event music, video and covers upload to R2 instead of Supabase storage
- [x] Deleting a photo, deleting an account and admin "remove photo" also delete from R2
- [ ] One-off script to copy existing photos from Supabase and update profile links (or let old ones phase out)
- [ ] Later: private chat photos/videos/voice notes to a private R2 bucket with signed links

## Make Dashpad feel social, not just dating
Goal: a place to meet your people. Dating stays as one mood, not the headline.

- [x] 1. Friendlier words: "You clicked!" instead of "It's a match!", "connection" instead of "match", "your people", no first-date talk on the landing page
- [x] 2. Friendlier gifts: Fire, Respect, Jollof, Mic drop, Trophy added; Chocolate, Teddy bear and Bouquet retired (still show in old chats)
- [x] 3. Home leads with mood: "Who do you want to talk to?", Friends, Dating and Spicy side by side as equal moods, Friends the default for new people, gender and age optional under "Who you meet"
- [ ] 4. Topic masquerades: pick a topic (Football, Afrobeats, Career, Faith, Gaming, Late-night talk) and get paired with someone into it
- [ ] 5. Group masquerades (3–5 people) and game nights (Whot, Impostor)
- [x] In-chat games: Two Truths & a Lie, This or That, Connect 4, Word Hunt (masked chats and chats with your people)
- [ ] Later: Keys bets on games, paid This or That question packs
- [ ] 6. After unmasking: "Keep in touch" / "Add to your people" wording and flow
- [ ] 7. Profile as a "vibe card" (interests, current song, best Feed answers, smaller photos); less pink in celebrations; landing shows friends, events and the Feed
- [ ] 8. Positioning: "anonymous social app"; list under Social (not Dating) in app stores and search descriptions

## Before ~20,000–50,000 daily users
- [ ] Hourly pairing compares people one by one in the database. Fine for a few thousand per hour; past that, pair by city/mood in batches
- [ ] Switch live chat updates from database-change events to Realtime "broadcast" (much lighter at scale)
- [ ] Split masquerade matching by city or intent (it currently queues all matching through one lock)
- [ ] Add a database read replica for heavy reads (event walls, lists)
- [ ] Turn off Supabase's spending cap so more than 500 people can be connected at once

## Growth ideas (not decided)
- [ ] "Dashpad Plus" monthly subscription
- [ ] Sponsored and in-person events
