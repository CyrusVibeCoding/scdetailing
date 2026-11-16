-- Address-bearing requests use schema version 3. Queue both supported versions.
create or replace function public.sc_ai_queue_request() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.details->>'schemaVersion' in ('2', '3') and new.details->'consent' = 'true'::jsonb then
    insert into public.sc_ai_notifications(request_id) values(new.id);
  end if;
  return new;
end $$;
