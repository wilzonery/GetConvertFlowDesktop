const encoder = new TextEncoder();

export function stripeForm(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

export async function stripeRequest(path: string, init: RequestInit = {}) {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured.');
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, ...(init.headers ?? {}) },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Stripe request failed.');
  return result;
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(bytes)).map((item) => item.toString(16).padStart(2, '0')).join('');
}

export async function licenseKeyForSession(sessionId: string) {
  return `CF-${(await sha256(sessionId)).slice(0, 24).toUpperCase()}`;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

export async function verifyStripeSignature(payload: string, signature: string | null) {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !signature) return false;
  const fields = signature.split(',').reduce<Record<string, string[]>>((all, item) => {
    const [key, value] = item.split('=', 2);
    if (key && value) (all[key] ??= []).push(value);
    return all;
  }, {});
  const timestamp = Number(fields.t?.[0]);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  return (fields.v1 ?? []).some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const actual = new Uint8Array(candidate.match(/../g)!.map((value) => parseInt(value, 16)));
    return constantTimeEqual(expected, actual);
  });
}
