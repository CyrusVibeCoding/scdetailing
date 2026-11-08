# SC Detailing AI chat

Connected November 7, 2026.

## Active configuration

- Project `gwlgkojgaenkixstfjlp` in the SCDetailing organization.
- Edge Function `sc-ai-chat` with JWT verification enabled.
- Gemini model `gemini-3.5-flash-lite`, configurable through the `GEMINI_MODEL` server secret. Temporary provider failures and timeouts fall back once to `gemini-3.1-flash-lite`. Each provider attempt has a 15-second timeout. Rate-limit errors are shown directly.
- Gemini credential stored as the Supabase `GEMINI_API_KEY` secret.
- `config.js` contains the public endpoint and public Supabase publishable key.
- Allowed website origins are `https://scdetailing.org`, `https://www.scdetailing.org`, `https://cyrusvibecoding.github.io`, `http://127.0.0.1:4180`, and `http://localhost:4180`.

## Website behavior

The popup starts as an AI service assistant. It remembers up to five question/answer pairs while the page stays open. Longer history is trimmed to fit the request limit. The hero input starts a real AI conversation. Service arrows open the separate booking request form with the selected service.

The assistant uses the existing Interior, Exterior, and Full detail descriptions. Confirmed prices and package inclusions are supplied below. Service area, hours, and calendar availability still need business input. The assistant asks visitors to have the team confirm those details.

The separate Have Saif contact me page collects name, phone, vehicle, package, preferred day/time, optional cleaning needs, and affirmative contact consent, then displays a review before saving. These fields go to `public.sc_ai_requests` in Supabase. This branch returns before any Gemini API call. Common email, phone, and street-address patterns are rejected in AI conversation. Visitors are also asked to keep personal details in the booking form.

## Reviewing requests

Open the project's Table Editor and select `sc_ai_requests`. Submitted requests include their UUID reference, details, and creation time. Staff review requests and manually text customers to check availability. Private Telegram notifications are now configured; calendar booking remains deferred.

One clearly labeled `SC TEST - verification only` request was retained from the browser verification. It has a fictional vehicle, a do-not-schedule address, and an `.invalid` email address.

## Quotas and storage

The database enforces 30 endpoint calls per IP per UTC hour and 300 total endpoint calls per UTC day, including booking submissions and retries. IP addresses are hashed with a server-side secret before usage tracking. Provider quotas can be lower. Rate-limit and temporary-provider errors appear in the popup with retry guidance. AI failures preserve the visitor's unsent input.

Both database tables have RLS enabled with access restricted to the server service role. The public browser role cannot read requests or invoke the budget RPC directly. Duplicate booking retries reuse the same UUID and retain one database record. Booking requests remain in Supabase until an administrator removes them.

## Recreating the backend

1. Apply `supabase/ai-schema.sql`, `supabase/booking-notifications.sql`, and `supabase/notification-schedule.sql` in order in a new project. Update the project-specific scheduler URL/public key.
2. Add `GEMINI_API_KEY` in Edge Functions secrets.
3. Deploy `supabase/functions/sc-ai-chat/index.ts` and its `booking.ts` dependency as `sc-ai-chat` with JWT verification enabled.
4. Put the project's function endpoint and public publishable key in `config.js`.
5. Adjust the allowed origins in the function if the website domain changes.

The older `SETUP.md` describes the earlier Telegram bridge. This document describes the deployed AI backend.

## Verification

Live Gemini responses were verified through the API and through the website's hero/popup entry point. Conversation follow-up correctly deferred unknown prices and appointment guarantees. The separate form saved a test request, and SQL inspection confirmed persistence. Anonymous request-table reads were rejected, direct budget RPC permission was denied, invalid request fields returned 400, and an unrelated origin returned 403. Server-side filtering rejected a test email before Gemini invocation.

## Custom domain update, November 7, 2026
Configured GitHub Pages custom domain scdetailing.org. IONOS apex A records point to 185.199.108.153, 185.199.109.153, 185.199.110.153, and 185.199.111.153. The www CNAME points to cyrusvibecoding.github.io. Replaced the IONOS default parking records. Public DNS and HTTPS delivery were verified. HTTPS certificate issued and Enforce HTTPS enabled. GitHub DNS validation passed.
Deployed sc-ai-chat version 3 with the custom HTTPS origins. Replies use simple English, usually 1-3 short sentences under 45 words, with at most one question. Availability always requires team confirmation, even if a future calendar looks free. Both custom-domain origins passed access tests, an unrelated origin returned 403, and a real Gemini response returned 200 and deferred appointment confirmation. JWT verification remains enabled. Calendar, prices, notifications, and automatic scheduling still require further setup or business input.

Confirmed prices November 7. Exterior $35, interior $40, interior plus exterior combo $60. Deployed sc-ai-chat v4 and updated website service headings. Live AI test returned all three correct prices and $15 combo savings. No additional fees or inclusions were assumed.


## November 7 booking and Telegram update

Active function now includes the separate consented booking flow, confirmed package inclusions, and the “Have Saif contact me” offer after service discussion. Exterior $35, Interior $40, Full combo $60. Full combo includes all of the stated interior/exterior services. The user explicitly deferred hydrophobic wax and rain-beading claims. No durability, exact products, extra fees, or guaranteed results were added.

Bot @scdetailing_requests_bot posts requests and a deterministic ready-to-copy follow-up text to the private SC Detailing Requests channel. Both Telegram values are stored in Supabase Edge Function secrets. No inbound Telegram webhook or website staff-reply bridge is used. Saif manually texts customers and checks availability; the owner will add Saif later.

Requests and alert jobs commit atomically, with idempotent UUID retries. The outbox has atomic claims, saved delivery receipts, automatic five-minute retries for explicit Telegram failures, and a manual-review state for ambiguous delivery. See SETUP.md for recovery. Three private tables have RLS and no browser policies/grants; internal RPCs are service-role only. The worker uses a private Vault token generated in SQL and keeps JWT verification enabled. Allowed localhost origins additionally include port 4181 for verification.

One fictional request, reference 9feff8af-d6db-4ef3-a68b-3e1e75550f34, verified browser review/submission, private persistence, and receipt in Telegram. Its phone uses the fictional 555 range and it is marked DO NOT CONTACT/SCHEDULE. Concurrent duplicate retries returned success without another alert. Validation/privacy checks are in VALIDATION.md.

Deployed booking backend version 8 with JWT verification enabled. Gemini primary/fallback remain gemini-3.5-flash-lite and gemini-3.1-flash-lite.

## November 8 publication and old-form recovery

+Published the consented booking website to scdetailing.org in commit e57db917494a4aa85ec46bf9cd0d1596a21798b8. GitHub Pages deployment 42489139309 completed successfully. Active backend is sc-ai-chat version 9, with JWT verification enabled. An old chat-form payload now returns an explicit refresh-and-open-the-new-form message. The owner’s screenshot showed the earlier mismatch between the new backend and the unpublished old frontend. Publishing the matching frontend resolved it.

+Verified the public service button opens request.html with the selected $60 combo. A fictional public-site request b9986117-df1e-4ff0-b510-0b938ea44132 saved and delivered as Telegram message 3, with one attempt and no delivery error. The live AI chat and Have Saif contact me button also worked. The owner will add Saif later and can test using their own account.

November 8 compact alert update. Telegram notifications now use only the requested title and six labeled fields, with bold labels. Removed the follow-up text, visible request UUID, consent line, and staff reminder. Consent and request UUID remain saved privately. For uncertain deliveries, compare the saved customer phone, vehicle, preferred time, and creation time with channel messages before retrying.
