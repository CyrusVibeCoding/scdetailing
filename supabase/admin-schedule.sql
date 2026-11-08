-- Private staff access and scheduling. Run once on an existing SC Detailing project.
begin;
create table public.sc_admin_emails (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now()
);
alter table public.sc_admin_emails enable row level security;
revoke all on public.sc_admin_emails from public, anon, authenticated;
grant all on public.sc_admin_emails to service_role;

alter table public.sc_ai_requests
  add column status text not null default 'new' check (status in ('new','scheduled','completed')),
  add column scheduled_at timestamptz,
  add column latitude double precision,
  add column longitude double precision,
  add column version integer not null default 0,
  add constraint sc_schedule_time check (status = 'new' or scheduled_at is not null),
  add constraint sc_map_coordinates check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  );
create index sc_requests_schedule on public.sc_ai_requests(scheduled_at) where status='scheduled';
-- Add approved administrator emails privately through the database administrator.
commit;
