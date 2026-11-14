/** Thrown when an Edge Function answers with an error status, so callers can react to the status code. */
export class EdgeFunctionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.status = status;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Calls a public Supabase Edge Function without exposing server credentials. */
export async function invokeEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Payments are not configured for this build yet.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey!,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) {
    // Our functions reply with { error }. Supabase's gateway replies with { message } (e.g. 404 not deployed, 401 invalid JWT).
    // Our own functions send a clean { error }; only gateway errors get the status code appended for debugging.
    if (result.error) throw new EdgeFunctionError(result.error, response.status);
    const detail = result.message || 'The service could not complete that request.';
    throw new EdgeFunctionError(`${detail} (code ${response.status})`, response.status);
  }
  return result;
}
