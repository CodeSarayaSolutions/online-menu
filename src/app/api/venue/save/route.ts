import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { actionFailure, sameOrigin } from '@/lib/hos-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({}, { status: 401 });
  let slug = '';
  try {
    const body = await request.json(); slug = body.slug;
    if (typeof slug !== 'string' || !slug || !body.patch || typeof body.patch !== 'object' || !body.requestKey) return NextResponse.json({}, { status: 400 });
    const { data, error } = await supabaseAdmin.rpc('hos_menu_save', { p_actor: user.id, p_venue: slug, p_revision: body.revision, p_patch: body.patch, p_request_key: body.requestKey });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return actionFailure(error, 'menu.save', user.id, slug); }
}
