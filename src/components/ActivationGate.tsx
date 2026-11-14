import { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { activateLicense, startCheckout, TEST_LICENSE_KEY } from '../lib/license';
import { openExternal } from '../lib/electron';

interface ActivationGateProps {
  onActivated: () => void;
}

export default function ActivationGate({ onActivated }: ActivationGateProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result = await activateLicense(key);
    setLoading(false);
    if (result.license) onActivated();
    else setError(result.error || 'We could not activate that key.');
  };

  const checkout = async () => {
    setCheckoutLoading(true);
    setError('');
    try {
      await openExternal(await startCheckout());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start secure checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 py-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/10 via-zinc-950 to-zinc-950">
      <section className="w-full max-w-md mx-auto rounded-3xl border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/40 p-7 sm:p-9">
        <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center mb-6">
          <LockKeyhole size={22} className="text-yellow-400" />
        </div>
        <p className="text-yellow-400 text-xs font-bold uppercase tracking-[0.18em] mb-2">ConvertFlow Pro</p>
        <h1 className="text-3xl font-bold text-fg tracking-tight">Unlock your media tools.</h1>
        <p className="text-zinc-400 text-sm leading-6 mt-3">Purchase securely with Stripe, then paste the license code shown on the confirmation page.</p>

        <div className="grid grid-cols-2 gap-3 my-7">
          <Feature icon={ShieldCheck} text="Local processing" />
          <Feature icon={Sparkles} text="All Pro tools" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-300" htmlFor="license-key">License key</label>
          <div className="relative">
            <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              id="license-key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="CONVERTFLOW-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-3 text-sm text-fg placeholder:text-zinc-600 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/60 text-black font-bold text-sm py-3 transition flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {loading ? 'Activating…' : 'Activate license'}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-zinc-800 text-center">
          <button disabled={checkoutLoading} onClick={checkout} className="text-sm font-semibold text-yellow-400 hover:text-yellow-300 disabled:text-zinc-600 transition">
            {checkoutLoading ? 'Opening secure checkout…' : 'Buy a license with Stripe'}
          </button>
          {import.meta.env.DEV && <p className="mt-3 text-xs text-zinc-600">Development test key: <code className="text-zinc-400">{TEST_LICENSE_KEY}</code></p>}
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-3 flex items-center gap-2 text-xs text-zinc-300">
      <Icon size={15} className="text-yellow-400 shrink-0" />
      {text}
    </div>
  );
}
