# SC Detailing setup

The active backend is `sc-ai-chat` in project `gwlgkojgaenkixstfjlp`. Keep JWT verification enabled. The old `detailing-chat`, `schema.sql`, project reference, polling chat, and Telegram reply-webhook instructions are historical and must not be deployed for this flow.

## Telegram

Created bot: `@scdetailing_requests_bot`. Created channel: **SC Detailing Requests**, verified Private. The bot is an administrator with Post Messages permission only. Saif will be invited by the owner later. Staff manually text customers; Telegram replies do not appear on the website.

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are Supabase Edge Function secrets. Never place their values in source, GitHub, command arguments, logs, or chat. The setup token was revoked and replaced before final integration. No inbound webhook is required. The optional `setup-telegram.ps1` helper securely prompts for a bot token and discovers channels from channel posts; it does not register a webhook or save credentials.

For a new backend, apply `ai-schema.sql`, then `booking-notifications.sql`, then `notification-schedule.sql`. Deploy both `index.ts` and `booking.ts` as `sc-ai-chat`, with JWT verification enabled. Keep the existing server-side Gemini secret and public `config.js` endpoint/key. The scheduling SQL is specific to the current project and public key; change both for another project. The Vault worker token is generated inside Postgres and never printed.

## Safe requests and notifications

The separate `request.html` form collects name, phone, vehicle, package, preferred time, optional cleaning needs, and affirmative consent. Review comes before submission. No street address is requested. Only an allowlist of form fields is saved; form details never enter Gemini history. The stored schema version is 2.

`sc_ai_save_request` saves the request and enqueues an alert in the same transaction. A repeated UUID with identical normalized details returns success, with one request and one outbox row. A changed payload returns 409 and cannot overwrite a request. New consented requests are queued; historical requests are not automatically sent to Telegram.

The server tries delivery immediately after saving. A protected worker runs every five minutes and handles up to five jobs. Explicit Telegram rejections (including rate limits) retry with backoff. Sent jobs retain the Telegram message ID and do not resend. Requests remain saved even if Telegram or the receipt update fails.

Telegram sendMessage has no idempotency parameter. A network timeout, ambiguous response, or worker interruption might have delivered a message. Such jobs become **uncertain**, rather than automatically resending and risking a duplicate. Staff must find the saved customer phone number in the channel and compare the vehicle, preferred time, and alert time first. A worker interrupted in `sending` becomes uncertain after two minutes when the worker next runs.

## Staff recovery

In the Supabase Table Editor inspect `sc_ai_notifications` and the associated private `sc_ai_requests` record. `pending` jobs retry automatically; fix missing secrets or bot permissions first. `sent` means a receipt was saved. For `uncertain`, search the private channel for the saved phone number and compare the vehicle, preferred time, and request creation time:

- If present, record its Telegram message ID, set state to `sent`, and set `sent_at`.
- If absent after checking, set state to `pending` and `next_attempt_at` to the current time. The worker retries within five minutes. Do not reset a job while a worker is actively sending it.

Never resend an uncertain job without checking Telegram. Monitor pending/uncertain requests and follow up from the saved request if needed. Requests and channel alerts remain until staff delete them; no retention deletion is scheduled. Customers see only save success, not a claim of Telegram delivery or an appointment confirmation.

## Verification

Run `node --test tests/booking.test.mjs` with Node 24 or a TypeScript-capable Node release. Run `npm ci` and `npm run build` if changing the Beam component. This is a static GitHub Pages site with an existing custom domain. Keep the CNAME and HTTPS settings.

November 8 compact alert update. Alerts contain a bold SC Detailing Request title followed by Name, Phone, Vehicle, Package, Preferred time, and Cleaning needs. Follow-up copy and extra footer text were removed at the owner’s request. Customer values are HTML-escaped.
