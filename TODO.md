# Dashpad to-do

Planned work that isn't built yet. Newest ideas at the bottom of each list.

## Next up

### Move photos and event media to Cloudflare R2
Why: R2 doesn't charge for downloads. Photos and event music/video are the biggest download cost on Supabase.

Free each month: 10 GB storage, 1M uploads, 10M reads, and no download fees. After that, storage is $0.015/GB-month.

Owner setup (about 30 min):
- [ ] Cloudflare → R2 → create a bucket (e.g. `dashpad-media`)
- [ ] Connect a custom domain to it, e.g. `media.dashpad.site` (served and cached by Cloudflare)
- [ ] Create an R2 API token and add the settings to Vercel: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `NEXT_PUBLIC_MEDIA_URL`
- [ ] Allow uploads from dashpad.site in the bucket's CORS settings

Build (about 1 day):
- [ ] Server route that gives the phone a one-time upload link to R2 (same idea as event uploads now)
- [ ] Phone makes two sizes before upload: full (1280px) and a small preview (~320px)
- [ ] Use the small preview on lists, the event wall, chat headers and avatars
- [ ] Event music, video and covers upload to R2 instead of Supabase storage
- [ ] Deleting a photo, deleting an account and admin "remove photo" also delete from R2
- [ ] One-off script to copy existing photos from Supabase and update profile links (or let old ones phase out)
- [ ] Later: private chat photos/videos/voice notes to a private R2 bucket with signed links

## Before ~20,000–50,000 daily users
- [ ] Switch live chat updates from database-change events to Realtime "broadcast" (much lighter at scale)
- [ ] Split masquerade matching by city or intent (it currently queues all matching through one lock)
- [ ] Add a database read replica for heavy reads (event walls, lists)
- [ ] Turn off Supabase's spending cap so more than 500 people can be connected at once

## Growth ideas (not decided)
- [ ] "Dashpad Plus" monthly subscription
- [ ] Sponsored and in-person events
