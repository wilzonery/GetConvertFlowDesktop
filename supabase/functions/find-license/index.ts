import { json } from '../_shared/http.ts';
import { adminRequest } from '../_shared/supabase.ts';
import { licenseKeyForSession } from '../_shared/stripe.ts';

// Owner-only: look up a customer's license key(s) by purchase email so you can resend a lost key.
// Protected by the ADMIN_TOKEN secret. Never expose this token in the app or on a website.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const expected = Deno.env.get('ADMIN_TOKEN');
  const provided = request.headers.get('x-admin-token') ?? '';
  if (!expected || expected.length < 20 || provided !== expected) return json({ error: 'Not allowed.' }, 401);

  try {
    const { email } = await request.json();
    if (typeof email !== 'string' || !email.includes('@')) return json({ error: 'Enter a valid email.' }, 400);

    const response = await adminRequest(
      `entitlements?email=ilike.${encodeURIComponent(email.trim())}&select=email,status,stripe_checkout_session_id`,
    );
    const rows = await response.json() as Array<{ email: string; status: string; stripe_checkout_session_id: string }>;
    const licenses = await Promise.all(rows.map(async (row) => ({
      email: row.email,
      status: row.status,
      licenseKey: await licenseKeyForSession(row.stripe_checkout_session_id),
    })));
    return json({ licenses });
  } catch (error) {
    console.error('find-license failed', error);
    return json({ error: 'Lookup failed.' }, 500);
  }
});