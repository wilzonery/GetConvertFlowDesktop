import { adminRequest } from '../_shared/supabase.ts';

function page(title: string, body: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#09090b;color:#fff;font:16px system-ui;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;padding:32px;border:1px solid #3f3f46;border-radius:20px;background:#18181b}code{display:block;background:#27272a;padding:14px;border-radius:10px;word-break:break-all;color:#facc15}</style></head><body><main class="card"><h1>${title}</h1>${body}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.has('cancelled')) return page('Checkout cancelled', '<p>No payment was made. You can close this page and try again from ConvertFlow.</p>');
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId?.startsWith('cs_')) return page('Missing checkout session', '<p>Return to ConvertFlow and start checkout again.</p>');
  try {
    const response = await adminRequest(`entitlements?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&select=status,license_key_hash`);
    const rows = await response.json() as Array<{ status: string; license_key_hash: string }>;
    if (!rows[0] || rows[0].status !== 'active') {
      return page('Payment is being confirmed', '<p>Your Stripe payment is successful, but the secure confirmation is still processing. Refresh this page in a few seconds.</p>');
    }
    // The key is deterministic from the random Stripe Checkout session ID; it is never stored in plaintext.
    const { licenseKeyForSession } = await import('../_shared/stripe.ts');
    const key = await licenseKeyForSession(sessionId);
    return page('Your ConvertFlow license', `<p>Copy this code into ConvertFlow to activate this installation:</p><code>${key}</code><p>You may now close this page.</p>`);
  } catch (error) {
    console.error('checkout-success failed', error);
    return page('Could not retrieve your license', '<p>Please refresh this page shortly. If the issue continues, contact support with your Stripe receipt.</p>');
  }
});
