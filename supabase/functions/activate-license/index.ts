import { json, options } from '../_shared/http.ts';
import { adminRequest } from '../_shared/supabase.ts';
import { sha256 } from '../_shared/stripe.ts';

const MAX_INSTALLATIONS = 3;

Deno.serve(async (request) => {
  const preflight = options(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const { licenseKey, installId } = await request.json();
    if (typeof licenseKey !== 'string' || typeof installId !== 'string' || !/^[0-9a-f-]{36}$/i.test(installId)) {
      return json({ error: 'Invalid activation request.' }, 400);
    }
    const hash = await sha256(licenseKey.trim().toUpperCase());
    const entitlementResponse = await adminRequest(`entitlements?license_key_hash=eq.${hash}&select=id,status,current_period_end`);
    const entitlements = await entitlementResponse.json() as Array<{ id: string; status: string; current_period_end: string | null }>;
    const entitlement = entitlements[0];
    if (!entitlement || entitlement.status !== 'active' || (entitlement.current_period_end && Date.parse(entitlement.current_period_end) < Date.now())) {
      return json({ error: 'That license is not active.' }, 403);
    }
    const existingResponse = await adminRequest(`entitlement_activations?entitlement_id=eq.${entitlement.id}&install_id=eq.${installId}&select=id`);
    const existing = await existingResponse.json() as Array<{ id: string }>;
    if (!existing.length) {
      const countResponse = await adminRequest(`entitlement_activations?entitlement_id=eq.${entitlement.id}&select=id`);
      const activations = await countResponse.json() as Array<{ id: string }>;
      if (activations.length >= MAX_INSTALLATIONS) return json({ error: `This license is already active on ${MAX_INSTALLATIONS} installations.` }, 403);
      await adminRequest('entitlement_activations', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ entitlement_id: entitlement.id, install_id: installId }) });
    }
    return json({ active: true });
  } catch (error) {
    console.error('activate-license failed', error);
    return json({ error: 'Could not validate this license right now.' }, 500);
  }
});
