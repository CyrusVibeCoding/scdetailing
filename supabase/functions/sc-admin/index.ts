const env = (name: string) => Deno.env.get(name) || '';
const origins = new Set(['https://scdetailing.org', 'https://www.scdetailing.org', 'https://cyrusvibecoding.github.io', 'http://127.0.0.1:4180', 'http://localhost:4180']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function database(path: string, method = 'GET', body?: unknown) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, {
    method, headers: {apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation'},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('Could not save changes. Refresh and try again.');
  return response.json();
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin') || '';
  const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://scdetailing.org', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-sc-user-token', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin'};
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers});
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (!origins.has(origin)) return respond({error: 'Origin not allowed'}, 403);
  if (request.method !== 'POST') return respond({error: 'Method not allowed'}, 405);
  try {
    // Gateway receives publishable key; Auth validates the user's current session.
    // This supports both asymmetric and legacy Supabase user signing keys.
    const authorization = request.headers.get('x-sc-user-token') || '';
    if (!authorization.startsWith('Bearer ')) return respond({error: 'Sign in to continue.'}, 401);
    const auth = await fetch(env('SUPABASE_URL') + '/auth/v1/user', {
      headers: {apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: authorization}, signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) return respond({error: 'Sign in to continue.'}, 401);
    const user = await auth.json();
    if (!user.id || !user.email_confirmed_at || !user.email) return respond({error: 'Verify your email before signing in.'}, 403);
    const approved = await database('sc_admin_emails?select=email&email=eq.' + encodeURIComponent(user.email.toLowerCase()));
    if (!approved.length) return respond({error: 'This account does not have admin access.'}, 403);
    const raw = await request.text();
    if (raw.length > 3000) return respond({error: 'Request too large.'}, 413);
    const body = JSON.parse(raw);
    if (body.action === 'list') {
      // Explicit pagination avoids silently omitting jobs after PostgREST's row limit.
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const page = await database('sc_ai_requests?select=id,details,created_at,status,scheduled_at,latitude,longitude,version&order=created_at.desc,id&limit=500&offset=' + offset);
        rows.push(...page);
        if (page.length < 500) break;
      }
      return respond({jobs: rows});
    }
    if (body.action !== 'update' || !uuid.test(body.id) || !Number.isSafeInteger(body.version) || body.version < 0) return respond({error: 'Invalid job update.'}, 400);
    if (!['new','scheduled','completed'].includes(body.status)) return respond({error: 'Choose a job status.'}, 400);
    const time = body.scheduledAt === null ? null : new Date(body.scheduledAt);
    if ((time && !Number.isFinite(time.getTime())) || (body.status !== 'new' && !time)) return respond({error: 'Choose a valid appointment time.'}, 400);
    const {latitude, longitude} = body;
    const noPin = latitude === null && longitude === null;
    if (!noPin && !(Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) return respond({error: 'Choose a valid map pin.'}, 400);
    const saved = await database('sc_ai_requests?id=eq.' + body.id + '&version=eq.' + body.version, 'PATCH', {
      status: body.status, scheduled_at: time?.toISOString() || null, latitude, longitude, version: body.version + 1
    });
    if (!saved.length) return respond({error: 'Someone changed this job. Refresh before saving again.'}, 409);
    return respond({job: saved[0]});
  } catch {
    return respond({error: 'Could not load or save jobs. Refresh and try again.'}, 503);
  }
});
