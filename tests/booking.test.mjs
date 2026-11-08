import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingDetails,notificationText,deliverNotification} from '../supabase/functions/sc-ai-chat/booking.ts';
const details={name:'SC TEST Alex Fictional',phone:'202-555-0147',vehicle:'Fictional 2020 Civic',service:'Full detail',preferredTime:'TEST Saturday afternoon, do not schedule',needs:'TEST crumbs only',consent:true};
test('consent and phone are required; extra fields are dropped',()=>{
  assert.equal(bookingDetails({...details,consent:false}),null);
  assert.equal(bookingDetails({...details,phone:'bad'}),null);
  assert.equal(bookingDetails({...details,service:'unknown'}),null);
  assert.equal(bookingDetails({...details,phone:'202-555-0147<script>'}),null);
  const saved=bookingDetails({...details,address:'not collected',price:1});
  assert.equal(saved.schemaVersion,2); assert.equal(saved.price,undefined); assert.equal(saved.address,undefined);
});
test('alert includes confirmed price, request reference, and safe follow-up text',()=>{
  const text=notificationText('fictional-reference',details);
  assert.match(text,/\$60 interior and exterior combo/); assert.match(text,/I’ll check our availability/);
  assert.match(text,/fictional-reference/); assert.match(text,/202-555-0147/);
  assert.doesNotMatch(text,/wax shield|confirmed appointment/i);
});
const env=key=>({TELEGRAM_BOT_TOKEN:'fictional-token',TELEGRAM_CHAT_ID:'-1000000000000'}[key]||'');
function database(){
  let state='pending',attempts=0,message=null; const transitions=[];
  const db=async(path,body)=>{
    if(path.endsWith('sc_ai_claim_notification')){
      if(state!=='pending')return null;
      state='sending'; attempts++;
      return {request_id:'test',attempt_id:'attempt',attempts,details};
    }
    state=body.p_state; message=body.p_message; transitions.push(body); return null;
  };
  return {db,transitions,get state(){return state},get message(){return message}};
}
test('success stores receipt; repeat calls do not send again',async()=>{
  const store=database(); let calls=0;
  const send=async()=>{calls++;return Response.json({ok:true,result:{message_id:42}})};
  assert.equal(await deliverNotification(store.db,env,null,send),'sent');
  assert.equal(await deliverNotification(store.db,env,null,send),'idle');
  assert.equal(calls,1); assert.equal(store.message,42);
});
test('concurrent workers claim one alert',async()=>{
  const store=database(); let calls=0;
  await Promise.all([1,2,3].map(()=>deliverNotification(store.db,env,null,async()=>{calls++;return Response.json({ok:true,result:{message_id:43}})})));
  assert.equal(calls,1);
});
test('explicit Telegram failure retains pending job and honors retry_after',async()=>{
  const store=database();
  assert.equal(await deliverNotification(store.db,env,null,async()=>Response.json({ok:false,error_code:429,parameters:{retry_after:300}},{status:429})),'pending');
  assert.ok(store.transitions[0].p_delay>=300); assert.equal(store.state,'pending');
  assert.equal(await deliverNotification(store.db,env,null,async()=>Response.json({ok:true,result:{message_id:44}})),'sent');
});
test('timeout and ambiguous response require review and cannot auto-duplicate',async()=>{
  for(const send of [async()=>{throw Error('timeout')},async()=>new Response('not json'),async()=>Response.json({ok:true})]){
    const store=database(); assert.equal(await deliverNotification(store.db,env,null,send),'uncertain');
    assert.equal(await deliverNotification(store.db,env,null,send),'idle');
  }
});
test('missing Telegram secrets leave requests queued',async()=>{
  const store=database(); assert.equal(await deliverNotification(store.db,()=>''),'unconfigured'); assert.equal(store.state,'pending');
});
test('receipt write failure leaves sending state, not pending',async()=>{
  const store=database(); const db=(path,body)=>path.endsWith('sc_ai_finish_notification')?Promise.reject(Error('database unavailable')):store.db(path,body);
  await assert.rejects(deliverNotification(db,env,null,async()=>Response.json({ok:true,result:{message_id:45}})));
  assert.equal(store.state,'sending');
});
