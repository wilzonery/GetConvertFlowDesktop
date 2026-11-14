import { adminRequest } from '../_shared/supabase.ts';
import { sendLicenseEmail } from '../_shared/email.ts';
import { licenseKeyForSession, sha256, stripeRequest, verifyStripeSignature } from '../_shared/stripe.ts';

// A purchase belongs to ConvertFlow if it came from our own checkout (metadata) or from the Stripe Payment Link.
// Optional: set PAYMENT_LINK_ID (plink_...) to accept only that one link; if unset, any Payment Link on this account counts.
function isConvertFlowSession(session: Record<string, any>) {
  if (session.metadata?.product === 'convertflow_desktop') return true;
  if (!session.payment_link) return false;
  const allowed = Deno.env.get('PAYMENT_LINK_ID');
  return !allowed || session.payment_link === allowed;
}

async function upsertEntitlement(session: Record<string, unknown>) {
  if (!isConvertFlowSession(session)) return;
  const sessionId = String(session.id);
  const licenseKey = await licenseKeyForSession(sessionId);
  const licenseKeyHash = await sha256(licenseKey);
  const payload = {
    stripe_checkout_session_id: sessionId,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
    stripe_price_id: Deno.env.get('STRIPE_PRICE_ID') ?? null,
    license_key_hash: licenseKeyHash,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  await adminRequest('entitlements?on_conflict=stripe_checkout_session_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });

  // Email the key. A failed email must never fail the purchase, so errors are only logged.
  if (typeof payload.email === 'string') {
    try {
      await sendLicenseEmail(payload.email, licenseKey, sessionId);
    } catch (error) {
      console.error('license email failed', error);
    }
  }
}

async function updateSubscription(subscription: Record<string, unknown>) {
  const id = String(subscription.id);
  const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' :
    subscription.status === 'past_due' ? 'past_due' : 'inactive';
  await adminRequest(`entitlements?stripe_subscription_id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status, current_period_end: subscription.current_period_end ? new Date(Number(subscription.current_period_end) * 1000).toISOString() : null, updated_at: new Date().toISOString() }),
  });
}

// A fully refunded purchase switches its license off so it can no longer be activated.
async function revokeForRefund(charge: Record<string, unknown>) {
  if (charge.refunded !== true) return; // ignore partial refunds
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  if (!paymentIntent) return;
  const sessions = await stripeRequest(`/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntent)}&limit=1`);
  const session = sessions.data?.[0] as Record<string, unknown> | undefined;
  if (!session || !isConvertFlowSession(session as Record<string, any>)) return;
  await adminRequest(`entitlements?stripe_checkout_session_id=eq.${encodeURIComponent(String(session.id))}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'inactive', updated_at: new Date().toISOString() }),
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const payload = await request.text();
  if (!(await verifyStripeSignature(payload, request.headers.get('stripe-signature')))) {
    return new Response('Invalid Stripe signature', { status: 400 });
  }
  try {
    const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
    if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
      await upsertEntitlement(event.data.object);
    } else if (event.type === 'charge.refunded') {
      await revokeForRefund(event.data.object);
    } else if (['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await updateSubscription(event.data.object);
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('stripe-webhook failed', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
});
