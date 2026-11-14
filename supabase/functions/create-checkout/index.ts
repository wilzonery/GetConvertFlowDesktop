import { corsHeaders, json, options } from '../_shared/http.ts';
import { stripeForm, stripeRequest } from '../_shared/stripe.ts';

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const priceId = Deno.env.get('STRIPE_PRICE_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const mode = Deno.env.get('STRIPE_MODE') === 'subscription' ? 'subscription' : 'payment';
    if (!priceId || !supabaseUrl) throw new Error('Stripe checkout is not configured.');

    // SUCCESS_URL is the address of your hosted success page; falls back to the built-in one.
    const successBase = Deno.env.get('SUCCESS_URL') || `${supabaseUrl}/functions/v1/checkout-success`;

    // Optional promo code from the website (for example RELEASED2026). If it exists in Stripe it is applied
    // automatically; otherwise the customer can still type a code on the Stripe page.
    const requestBody = await request.json().catch(() => ({})) as { promoCode?: unknown };
    const promoCode = typeof requestBody.promoCode === 'string' && /^[A-Za-z0-9_-]{3,32}$/.test(requestBody.promoCode) ? requestBody.promoCode : null;
    let promotionCodeId: string | null = null;
    if (promoCode) {
      try {
        const found = await stripeRequest(`/promotion_codes?code=${encodeURIComponent(promoCode)}&active=true&limit=1`);
        promotionCodeId = found.data?.[0]?.id ?? null;
      } catch (error) {
        console.error('promo code lookup failed', error);
      }
    }

    const session = await stripeRequest('/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: stripeForm({
        ...(promotionCodeId ? { 'discounts[0][promotion_code]': promotionCodeId } : { allow_promotion_codes: 'true' }),
        mode,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${successBase}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${successBase}?cancelled=1`,
        'metadata[product]': 'convertflow_desktop',
        'metadata[mode]': mode,
      }),
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return new Response(JSON.stringify({ url: session.url }), { headers: corsHeaders });
  } catch (error) {
    console.error('create-checkout failed', error);
    return json({ error: error instanceof Error ? error.message : 'Could not start checkout.' }, 500);
  }
});
