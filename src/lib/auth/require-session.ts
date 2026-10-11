import { supabaseAdmin } from '@/lib/supabase-server';
import { readSessionTokenFromCookie } from '@/lib/auth/cookies';
import { hashSessionToken } from '@/lib/auth/session-token';
import { USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  platform_role: 'admin' | 'user';
};

export async function getSessionUserFromRequest(
  request: Request
): Promise<SessionUser | null> {
  const token = readSessionTokenFromCookie(request.headers.get('cookie'));
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at, credential_version')
    .eq('purpose', 'full')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select(`${USER_PUBLIC_COLUMNS}, credential_version, onboarding_required`)
    .eq('id', session.user_id)
    .maybeSingle();

  if (!user || user.onboarding_required || user.credential_version !== session.credential_version) return null;
  return { id: user.id, email: user.email, name: user.name, platform_role: user.platform_role };
}
