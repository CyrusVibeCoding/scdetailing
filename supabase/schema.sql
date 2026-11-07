create table public.sc_chats (id uuid primary key default gen_random_uuid(), token_hash text not null, details jsonb not null, ip_hash text not null, created_at timestamptz not null default now());
create table public.sc_messages (id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.sc_chats(id) on delete cascade, role text not null check(role in ('visitor','staff')), body text not null check(length(body) between 1 and 4000), client_id uuid unique, telegram_update_id bigint unique, telegram_message_id bigint unique, created_at timestamptz not null default now());
create index on public.sc_messages(chat_id,created_at);
create index on public.sc_chats(ip_hash,created_at);
alter table public.sc_chats enable row level security;
alter table public.sc_messages enable row level security;
revoke all on public.sc_chats,public.sc_messages from anon,authenticated;
grant all on public.sc_chats,public.sc_messages to service_role;
create function public.sc_create_chat(p_hash text,p_ip text,p_details jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
perform pg_advisory_xact_lock(hashtext(p_ip));
if (select count(*) from public.sc_chats where ip_hash=p_ip and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many requests. Please try later.'; end if;
insert into public.sc_chats(token_hash,ip_hash,details) values(p_hash,p_ip,p_details) returning id into result;
return result;
end $$;
revoke all on function public.sc_create_chat(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.sc_create_chat(text,text,jsonb) to service_role;
create function public.sc_send_message(p_chat uuid,p_body text,p_client uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
perform pg_advisory_xact_lock(hashtext(p_chat::text));
select id into result from public.sc_messages where client_id=p_client and chat_id=p_chat;
if result is not null then return result; end if;
if (select count(*) from public.sc_messages where chat_id=p_chat and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait a minute before sending more messages.'; end if;
insert into public.sc_messages(chat_id,role,body,client_id) values(p_chat,'visitor',p_body,p_client) returning id into result;
return result;
end $$;
revoke all on function public.sc_send_message(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.sc_send_message(uuid,text,uuid) to service_role;