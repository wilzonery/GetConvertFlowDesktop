import { json, options } from '../_shared/http.ts';
import { adminRequest } from '../_shared/supabase.ts';
import { licenseKeyForSession } from '../_shared/stripe.ts';

// Returns the license key as JSON for a paid checkout session, so a hosted page can display it nicely.
Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const { sessionId } = await request.json();
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return json({ error: 'Invalid session.' }, 400);
    const response = await adminRequest(`entitlements?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&select=status`);
    const rows = await response.json() as Array<{ status: string }>;
    if (!rows[0]) return json({ pending: true });
    if (rows[0].status !== 'active') return json({ error: 'This license is not active.' }, 403);
    return json({ licenseKey: await licenseKeyForSession(sessionId) });
  } catch (error) {
    console.error('get-license failed', error);
    return json({ error: 'Could not retrieve your license right now.' }, 500);
  }
});
