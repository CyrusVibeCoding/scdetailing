# Finish connecting SC Detailing

## Current state
Redesigned static site and Supabase Telegram bridge are implemented locally.
No production files, databases, or Telegram conversations were changed.
The connected Supabase account cannot access project ywqpluaiepwetqrlskit.
GitHub CLI is logged in as cyrus-eslahi, which cannot push to CyrusVibeCoding/scdetailing.
Connect the appropriate accounts to let Codex finish deployment.

## Deployment with Supabase dashboard
1. Open https://supabase.com/dashboard/project/ywqpluaiepwetqrlskit
2. Run supabase/schema.sql once in SQL Editor. This creates new sc_ tables only.
3. In Edge Functions, create detailing-chat using supabase/functions/detailing-chat/index.ts.
4. Disable Verify JWT for this function. Website uses a random session secret; Telegram webhook uses its own secret header. Do not expose the service role key in frontend config.
5. Add Edge Function secrets:
   - SITE_ORIGIN = https://cyrusvibecoding.github.io (origin only, no path or trailing slash).
   - TELEGRAM_BOT_TOKEN = private token from verified @BotFather.
   - TELEGRAM_CHAT_ID = your private bot chat ID, or staff group ID.
   - TELEGRAM_ADMIN_IDS = comma-separated numeric staff Telegram user IDs, no spaces.
   - TELEGRAM_WEBHOOK_SECRET = random string, at least 32 letters/numbers; use same value in webhook registration.
   - IP_HASH_SECRET = a different random string, at least 32 characters.
   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase's function environment.
6. Start bot privately in Telegram. Run setup-telegram.ps1 with PowerShell to discover IDs and register webhook. It prompts for secrets without saving them.
   If using a staff group, first find your admin ID from a private message, then add bot to group and send a command addressed to it. Use group's chat ID and individual staff IDs.
7. In config.js set chatEndpoint to:
   https://ywqpluaiepwetqrlskit.supabase.co/functions/v1/detailing-chat
8. Commit site files to repository with write access. Keep its existing GitHub Pages configuration.

## Reply workflow
Customer submits intake -> request saved -> Telegram receives request.
Use Telegram's REPLY action on the specific bot alert. Your reply appears as a staff message on that customer's website, normally within six seconds while open.
Bot ignores messages from unapproved staff or chats, and ignores unthreaded replies.
Each website session has a random secret stored in that browser. Clearing browser storage loses access. Different browsers do not share chat history.
Customer must keep page open or return in same browser. No background customer notifications configured.

## Verification before accepting bookings
Submit a real test request from phone. Check Telegram alert, reply using Reply, confirm website receives it. Refresh website, verify history remains. Open second browser and ensure conversations remain isolated. Confirm unapproved Telegram users cannot reply.
Do not advertise booking as live until this test passes.
Notification failures retain saved messages. Pending alerts retry when customer chat polls; offline customers do not trigger retries. Monitor pending sc_messages with role visitor and null telegram_message_id in dashboard.
Schema has RLS enabled with no public table access. Browser only talks to Edge Function. Create limits: five chats per IP per hour; ten messages per session per minute.
Set retention policy for customer addresses and contact details before public launch; no automatic deletion is configured.

## Scope and cost
Intake uses guided questions, with human replies from Telegram. No paid AI API is included. Flexible AI answers can be added later.
Hosting and notifications depend on provider quotas and account terms.
Supabase GitHub connection alone does not deploy these static website files or configure Telegram secrets.

## Assets
Existing detailing photography retained. Sky photo: https://unsplash.com/photos/1534088568595-a066f410bcda (image source: https://images.unsplash.com/photo-1534088568595-a066f410bcda).
Fonts: Google Fonts DM Sans and Instrument Serif, with local system fallbacks.
