export const packages: Record<string, {price:number; label:string}> = {
  'Exterior detail': {price:35,label:'exterior detail'},
  'Interior detail': {price:40,label:'interior detail'},
  'Full detail': {price:60,label:'interior and exterior combo'}
};
export function bookingDetails(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  const limits: Record<string,number> = {name:80,phone:30,vehicle:120,service:40,preferredTime:160,needs:600};
  for (const [key,limit] of Object.entries(limits)) {
    if (typeof d[key] !== 'string' || d[key].length > limit || (key !== 'needs' && d[key].trim().length < 2)) return null;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(d[key] as string)) return null;
  }
  const phone = (d.phone as string).trim();
  const digits = phone.replace(/\D/g,'');
  if (!/^[+\d\s().-]+$/.test(phone) || digits.length < 10 || digits.length > 15 || d.consent !== true || !Object.hasOwn(packages,(d.service as string).trim())) return null;
  // Older open forms remain valid; new forms include a street address.
  if (d.address !== undefined && (typeof d.address !== 'string' || d.address.trim().length < 5 || d.address.length > 200 || /[\u0000-\u001f\u007f]/.test(d.address))) return null;
  const address = typeof d.address === 'string' ? {address: d.address.trim(), city: 'The Woodlands', state: 'TX'} : {};
  // Only explicitly supported customer fields are stored.
  return {...Object.fromEntries(Object.keys(limits).map(key=>[key,(d[key] as string).trim()])),...address,consent:true,schemaVersion:d.address === undefined ? 2 : 3};
}
export function notificationText(d:Record<string,unknown>) {
  const p=packages[d.service as string];
  const text = (value: unknown) => String(value).replace(/\s+/g, ' ').trim()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    '<b>SC Detailing Request</b>',
    '<b>Name:</b> ' + text(d.name),
    '<b>Phone:</b> ' + text(d.phone),
    '<b>Vehicle:</b> ' + text(d.vehicle),
    ...(d.address ? ['<b>Address:</b> ' + text(d.address) + ', The Woodlands, TX'] : []),
    '<b>Package:</b> $' + p.price + ' ' + p.label,
    '<b>Preferred time:</b> ' + text(d.preferredTime),
    '<b>Cleaning needs:</b> ' + text(d.needs || 'None added')
  ].join('\n');
}
type Database = (path:string,body:unknown,prefer?:string)=>Promise<any>;
export async function deliverNotification(db:Database,env:(key:string)=>string,id:string|null=null,send:typeof fetch=fetch) {
  // Leave pending jobs untouched until both secrets have been configured.
  const token=env('TELEGRAM_BOT_TOKEN'),channel=env('TELEGRAM_CHAT_ID');
  if (!token || !channel) return 'unconfigured';
  const job=await db('rpc/sc_ai_claim_notification',{p_id:id});
  if (!job) return 'idle';
  const finish=(state:string,error:string|null=null,message:number|null=null,delay=60)=>db('rpc/sc_ai_finish_notification',{
    p_id:job.request_id,p_attempt:job.attempt_id,p_state:state,p_message:message,p_error:error,p_delay:delay
  });
  let response:Response;
  try {
    response=await send('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      // Customer values are HTML-escaped before applying bold labels.
      body:JSON.stringify({chat_id:channel,text:notificationText(job.details),parse_mode:'HTML',link_preview_options:{is_disabled:true}}),
      signal:AbortSignal.timeout(8000)
    });
  } catch {
    await finish('uncertain','network_or_timeout'); return 'uncertain';
  }
  let out;
  try { out=await response.json(); } catch { await finish('uncertain','invalid_telegram_response'); return 'uncertain'; }
  if (response.ok && out.ok === true && Number.isSafeInteger(out.result?.message_id)) {
    await finish('sent',null,out.result.message_id); return 'sent';
  }
  // Only explicit Telegram rejection proves it is safe to retry.
  if (out.ok === false && Number.isInteger(out.error_code)) {
    const delay=Math.max(Number(out.parameters?.retry_after)||0,Math.min(3600,30*2**Math.min(job.attempts,7)));
    await finish('pending','telegram_'+out.error_code,null,delay); return 'pending';
  }
  await finish('uncertain','ambiguous_telegram_response'); return 'uncertain';
}
