const $ = selector => document.querySelector(selector);
const chat = $('#chat');
const log = $('#messages');
const input = $('#message');
const status = $('#chat-status');
const quick = $('#quick-replies');
const foot = $('.chat-foot');
let mode = 'ai';
let history = [];
let pending = false;
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
  choices([['Have Saif contact me', () => startRequest()]]);
}

function startRequest(service) { location.href = 'request.html' + (service ? '?service=' + encodeURIComponent(service) : ''); }

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
  pending = true;
  input.disabled = true;
  $('#message-form button').disabled = true;
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
      history.push({ role: 'user', text }, { role: 'model', text: data.reply });
      history = history.slice(-10);
      bubble(data.reply);
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
