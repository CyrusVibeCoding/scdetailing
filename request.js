const form = document.querySelector('#request-form');
const review = document.querySelector('#request-review');
const status = document.querySelector('#request-status');
const send = document.querySelector('#send-request');
const edit = document.querySelector('#edit-request');
const packages = { 'Exterior detail': 'Exterior detail · $35', 'Interior detail': 'Interior detail · $40', 'Full detail': 'Interior + exterior combo · $60' };
const selected = new URLSearchParams(location.search).get('service');
if (Object.hasOwn(packages, selected)) form.elements.service.value = selected;
const requestId = crypto.randomUUID();
let details;
let busy = false;
form.addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  const phone = form.elements.phone;
  phone.setCustomValidity('');
  const digits = phone.value.replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(phone.value) || digits.length < 10 || digits.length > 15) {
    phone.setCustomValidity('Enter a phone number with 10–15 digits.'); phone.reportValidity(); return;
  }
  for (const key of ['name', 'vehicle', 'preferredTime']) {
    if (form.elements[key].value.trim().length < 2) {
      status.textContent = 'Please complete your name, vehicle, and preferred time.';
      form.elements[key].focus(); return;
    }
  }
  details = Object.fromEntries(['name', 'phone', 'vehicle', 'service', 'preferredTime', 'needs'].map(key => [key, form.elements[key].value.trim()]));
  details.consent = form.elements.consent.checked;
  const list = document.querySelector('#review-details'); list.replaceChildren();
  for (const [key, label] of [['name','Name'],['phone','Phone number'],['vehicle','Vehicle'],['service','Package'],['preferredTime','Preferred day and time'],['needs','Cleaning needs'],['consent','Contact consent']]) {
    const term = document.createElement('dt'); term.textContent = label;
    const value = document.createElement('dd');
    value.textContent = key === 'service' ? packages[details[key]] : key === 'consent' ? 'Agreed to contact about this request' : details[key] || 'None added';
    list.append(term, value);
  }
  form.hidden = true; review.hidden = false; status.textContent = ''; send.focus();
});
form.elements.phone.addEventListener('input', () => form.elements.phone.setCustomValidity(''));
edit.addEventListener('click', () => {
  if (busy) return;
  review.hidden = true; form.hidden = false; status.textContent = ''; form.elements.name.focus();
});
send.addEventListener('click', async () => {
  if (busy || !details) return;
  busy = true; send.disabled = true; edit.disabled = true;
  // Freeze the reviewed payload after an attempt: a lost response may still mean it saved.
  status.textContent = 'Saving your request…';
  try {
    await window.scApi({action: 'request', id: requestId, details});
    review.hidden = true; form.reset(); details = undefined;
    document.querySelector('#saved-reference').textContent = 'Your reference is ' + requestId.slice(0, 8) + '.';
    const success = document.querySelector('#request-success'); success.hidden = false; success.focus();
    status.textContent = '';
  } catch (error) {
    if (error.status === 400) {
      status.textContent = error.message + ' Choose “Edit details” to correct the form.';
      edit.disabled = false;
    } else {
      status.textContent = (error.name === 'TimeoutError' ? 'We could not confirm the save.' : error.message) + ' Use “Try saving again” to check safely. Your request will not be duplicated.';
      send.textContent = 'Try saving again';
    }
  } finally { busy = false; send.disabled = false; }
});
