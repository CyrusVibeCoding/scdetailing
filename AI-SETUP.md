# SC Detailing AI chat

Connected November 7, 2026.

## Active configuration

- Project `gwlgkojgaenkixstfjlp` in the SCDetailing organization.
- Edge Function `sc-ai-chat` with JWT verification enabled.
- Gemini model `gemini-3.5-flash-lite`, configurable through the `GEMINI_MODEL` server secret. Temporary provider failures and timeouts fall back once to `gemini-3.1-flash-lite`. Each provider attempt has a 15-second timeout. Rate-limit errors are shown directly.
- Gemini credential stored as the Supabase `GEMINI_API_KEY` secret.
- `config.js` contains the public endpoint and public Supabase publishable key.
- Allowed website origins are `https://cyrusvibecoding.github.io`, `http://127.0.0.1:4180`, and `http://localhost:4180`.

## Website behavior

The popup starts as an AI service assistant. It remembers up to five question/answer pairs while the page stays open. Longer history is trimmed to fit the request limit. The hero input starts a real AI conversation. Service arrows open the separate booking request form with the selected service.

The assistant uses the existing Interior, Exterior, and Full detail descriptions. Pricing, exact inclusions, service area, hours, and calendar availability still need business input. The assistant asks visitors to have the team confirm those details.

The Request a detail flow collects name, vehicle, service, address, and contact information, then displays a review before saving. These fields go to `public.sc_ai_requests` in Supabase. This branch returns before any Gemini API call. Common email, phone, and street-address patterns are rejected in AI conversation. Visitors are also asked to keep personal details in the booking form.

## Reviewing requests

Open the project's Table Editor and select `sc_ai_requests`. Submitted requests include their UUID reference, details, and creation time. Staff must review requests and contact customers to confirm pricing and appointments. Automatic Telegram/email notifications and calendar booking require further setup.

One clearly labeled `SC TEST - verification only` request was retained from the browser verification. It has a fictional vehicle, a do-not-schedule address, and an `.invalid` email address.

## Quotas and storage

The database enforces 30 endpoint calls per IP per UTC hour and 300 total endpoint calls per UTC day, including booking submissions and retries. IP addresses are hashed with a server-side secret before usage tracking. Provider quotas can be lower. Rate-limit and temporary-provider errors appear in the popup with retry guidance. AI failures preserve the visitor's unsent input.

Both database tables have RLS enabled with access restricted to the server service role. The public browser role cannot read requests or invoke the budget RPC directly. Duplicate booking retries reuse the same UUID and retain one database record. Booking requests remain in Supabase until an administrator removes them.

## Recreating the backend

1. Run `supabase/ai-schema.sql` once in a new project's SQL Editor.
2. Add `GEMINI_API_KEY` in Edge Functions secrets.
3. Deploy `supabase/functions/sc-ai-chat/index.ts` as `sc-ai-chat` with JWT verification enabled.
4. Put the project's function endpoint and public publishable key in `config.js`.
5. Adjust the allowed origins in the function if the website domain changes.

The older `SETUP.md` describes the earlier Telegram bridge. This document describes the deployed AI backend.

## Verification

Live Gemini responses were verified through the API and through the website's hero/popup entry point. Conversation follow-up correctly deferred unknown prices and appointment guarantees. The separate form saved a test request, and SQL inspection confirmed persistence. Anonymous request-table reads were rejected, direct budget RPC permission was denied, invalid request fields returned 400, and an unrelated origin returned 403. Server-side filtering rejected a test email before Gemini invocation.
