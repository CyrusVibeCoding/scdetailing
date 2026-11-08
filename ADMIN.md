# Private administration

`admin.html` extends the existing cream and midnight-blue brand with Instrument Serif headings and DM Sans interface text. Staff can sign in, create an account, complete email verification, and manage requests after their confirmed email is privately approved.

## Access and deployment

The owner allowlist entry is inserted privately and the owner's email is absent from public source. To add another administrator, privately run the following SQL with the approved email, then have that person create and verify their account.

```sql
insert into public.sc_admin_emails (email)
values (lower(trim('approved-staff@example.com')))
on conflict (email) do nothing;
```

`supabase/admin-schedule.sql` has been applied live as a one-time migration. It creates the allowlist and scheduling fields. RLS and grants restrict the allowlist to the service role. The `sc-admin` server validates the current user through `getUser`, requires a confirmed email, and checks the lowercased email against the allowlist before listing or changing requests.

The browser sends the session token in `x-sc-user-token`. Gateway `Authorization` carries the publishable key, and `sc-admin` uses `verify_jwt = true`. Service-role credentials remain server-side.

## Scheduling and addresses

The `sc-admin` edge function provides list and update actions. Updates include the current `version` for optimistic concurrency. Refresh a conflicting request before saving again. Both scheduled and completed requests require a date. Staff enter times in America/Chicago, with daylight-saving conversion covered by tests.

New requests save their address in `details.address`, `details.city`, and `details.state`. Older requests can lack an address and display “Address needed”. New requests are not automatically geocoded.

The map uses OpenStreetMap tiles. Clicking “Find address” explicitly sends the selected request's address to Nominatim. Staff check the returned pin, drag it if necessary, and save manually. Scheduling sends no automatic customer contact. Staff manually text the customer to confirm the appointment.

## Build and verification

```sh
npm ci
npm run build
node --test tests/admin.test.mjs tests/booking.test.mjs
```

At implementation verification, all 14 tests passed. Live deployments were `sc-ai-chat` v12 and `sc-admin` v2. Live checks denied unauthenticated and invalid-token access, and denied public direct table reads.

Browser verification used fictional fixture data and covered sign-in, request listing, saving, mapping, upcoming appointments, refresh, mobile layout, and logout. A real owner account signup and verified-owner session have not been exercised.
