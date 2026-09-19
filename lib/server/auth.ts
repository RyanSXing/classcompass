import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configuration, LOCAL_OWNER } from './config';
import { DomainError } from '@/lib/domain/errors';

export type Actor = { id: string; name: string; client?: SupabaseClient };
export async function supabaseClient() {
  const config = configuration();
  if (!config.supabaseUrl || !config.supabaseKey) throw new DomainError('SUPABASE_CONFIGURATION', 503, 'Supabase project configuration is missing.');
  const jar = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseKey, {
    cookies: { getAll: () => jar.getAll(), setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true, sameSite: 'lax' })) },
  });
}
export async function authenticate(request?: Request): Promise<Actor> {
  if (configuration().dataBackend === 'local') {
    if (request && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(request.url).hostname)) throw new DomainError('LOCAL_ONLY', 403, 'Local demo access is restricted to this computer.');
    return { id: LOCAL_OWNER, name: 'Demo teacher' };
  }
  const client = await supabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new DomainError('UNAUTHENTICATED', 401, 'Sign in to continue. Your unsaved text is still here.');
  return { id: data.user.id, name: data.user.user_metadata?.display_name ?? 'Teacher', client };
}
export function verifyOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const target = new URL(request.url).origin;
  if ((origin && origin !== target) || fetchSite === 'cross-site') throw new DomainError('INVALID_ORIGIN', 403, 'This request must come from ClassCompass.');
}
