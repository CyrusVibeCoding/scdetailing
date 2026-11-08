-- Active project: gwlgkojgaenkixstfjlp. Additive migration; old requests are not alerted.
create table public.sc_ai_notifications (
  request_id uuid primary key references public.sc_ai_requests(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','uncertain')),
  attempts integer not null default 0,
  attempt_id uuid,
  next_attempt_at timestamptz not null default now(),
  started_at timestamptz,
  sent_at timestamptz,
  telegram_message_id bigint,
  last_error text
);
alter table public.sc_ai_notifications enable row level security;
revoke all on public.sc_ai_notifications from public,anon,authenticated;
grant all on public.sc_ai_notifications to service_role;
create index sc_ai_notifications_pending on public.sc_ai_notifications(next_attempt_at) where state='pending';

create function public.sc_ai_queue_request() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.details->>'schemaVersion' = '2' and new.details->'consent' = 'true'::jsonb then
    insert into public.sc_ai_notifications(request_id) values(new.id);
  end if;
  return new;
end $$;
revoke all on function public.sc_ai_queue_request() from public,anon,authenticated;
grant execute on function public.sc_ai_queue_request() to service_role;
create trigger sc_ai_request_notification after insert on public.sc_ai_requests
for each row execute function public.sc_ai_queue_request();

create function public.sc_ai_save_request(p_id uuid,p_details jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  insert into public.sc_ai_requests(id,details) values(p_id,p_details) on conflict(id) do nothing;
  return exists(select 1 from public.sc_ai_requests where id=p_id and details=p_details);
end $$;
revoke all on function public.sc_ai_save_request(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sc_ai_save_request(uuid,jsonb) to service_role;

create function public.sc_ai_claim_notification(p_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare claimed public.sc_ai_notifications;
begin
  -- A worker may have sent before dying. Do not blindly resend such an alert.
  update public.sc_ai_notifications set state='uncertain',last_error='worker_interrupted'
    where state='sending' and started_at < now()-interval '2 minutes';
  select * into claimed from public.sc_ai_notifications
    where state='pending' and next_attempt_at<=now() and (p_id is null or request_id=p_id)
    order by next_attempt_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.sc_ai_notifications set state='sending',attempts=attempts+1,
    attempt_id=gen_random_uuid(),started_at=now()
    where request_id=claimed.request_id returning * into claimed;
  return to_jsonb(claimed) || jsonb_build_object('details',
    (select details from public.sc_ai_requests where id=claimed.request_id));
end $$;
revoke all on function public.sc_ai_claim_notification(uuid) from public,anon,authenticated;
grant execute on function public.sc_ai_claim_notification(uuid) to service_role;

create function public.sc_ai_finish_notification(p_id uuid,p_attempt uuid,p_state text,p_message bigint default null,p_error text default null,p_delay integer default 60) returns void
language sql security invoker set search_path='' as $$
  update public.sc_ai_notifications set state=p_state,telegram_message_id=p_message,
    sent_at=case when p_state='sent' then now() else null end,
    next_attempt_at=now()+make_interval(secs=>greatest(30,least(p_delay,86400))),last_error=p_error
  where request_id=p_id and attempt_id=p_attempt and state='sending'
    and p_state in ('sent','pending','uncertain');
$$;
revoke all on function public.sc_ai_finish_notification(uuid,uuid,text,bigint,text,integer) from public,anon,authenticated;
grant execute on function public.sc_ai_finish_notification(uuid,uuid,text,bigint,text,integer) to service_role;
