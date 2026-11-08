import {createClient} from '@supabase/supabase-js';
import L from 'leaflet';
import {centralInput, centralUtc} from './admin-time.mjs';

const $ = selector => document.querySelector(selector);
const config = window.SC_CONFIG;
const project = new URL(config.aiEndpoint).origin;
const auth = createClient(project, config.publishableKey, {auth:{persistSession:false,detectSessionInUrl:false}}).auth;
const status = $('#admin-status');
let jobs = [], selected = null, filter = 'upcoming', map, markers, draftMarker, pin = null, placing = false, lookupAt = 0, authEpoch = 0;
const dates = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const timeLabel = job => job.scheduled_at ? dates.format(new Date(job.scheduled_at)) : 'Time not set';
const addressLabel = job => job.details.address ? `${job.details.address}, The Woodlands, TX` : 'Address needed';

async function api(body) {
  const {data:{session}} = await auth.getSession();
  if (!session) throw Error('Sign in to continue.');
  const response = await fetch(project + '/functions/v1/sc-admin', {method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+config.publishableKey,'x-sc-user-token':'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Could not load jobs. Try again.');
  return result;
}

function makeMap() {
  if (map) return;
  map=L.map('map',{scrollWheelZoom:false}).setView([30.1658,-95.4613],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  markers=L.layerGroup().addTo(map);
  map.on('click', event => {
    if (!placing || !selected) return;
    setPin(event.latlng.lat,event.latlng.lng);
    placing=false;
    $('#place-pin').textContent='Place pin on map';
  });
}

function visibleJobs() {
  return jobs.filter(job => filter==='all' || (filter==='upcoming' ? job.status==='scheduled' : job.status===filter))
    .sort((a,b)=>filter==='new' ? b.created_at.localeCompare(a.created_at) : (a.scheduled_at||'9999').localeCompare(b.scheduled_at||'9999'));
}

function render() {
  const visible=visibleJobs();
  $('#job-count').textContent=`${visible.length} ${visible.length===1?'job':'jobs'}`;
  const list=$('#jobs'); list.replaceChildren();
  markers.clearLayers();
  for (const job of visible) {
    const button=document.createElement('button');
    button.className='job'; button.type='button'; button.setAttribute('aria-pressed',String(selected?.id===job.id));
    for (const [tag,value,cls] of [['span',timeLabel(job),'job-time'],['strong',job.details.name,''],['span',job.details.service+' · '+job.details.vehicle,''],['span',addressLabel(job),'']]) {
      const element=document.createElement(tag); element.textContent=value; element.className=cls; button.append(element);
    }
    button.addEventListener('click',()=>selectJob(job)); list.append(button);
    if (Number.isFinite(job.latitude)&&Number.isFinite(job.longitude)) {
      const marker=L.marker([job.latitude,job.longitude],{icon:L.divIcon({className:'map-pin '+job.status,iconSize:[18,18],iconAnchor:[9,9]}),title:job.details.name});
      const popup=document.createElement('div'); popup.textContent=`${job.details.name} · ${timeLabel(job)}`;
      marker.bindPopup(popup).on('click',()=>selectJob(job)).addTo(markers);
    }
  }
  if (!visible.length) {
    const empty=document.createElement('p'); empty.className='empty';
    empty.textContent=filter==='upcoming'?'No washes scheduled yet. Open New requests to plan your first wash.':'No jobs in this view.';
    list.append(empty);
  }
}

function setPin(latitude,longitude) {
  pin=latitude===null?null:{latitude,longitude};
  if (draftMarker) { draftMarker.remove(); draftMarker=null; }
  if (pin) {
    draftMarker=L.marker([latitude,longitude],{draggable:true,icon:L.divIcon({className:'map-pin',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map);
    draftMarker.on('dragend',()=>{const p=draftMarker.getLatLng(); pin={latitude:p.lat,longitude:p.lng}; $('#pin-status').textContent='Pin adjusted. Save job to keep it.';});
  }
  $('#pin-status').textContent=pin?'Pin ready. Check location, then save job.':'No map pin saved for this job.';
}

function selectJob(job) {
  selected=job; lookupAt++; placing=false;
  $('#place-pin').textContent='Place pin on map';
  $('#job-detail').hidden=false;
  $('#detail-heading').textContent=job.details.name;
  $('#detail-summary').textContent=`${job.details.service} · ${job.details.vehicle} · Preferred ${job.details.preferredTime}`;
  $('#detail-address').textContent=addressLabel(job);
  $('#detail-phone').textContent=job.details.phone;
  $('#detail-phone').href='tel:'+job.details.phone.replace(/[^+\d]/g,'');
  $('#detail-needs').textContent=job.details.needs || 'No cleaning notes added.';
  const form=$('#schedule-form'); form.elements.status.value=job.status; form.elements.scheduledAt.value=centralInput(job.scheduled_at);
  $('#find-address').disabled=!job.details.address;
  setPin(job.latitude,job.longitude);
  if (pin) map.setView([pin.latitude,pin.longitude],15);
  status.textContent=''; render();
}

async function refreshJobs() {
  const epoch=authEpoch;
  const result=await api({action:'list'});
  if (epoch!==authEpoch) return;
  jobs=result.jobs;
  $('#sign-in').hidden=true; $('#workspace').hidden=false; $('#sign-out').hidden=false;
  makeMap(); map.invalidateSize(); render();
  if (selected) {
    const updated=jobs.find(job=>job.id===selected.id);
    if (updated) selectJob(updated);
  }
}

async function signIn(create=false) {
  const form=$('#login-form'); if (!form.reportValidity()) return;
  const buttons=form.querySelectorAll('button'); buttons.forEach(button=>button.disabled=true);
  status.textContent=create?'Creating account…':'Signing in…';
  try {
    const credentials={email:form.elements.email.value.trim(),password:form.elements.password.value};
    const {data,error}=create ? await auth.signUp(credentials) : await auth.signInWithPassword(credentials);
    if (error) throw error;
    form.elements.password.value='';
    if (create&&!data.session) {status.textContent='Check your email to confirm account. Then return here and sign in. If already registered, use Sign in.';return;}
    await refreshJobs(); status.textContent='';
  } catch(error) {status.textContent=error.message; await auth.signOut();}
  finally {buttons.forEach(button=>button.disabled=false);}
}
$('#login-form').addEventListener('submit',event=>{event.preventDefault();signIn();});
$('#create-account').addEventListener('click',()=>signIn(true));
$('#sign-out').addEventListener('click',async()=>{
  authEpoch++; lookupAt++; selected=null; jobs=[]; placing=false;
  $('#workspace').hidden=true; $('#sign-in').hidden=false; $('#sign-out').hidden=true; $('#job-detail').hidden=true;
  $('#jobs').replaceChildren(); $('#detail-heading').textContent=''; $('#detail-summary').textContent=''; $('#detail-address').textContent=''; $('#detail-phone').textContent=''; $('#detail-phone').removeAttribute('href'); $('#detail-needs').textContent=''; $('#schedule-form').reset();
  if(map){map.remove();map=null;markers=null;draftMarker=null;} pin=null;
  await auth.signOut(); status.textContent='Signed out.';
});
$('#refresh').addEventListener('click',async()=>{try{await refreshJobs();status.textContent='Jobs refreshed.';}catch(error){status.textContent=error.message;}});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  filter=button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); render();
}));
$('#place-pin').addEventListener('click',()=>{placing=!placing;$('#place-pin').textContent=placing?'Cancel placing pin':'Place pin on map';$('#pin-status').textContent=placing?'Click map to place pin. Then save job.':'Pin placement cancelled.';});
$('#clear-pin').addEventListener('click',()=>setPin(null,null));
$('#find-address').addEventListener('click',async()=>{
  if(!selected?.details.address)return;
  const request=++lookupAt, button=$('#find-address');button.disabled=true;
  $('#pin-status').textContent='Finding address…';
  try {
    const params=new URLSearchParams({format:'jsonv2',limit:'1',countrycodes:'us',q:addressLabel(selected)});
    const response=await fetch('https://nominatim.openstreetmap.org/search?'+params,{signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Address search unavailable. Place pin on map instead.');
    const results=await response.json(); if(request!==lookupAt)return;
    if(!results.length)throw Error('Address not found. Place pin on map instead.');
    const latitude=Number(results[0].lat),longitude=Number(results[0].lon);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))throw Error('No valid location found. Place pin on map instead.');
    setPin(latitude,longitude);map.setView([latitude,longitude],17);
  }catch(error){if(request===lookupAt)$('#pin-status').textContent=error.message;}
  finally{button.disabled=!selected?.details.address;}
});
$('#schedule-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected)return;
  const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
  try {
    const scheduledAt=centralUtc(form.elements.scheduledAt.value);
    if(form.elements.status.value!=='new'&&!scheduledAt)throw Error('Choose wash date and time.');
    const id=selected.id;
    const {job}=await api({action:'update',id,version:selected.version,status:form.elements.status.value,scheduledAt,latitude:pin?.latitude??null,longitude:pin?.longitude??null});
    jobs=jobs.map(row=>row.id===job.id?job:row);
    if(selected?.id===id)selectJob(job);
    render();status.textContent='Job saved. Contact customer to confirm your plan.';
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
});
