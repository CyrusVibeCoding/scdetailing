// Existing request links continue into the same AI conversation.
const target = new URL('index.html', location.href);
const service = new URLSearchParams(location.search).get('service');
if (service) target.searchParams.set('service', service);
target.hash = 'chat';
location.replace(target.href);
