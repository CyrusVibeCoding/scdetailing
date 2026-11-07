const env=(key:string)=>Deno.env.get(key)||'';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':env('SITE_ORIGIN'),'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
async function db(path:string,method='GET',body?:unknown){const r=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{method,headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Database request failed');return r.status===204?null:r.json()}
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function notify(messageId:string){const [m]=await db('sc_messages?id=eq.'+messageId);if(m.telegram_message_id)return;const [chat]=await db('sc_chats?id=eq.'+m.chat_id);const d=chat.details;const text='SC Detailing request '+chat.id+'\n'+Object.entries(d).map(([k,v])=>k+': '+v).join('\n')+'\n\nCustomer: '+m.body+'\n\nUse Telegram Reply on THIS message to respond on the website.';const r=await fetch('https://api.telegram.org/bot'+env('TELEGRAM_BOT_TOKEN')+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env('TELEGRAM_CHAT_ID'),text,protect_content:true})});const out=await r.json();if(!out.ok)throw Error('Telegram delivery pending');await db('sc_messages?id=eq.'+m.id,'PATCH',{telegram_message_id:out.result.message_id})}
Deno.serve(async req=>{try{
const action=new URL(req.url).searchParams.get('telegram');
if(action==='1'){
if(req.method!=='POST'||!env('TELEGRAM_WEBHOOK_SECRET')||req.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env('TELEGRAM_WEBHOOK_SECRET'))return json({error:'Unauthorized'},401);
const u=await req.json(),m=u.message;
if(!m?.text||String(m.chat.id)!==env('TELEGRAM_CHAT_ID')||!env('TELEGRAM_ADMIN_IDS').split(',').includes(String(m.from?.id)))return json({ok:true});
if(!m.reply_to_message)return json({ok:true});
const [target]=await db('sc_messages?telegram_message_id=eq.'+Number(m.reply_to_message.message_id));
if(!target)return json({ok:true});
const existing=await db('sc_messages?telegram_update_id=eq.'+Number(u.update_id));if(existing.length)return json({ok:true});
await db('sc_messages','POST',{chat_id:target.chat_id,role:'staff',body:m.text.slice(0,4000),telegram_update_id:u.update_id});return json({ok:true});
}
if(req.headers.get('Origin')!==env('SITE_ORIGIN'))return json({error:'Origin not allowed'},403);
if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
if(req.method!=='POST')return json({error:'Method not allowed'},405);
if(Number(req.headers.get('content-length'))>10000)return json({error:'Request too large'},413);
if(!env('TELEGRAM_BOT_TOKEN')||!env('TELEGRAM_CHAT_ID'))return json({error:'Booking is not connected yet. Please try later.'},503);
const raw=await req.text();if(raw.length>10000)return json({error:'Request too large'},413);const b=JSON.parse(raw);
if(b.action==='create'){
const d=b.details;
if(!d||['name','vehicle','service','address','contact'].some(k=>typeof d[k]!=='string'||d[k].trim().length<2||d[k].length>300))return json({error:'Please complete all request details (2–300 characters each).'},400);
const details=Object.fromEntries(['name','vehicle','service','address','contact'].map(k=>[k,d[k].trim()]));
const token=crypto.randomUUID()+crypto.randomUUID(),ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
const id=await db('rpc/sc_create_chat','POST',{p_hash:await hash(token),p_ip:await hash(ip+env('IP_HASH_SECRET')),p_details:details});
const [m]=await db('sc_messages','POST',{chat_id:id,role:'visitor',body:'New detailing request'});
try{await notify(m.id)}catch{console.error('Notification pending for message',m.id)}
return json({id,token});
}
if(!/^[0-9a-f-]{36}$/.test(b.id)||typeof b.token!=='string')return json({error:'Invalid session'},401);
const [chat]=await db('sc_chats?id=eq.'+b.id);if(!chat||chat.token_hash!==await hash(b.token))return json({error:'Session expired. Please contact the team.'},401);
if(b.action==='list'){const pending=await db('sc_messages?chat_id=eq.'+b.id+'&role=eq.visitor&telegram_message_id=is.null&limit=1');if(pending.length){try{await notify(pending[0].id)}catch{console.error('Notification still pending')}}return json({messages:await db('sc_messages?chat_id=eq.'+b.id+'&select=id,role,body,created_at&order=created_at.asc&limit=500')})}
if(b.action==='send'){
if(typeof b.text!=='string'||!b.text.trim()||b.text.length>1000||!/^[0-9a-f-]{36}$/.test(b.clientId))return json({error:'Message must contain 1–1000 characters.'},400);
const id=await db('rpc/sc_send_message','POST',{p_chat:b.id,p_body:b.text.trim(),p_client:b.clientId});
try{await notify(id)}catch{return json({error:'Message saved; phone alert pending. Tap Send again to retry without duplicating your message.'},503)}
return json({ok:true});
}return json({error:'Unknown action'},400)
}catch(e){console.error('Chat request failed',e instanceof Error?e.message:'unknown');return json({error:'Request could not be completed. Please try again shortly.'},503)}});
