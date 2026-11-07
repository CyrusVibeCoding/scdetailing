-- Run once when setting up the SC Detailing AI backend in a new project.
create table public.sc_ai_usage (bucket text primary key, count integer not null default 0, expires_at timestamptz not null);
create table public.sc_ai_requests (id uuid primary key, details jsonb not null, created_at timestamptz not null default now());
alter table public.sc_ai_usage enable row level security;
alter table public.sc_ai_requests enable row level security;
revoke all on public.sc_ai_usage, public.sc_ai_requests from public, anon, authenticated;
grant all on public.sc_ai_usage, public.sc_ai_requests to service_role;

create function public.sc_ai_allow(p_ip text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare
  hourly text := p_ip || ':' || to_char(now() at time zone 'UTC','YYYY-MM-DD-HH');
  daily text := 'all:' || to_char(now() at time zone 'UTC','YYYY-MM-DD');
begin
  perform pg_advisory_xact_lock(8327341);
  delete from public.sc_ai_usage where expires_at < now();
  if coalesce((select count from public.sc_ai_usage where bucket=hourly),0)>=30
     or coalesce((select count from public.sc_ai_usage where bucket=daily),0)>=300 then
    return false;
  end if;
  insert into public.sc_ai_usage values
    (hourly,1,now()+interval '1 hour'),
    (daily,1,now()+interval '1 day')
    on conflict(bucket) do update set count=sc_ai_usage.count+1;
  return true;
end $$;
revoke all on function public.sc_ai_allow(text) from public,anon,authenticated;
grant execute on function public.sc_ai_allow(text) to service_role;
