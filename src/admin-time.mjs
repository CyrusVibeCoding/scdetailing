export function centralInput(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function centralUtc(local) {
  if (!local) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw Error('Choose a valid date and time.');
  const nominal = Date.parse(local + 'Z');
  // Check both Central offsets. Reject nonexistent spring-forward times.
  for (const offset of [5,6]) {
    const iso = new Date(nominal + offset*3600000).toISOString();
    if (centralInput(iso) === local) return iso;
  }
  throw Error('That time does not exist in Central time. Choose another time.');
}
