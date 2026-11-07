const $ = selector => document.querySelector(selector);
const chat = $('#chat');
const log = $('#messages');
const input = $('#message');
const status = $('#chat-status');
const quick = $('#quick-replies');
const foot = $('.chat-foot');
const fields = [
  ['name', 'What’s your name?'],
  ['vehicle', 'What do you drive? Include year, make, and model.'],
  ['service', 'What kind of detail would you like?'],
  ['address', 'What’s the service address, including city?'],
  ['contact', 'What email or phone can the team use to contact you?']
];
const services = ['Interior detail', 'Exterior detail', 'Full detail'];
let mode = 'ai';
let history = [];
let details = {};
let step = 0;
let pending = false;
let requestId;
let trigger;

function bubble(text, role = 'assistant') {
  const element = document.createElement('div');
  element.className = 'bubble ' + role;
  const label = document.createElement('small');
  label.textContent = role === 'visitor' ? 'You' : mode === 'ai' ? 'SC Detailing AI' : 'Booking form';
  element.append(label, document.createTextNode(text));
  log.append(element);
  log.scrollTop = log.scrollHeight;
  return element;
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
}

function showAI() {
  if (pending) return;
  mode = 'ai';
  log.replaceChildren();
  status.textContent = '';
  input.placeholder = 'Ask about your car…';
  foot.textContent = 'AI can make mistakes. Keep contact details and addresses in the separate booking form.';
  bubble('Hi! I’m SC Detailing’s AI assistant. Tell me what your car needs, or ask about our services.');
  for (const message of history) bubble(message.text, message.role === 'user' ? 'visitor' : 'assistant');
  choices([['Request a detail', () => startRequest()]]);
}

function ask() {
  if (step < fields.length) {
    const [field, question] = fields[step];
    bubble(question);
    input.placeholder = field === 'contact' ? 'Your email or phone…' : 'Your answer…';
    const options = field === 'service' ? services.map(service => [service, () => submit(service)]) : [];
    choices([...options, ['Ask the AI', showAI]]);
  } else {
    bubble('Check your request before sending.\n' + fields.map(([field]) => field + ': ' + details[field]).join('\n'));
    choices([['Send request', () => submit('Send request')], ['Start over', () => startRequest()], ['Ask the AI', showAI]]);
    input.placeholder = 'Use the buttons above to continue';
  }
}

function startRequest(service) {
  if (pending) return;
  mode = 'request';
  details = service ? { service } : {};
  requestId = crypto.randomUUID();
  step = 0;
  log.replaceChildren();
  input.value = '';
  status.textContent = '';
  foot.textContent = 'Booking details are stored privately in SC Detailing’s database and are not sent to Gemini.';
  bubble('This separate form saves a detailing request. Pricing and appointment time need confirmation.');
  ask();
}

function openChat() {
  trigger = document.activeElement;
  if (!chat.open) chat.showModal();
  if (!log.children.length) showAI();
}

async function api(body) {
  const config = window.SC_CONFIG;
  if (!config?.aiEndpoint || !config?.publishableKey) throw Error('Chat is not connected yet.');
  const response = await fetch(config.aiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: 'Bearer ' + config.publishableKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35000)
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Chat is unavailable. Please try again.');
  return data;
}

async function submit(text) {
  text = text.trim();
  if (!text || pending) return;
  status.textContent = '';
  if (mode === 'saved') {
    status.textContent = 'Your request is already saved. Use Ask the AI to return to questions.';
    return;
  }
  if (mode === 'request' && step < fields.length) {
    if (text.length < 2 || text.length > 300) {
      status.textContent = 'Please use 2–300 characters for this detail.';
      return;
    }
    if (fields[step][0] === 'service' && !services.includes(text)) {
      status.textContent = 'Choose Interior detail, Exterior detail, or Full detail.';
      return;
    }
    details[fields[step][0]] = text;
    bubble(text, 'visitor');
    input.value = '';
    step++;
    if (step === 2 && details.service) step++;
    ask();
    return;
  }
  if (mode === 'request' && text !== 'Send request') {
    status.textContent = 'Use Send request or Start over above.';
    return;
  }
  pending = true;
  input.disabled = true;
  $('#message-form button').disabled = true;
  quick.querySelectorAll('button').forEach(button => button.disabled = true);
  let staged;
  try {
    if (mode === 'request') {
      status.textContent = 'Saving your request…';
      await api({ action: 'request', id: requestId, details });
      bubble('Request saved. Your reference is ' + requestId.slice(0, 8) + '. Pricing and appointment time still need confirmation from SC Detailing.');
      details = {};
      mode = 'saved';
      choices([['Ask the AI', showAI]]);
    } else {
      staged = bubble(text, 'visitor');
      status.textContent = 'Thinking…';
      const messages = [...history.slice(-10), { role: 'user', text }];
      while (JSON.stringify({ action: 'chat', messages }).length > 15000 && messages.length > 1) {
        messages.splice(0, 2);
      }
      const data = await api({ action: 'chat', messages });
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw Error('No answer received. Please try again.');
      history.push({ role: 'user', text }, { role: 'model', text: data.reply });
      history = history.slice(-10);
      bubble(data.reply);
    }
    input.value = '';
    status.textContent = '';
  } catch (error) {
    staged?.remove();
    status.textContent = error.name === 'TimeoutError' ? 'The response took too long. Please try again.' : error.message;
  } finally {
    pending = false;
    input.disabled = false;
    $('#message-form button').disabled = false;
    quick.querySelectorAll('button').forEach(button => button.disabled = false);
    log.scrollTop = log.scrollHeight;
  }
}

document.querySelectorAll('[data-chat]').forEach(button => button.onclick = openChat);
document.querySelectorAll('[data-service]').forEach(button => button.onclick = () => {
  openChat();
  startRequest(button.dataset.service);
});
$('#hero-chat').onsubmit = event => {
  event.preventDefault();
  openChat();
  if (pending) return;
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
$('#message-form').onsubmit = event => {
  event.preventDefault();
  submit(input.value);
};
