-- Run after booking-notifications.sql. No Telegram token is stored in SQL.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if not exists(select 1 from vault.secrets where name='sc_notify_worker_token') then
    perform vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text,'sc_notify_worker_token','Private SC Detailing notification worker authorization');
  end if;
end $$;
-- SECURITY DEFINER is limited to checking the internal worker token in Vault.
-- This RPC is executable only by service_role; browser roles cannot invoke it.
create function public.sc_ai_worker_authorized(p_token text) returns boolean
language sql security definer set search_path='' as $$
  select length(p_token)>60 and exists(select 1 from vault.decrypted_secrets where name='sc_notify_worker_token' and decrypted_secret=p_token);
$$;
revoke all on function public.sc_ai_worker_authorized(text) from public,anon,authenticated;
grant execute on function public.sc_ai_worker_authorized(text) to service_role;
select cron.schedule('sc-detailing-notifications','*/5 * * * *',$job$
  select net.http_post(
    url:='https://gwlgkojgaenkixstfjlp.supabase.co/functions/v1/sc-ai-chat',
    headers:=jsonb_build_object('Content-Type','application/json',
      'apikey','sb_publishable_DWbEozCv7UsCPqWb2_uKyQ_Ywl5wKcU',
      'Authorization','Bearer sb_publishable_DWbEozCv7UsCPqWb2_uKyQ_Ywl5wKcU',
      'x-sc-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='sc_notify_worker_token')),
    body:='{}'::jsonb,timeout_milliseconds:=55000
  );
$job$);
