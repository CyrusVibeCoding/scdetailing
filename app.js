const $ = selector => document.querySelector(selector);
const chat = $('#chat');
const log = $('#messages');
const input = $('#message');
const messageForm = $('#message-form');
const sendButton = messageForm.querySelector('button');
const status = $('#chat-status');
const quick = $('#quick-replies');
const foot = $('.chat-foot');
let history = [];
let pending = false;
let trigger;
let draft = null;
let field = null;
let editing = false;
let requestId = null;
let submittedDetails = null;
let discussedService = null;
const packages = {
  'Interior detail': 'Interior detail · $40',
  'Exterior detail': 'Exterior detail · $35',
  'Full detail': 'Interior + exterior combo · $55',
  'Premium detail': 'Premium detail · $75'
};
const fields = [
  ['name', 'Name', 'What name should our team use?', 80],
  ['vehicle', 'Vehicle', 'What is your car’s year, make and model?', 120],
  ['service', 'Package', 'Which detail would you like?', 40],
  ['preferredTime', 'Preferred time', 'What day and time would work for you? Our team will check availability before confirming an appointment.', 160],
  ['needs', 'Cleaning needs', 'Anything specific you’d like us to clean or pay attention to?', 600],
  ['address', 'Street address', 'What street address in The Woodlands, TX would the detail be at?', 200],
  ['phone', 'Phone number', 'What phone number can our team text about your detail?', 30]
];

function bubble(text, role = 'assistant') {
  const element = document.createElement('div');
  element.className = 'bubble ' + role;
  const label = document.createElement('span');
  label.className = 'sr-only';
  label.textContent = role === 'visitor' ? 'You: ' : 'SC Detailing AI: ';
  element.append(label, document.createTextNode(text));
  log.append(element);
  scrollToLatest();
  return element;
}

function scrollToLatest() {
  const latest = log.lastElementChild;
  if (!latest) return;
  log.scrollTop = log.scrollHeight;
  const top = latest.getBoundingClientRect().top - log.getBoundingClientRect().top;
  if (top < 0) log.scrollTop += top - 8;
}

function choices(items) {
  quick.replaceChildren();
  for (const [text, action] of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.onclick = action;
    button.disabled = pending;
    quick.append(button);
  }
  scrollToLatest();
}

function showAI() {
  if (pending) return;
  status.textContent = '';
  field = null;
  input.type = 'text';
  input.maxLength = 1000;
  input.disabled = false;
  $('#message-form button').disabled = false;
  input.placeholder = 'Ask about your car…';
  input.setAttribute('aria-label', 'Your message');
  $('#message-form').hidden = false;
  foot.textContent = 'Your request details are shared privately with our team for follow-up. AI can make mistakes.';
  if (!log.children.length) bubble('Hi! I’m SC Detailing’s AI assistant. Tell me what your car needs, and we’ll plan your detail together.');
  choices([[draft ? 'Continue my request' : 'Plan my detail', () => startRequest()]]);
}

function startRequest(service) {
  if (pending || submittedDetails) return;
  draft ||= {};
  if (!draft.service && discussedService) draft.service = discussedService;
  if (Object.hasOwn(packages, service)) draft.service = service;
  foot.textContent = 'You’ll review everything before sending it privately to our team on Telegram.';
  askNext();
}

function askNext() {
  const next = fields.find(([key]) => !Object.hasOwn(draft, key));
  if (!next) return reviewRequest();
  askField(next[0]);
}

function askField(key) {
  const [, label, prompt, limit] = fields.find(([name]) => name === key);
  field = key;
  $('#message-form').hidden = key === 'service';
  input.disabled = false;
  $('#message-form button').disabled = false;
  input.value = '';
  input.maxLength = limit;
  input.type = key === 'phone' ? 'tel' : 'text';
  input.placeholder = label;
  input.setAttribute('aria-label', label);
  bubble(prompt);
  const options = key === 'service'
    ? Object.entries(packages).map(([service, label]) => [label, () => submit(service)])
    : key === 'needs' ? [['Nothing else', () => submit('None added')]] : [];
  choices([...options, ['Ask a service question', () => { editing = false; showAI(); }]]);
  if (key === 'service') {
    input.blur();
    quick.querySelector('button')?.focus({ preventScroll: true });
  } else input.focus({ preventScroll: true });
}

function collectDetail(text) {
  const [, , , limit] = fields.find(([key]) => key === field);
  if (text.length > limit || (field !== 'needs' && text.length < (field === 'address' ? 5 : 2)) || /[\u0000-\u001f\u007f]/.test(text)) {
    status.textContent = 'Please enter a complete ' + fields.find(([key]) => key === field)[1].toLowerCase() + '.';
    return;
  }
  if (field === 'phone' && (!/^[+\d\s().-]+$/.test(text) || text.replace(/\D/g, '').length < 10 || text.replace(/\D/g, '').length > 15)) {
    status.textContent = 'Enter a phone number with 10–15 digits so our team can text you.';
    return;
  }
  if (field === 'service' && !Object.hasOwn(packages, text)) {
    status.textContent = 'Choose one of the packages above.';
    return;
  }
  bubble(text, 'visitor');
  draft[field] = text;
  input.value = '';
  if (editing) { editing = false; reviewRequest(); } else askNext();
}

