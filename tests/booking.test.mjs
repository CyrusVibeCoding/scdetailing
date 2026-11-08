import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingDetails,notificationText,deliverNotification} from '../supabase/functions/sc-ai-chat/booking.ts';
const details={name:'SC TEST Alex Fictional',phone:'202-555-0147',vehicle:'Fictional 2020 Civic',service:'Full detail',preferredTime:'TEST Saturday afternoon, do not schedule',needs:'TEST crumbs only',consent:true};
test('consent and phone are required; extra fields are dropped',()=>{
  assert.equal(bookingDetails({...details,consent:false}),null);
  assert.equal(bookingDetails({...details,phone:'bad'}),null);
  assert.equal(bookingDetails({...details,service:'unknown'}),null);
  assert.equal(bookingDetails({...details,phone:'202-555-0147<script>'}),null);
  const saved=bookingDetails({...details,price:1});
  assert.equal(saved.schemaVersion,2); assert.equal(saved.price,undefined); assert.equal(saved.address,undefined);
});
test('new addresses use fixed locality, validate length, and escape alerts',()=>{
  const saved=bookingDetails({...details,address:'  123 Fictional Lane  ',city:'Houston',state:'CA'});
  assert.equal(saved.address,'123 Fictional Lane');
  assert.equal(saved.city,'The Woodlands'); assert.equal(saved.state,'TX'); assert.equal(saved.schemaVersion,3);
  assert.equal(bookingDetails({...details,address:'x'}),null);
  assert.equal(bookingDetails({...details,address:'x'.repeat(201)}),null);
  assert.equal(bookingDetails({...details,address:'123 Fictional\nLane'}),null);
  assert.match(notificationText({...saved,address:'123 <b> Lane'}),/Address:<\/b> 123 &lt;b&gt; Lane, The Woodlands, TX/);
});
test('alert contains only the requested seven lines and escapes customer values',()=>{
  const text=notificationText({...details,name:'Alex <b>& Fictional'});
  assert.equal(text.split('\n').length,7);
  assert.match(text,/^<b>SC Detailing Request<\/b>\n/);
  assert.match(text,/<b>Name:<\/b> Alex &lt;b&gt;&amp; Fictional/);
  assert.match(text,/<b>Package:<\/b> \$60 interior and exterior combo/);
  assert.match(text,/<b>Phone:<\/b> 202-555-0147/);
  assert.doesNotMatch(text,/follow-up|consent|availability|fictional-reference/i);
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
  const send=async(_url,options)=>{
    calls++;
    const payload=JSON.parse(options.body);
    assert.equal(payload.parse_mode,'HTML');
    assert.equal(payload.text,notificationText(details));
    return Response.json({ok:true,result:{message_id:42}});
  };
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
