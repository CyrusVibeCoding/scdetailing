begin;
do $test$
declare id uuid:=gen_random_uuid(); d jsonb:='{"name":"SC TEST rollback","phone":"202-555-0147","vehicle":"Fictional Civic","service":"Full detail","preferredTime":"TEST only","needs":"","consent":true,"schemaVersion":2}'; j jsonb;
begin
 if not public.sc_ai_save_request(id,d) then raise exception 'save failed'; end if;
 if not public.sc_ai_save_request(id,d) then raise exception 'duplicate failed'; end if;
 if public.sc_ai_save_request(id,d||'{"vehicle":"changed"}'::jsonb) then raise exception 'overwrite allowed'; end if;
 if (select count(*) from public.sc_ai_notifications where request_id=id)<>1 then raise exception 'queue not atomic'; end if;
 j:=public.sc_ai_claim_notification(id);
 if j is null then raise exception 'not claimed'; end if;
 if public.sc_ai_claim_notification(id) is not null then raise exception 'double claim'; end if;
 perform public.sc_ai_finish_notification(id,(j->>'attempt_id')::uuid,'pending',null,'telegram_429',300);
 if public.sc_ai_claim_notification(id) is not null then raise exception 'backoff ignored'; end if;
 update public.sc_ai_notifications set next_attempt_at=now() where request_id=id;
 j:=public.sc_ai_claim_notification(id);
 if (j->>'attempts')::integer<>2 then raise exception 'retry attempt lost'; end if;
 perform public.sc_ai_finish_notification(id,(j->>'attempt_id')::uuid,'sent',12345,null,60);
 if public.sc_ai_claim_notification(id) is not null then raise exception 'sent job reclaimed'; end if;
 update public.sc_ai_notifications set state='sending',started_at=now()-interval '3 minutes' where request_id=id;
 perform public.sc_ai_claim_notification(id);
 if (select state from public.sc_ai_notifications where request_id=id)<>'uncertain' then raise exception 'stale worker blindly retried'; end if;
 if has_table_privilege('anon','public.sc_ai_notifications','select') then raise exception 'anonymous read allowed'; end if;
 if has_function_privilege('anon','public.sc_ai_claim_notification(uuid)','execute') then raise exception 'anonymous claim allowed'; end if;
end $test$;
rollback;