function reviewRequest() {
  field = 'review';
  $('#message-form').hidden = true;
  input.disabled = true;
  $('#message-form button').disabled = true;
  const summary = fields.map(([key, label]) => label + '\n' + (key === 'service' ? packages[draft[key]] : draft[key])).join('\n\n');
  bubble('Please check your details.\n\n' + summary + '\n\nBy choosing “Confirm and send”, you confirm these details and agree that SC Detailing may text or call about this request. We’ll send the details privately to our team on Telegram. The team will check availability before confirming an appointment.');
  choices([['Confirm and send', sendRequest], ['Edit details', editDetails]]);
  quick.querySelector('button')?.focus();
}

function editDetails() {
  if (pending || submittedDetails) return;
  choices(fields.map(([key, label]) => [label, () => { editing = true; askField(key); }]));
  quick.querySelector('button')?.focus();
}

async function sendRequest() {
  if (pending) return;
  submittedDetails ||= { ...draft, consent: true };
  requestId ||= crypto.randomUUID();
  pending = true;
  choices([]);
  status.textContent = 'Sending your confirmed details to our team…';
  try {
    const data = await api({ action: 'request', id: requestId, details: submittedDetails });
    if (data.delivery === 'sent') {
      bubble('our team will be with you soon');
      status.textContent = '';
      field = 'complete';
      foot.textContent = 'Our team has your details and will follow up using your phone number.';
    } else {
      status.textContent = 'Your request is saved. Telegram delivery is still awaiting confirmation. Check again shortly.';
      pending = false;
      choices([['Check delivery', sendRequest]]);
    }
  } catch (error) {
    status.textContent = (error.name === 'TimeoutError' ? 'We could not confirm delivery yet.' : error.message) + ' Retry with the same request to check safely.';
    pending = false;
    choices([['Try again', sendRequest]]);
  } finally {
    pending = false;
  }
}

function openChat() {
  trigger = document.activeElement;
  if (!chat.open) chat.showModal();
  if (!log.children.length) showAI();
}

const api = body => window.scApi(body);

async function submit(text) {
  text = text.trim();
  if (!text || pending) return;
  status.textContent = '';
  if (field && !['review', 'complete'].includes(field)) return collectDetail(text);
  if (field === 'review' || field === 'complete') return;
  pending = true;
  input.value = '';
  sendButton.disabled = true;
  quick.querySelectorAll('button').forEach(button => button.disabled = true);
  let staged;
  try {
      staged = bubble(text, 'visitor');
      status.textContent = 'Thinking…';
      const messages = [...history.slice(-10), { role: 'user', text }];
      while (JSON.stringify({ action: 'chat', messages }).length > 15000 && messages.length > 1) {
        messages.splice(0, 2);
      }
      const data = await api({ action: 'chat', messages });
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw Error('No answer received. Please try again.');
      // Carry the customer's latest unambiguous package topic into their review.
      const interior = /\binterior\b/i.test(text);
      const exterior = /\bexterior\b/i.test(text);
      const comparing = /\b(or|versus|vs|compare|difference)\b/i.test(text);
      const premium = /\bpremium\b|\$75\b/i.test(text);
      if (!comparing && premium) {
        discussedService = 'Premium detail';
      } else if (!comparing && !premium && (/\b(full\s*(detail|package|service)|combo)\b/i.test(text) || (interior && exterior && /\b(and|plus)\b|\+/i.test(text)))) {
        discussedService = 'Full detail';
      } else if (!comparing && !premium && interior !== exterior) {
        discussedService = interior ? 'Interior detail' : 'Exterior detail';
      }
      if (draft && discussedService) draft.service = discussedService;
      history.push({ role: 'user', text }, { role: 'model', text: data.reply });
      history = history.slice(-10);
      bubble(data.reply);
    status.textContent = '';
  } catch (error) {
    staged?.remove();
    if (!input.value) input.value = text;
    status.textContent = error.name === 'TimeoutError' ? 'The response took too long. Please try again.' : error.message;
  } finally {
    pending = false;
    sendButton.disabled = false;
    quick.querySelectorAll('button').forEach(button => button.disabled = false);
    scrollToLatest();
  }
}

document.querySelectorAll('[data-chat]').forEach(button => button.onclick = openChat);
document.querySelectorAll('[data-service]').forEach(button => button.onclick = () => {
  openChat();
  startRequest(button.dataset.service);
});
const selectedService = new URLSearchParams(location.search).get('service');
if (location.hash === '#chat' || Object.hasOwn(packages, selectedService)) {
  openChat();
  if (Object.hasOwn(packages, selectedService)) startRequest(selectedService);
}
$('#hero-chat').onsubmit = event => {
  event.preventDefault();
  openChat();
  if (pending || submittedDetails) return;
  const text = $('#hero-message').value.trim();
  showAI();
  if (text) {
    input.value = text;
    submit(text);
    $('#hero-message').value = '';
  }
};
$('#close-chat').onclick = () => chat.close();
chat.addEventListener('close', () => trigger?.focus());
// Keep the composer focused when tapping Send with the mobile keyboard open.
sendButton.addEventListener('pointerdown', event => {
  if (document.activeElement === input) event.preventDefault();
});
messageForm.onsubmit = event => {
  event.preventDefault();
  submit(input.value);
};

function fitChatToViewport() {
  const viewport = window.visualViewport;
  chat.style.setProperty('--chat-viewport-height', (viewport?.height || window.innerHeight) + 'px');
  chat.style.setProperty('--chat-viewport-top', (viewport?.offsetTop || 0) + 'px');
  if (chat.open) scrollToLatest();
}
window.visualViewport?.addEventListener('resize', fitChatToViewport);
window.visualViewport?.addEventListener('scroll', fitChatToViewport);
window.addEventListener('resize', fitChatToViewport);
fitChatToViewport();
