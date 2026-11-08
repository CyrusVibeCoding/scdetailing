import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {centralInput,centralUtc} from '../src/admin-time.mjs';

test('Central appointments round-trip, including daylight saving boundaries',()=>{
  assert.equal(centralUtc('2026-11-09T14:00'),'2026-11-09T20:00:00.000Z');
  assert.equal(centralUtc('2027-07-09T14:00'),'2027-07-09T19:00:00.000Z');
  assert.equal(centralInput('2026-11-09T20:00:00Z'),'2026-11-09T14:00');
  assert.throws(()=>centralUtc('2027-03-14T02:30'),/does not exist/);
  assert.equal(centralInput(centralUtc('2026-11-01T01:30')),'2026-11-01T01:30');
});

function endpoint({authenticated=true,approved=true,conflict=false}={}) {
  let handle; const calls=[];
  const source=transformSync(readFileSync(new URL('../supabase/functions/sc-admin/index.ts',import.meta.url),'utf8'),{loader:'ts',target:'es2022'}).code;
  vm.runInNewContext(source,{
    Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://test.invalid':'server-only'},serve:fn=>{handle=fn;}},
    Response,AbortSignal,URL,console,
    fetch:async(url,options={})=>{
      calls.push({url,options});
      if(url.includes('/auth/v1/user'))return new Response(JSON.stringify({id:'admin',email:'admin@example.invalid',email_confirmed_at:'2026-11-08'}),{status:authenticated?200:401});
      if(url.includes('sc_admin_emails'))return new Response(JSON.stringify(approved?[{email:'admin@example.invalid'}]:[]));
      if(options.method==='PATCH')return new Response(JSON.stringify(conflict?[]:[{id:jobId,version:1}]));
      return new Response(JSON.stringify([]));
    }
  });
  return {calls,run:body=>handle(new Request('https://test.invalid/functions/v1/sc-admin',{method:'POST',headers:{Origin:'https://scdetailing.org',Authorization:'Bearer public','x-sc-user-token':'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
const jobId='00000000-0000-4000-8000-000000000000';
const update={action:'update',id:jobId,version:0,status:'scheduled',scheduledAt:'2026-11-09T20:00:00Z',latitude:30.16,longitude:-95.46};
test('anonymous and unapproved users cannot read private requests',async()=>{
  for(const options of [{authenticated:false},{approved:false}]){
    const app=endpoint(options); const response=await app.run({action:'list'});
    assert.ok([401,403].includes(response.status));
    assert.equal(app.calls.some(call=>call.url.includes('sc_ai_requests')),false);
  }
});
test('admin updates use optimistic version and allowlisted fields',async()=>{
  const app=endpoint();assert.equal((await app.run({...update,details:{phone:'tamper'}})).status,200);
  const call=app.calls.find(call=>call.options.method==='PATCH');
  assert.match(call.url,/version=eq.0/);assert.equal(JSON.parse(call.options.body).version,1);
  assert.equal(JSON.parse(call.options.body).details,undefined);
});
test('invalid schedules and partial coordinates cannot be saved',async()=>{
  for(const override of [{scheduledAt:null},{scheduledAt:'invalid'},{latitude:100},{longitude:null},{version:-1},{status:'anything'}]){
    const app=endpoint();assert.equal((await app.run({...update,...override})).status,400);
    assert.equal(app.calls.some(call=>call.options.method==='PATCH'),false);
  }
});
test('stale saves return conflict',async()=>{
  const app=endpoint({conflict:true}); assert.equal((await app.run(update)).status,409);
});
