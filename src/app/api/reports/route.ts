import { NextResponse } from 'next/server';
import { readSessionTokenFromCookie } from '@/lib/auth/cookies';
import { hashSessionToken } from '@/lib/auth/session-token';
import { supabaseAdmin } from '@/lib/supabase-server';
import { actionFailure } from '@/lib/hos-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const token=readSessionTokenFromCookie(request.headers.get('cookie'));
 if (!token) return NextResponse.json({}, { status: 401 });
 const q=new URL(request.url).searchParams,venue=q.get('venue')??'';
 try {
  const {data,error}=await supabaseAdmin.rpc('hos_session_report',{p_hash:hashSessionToken(token),p_venue:venue,p_range:q.get('range')??'today',p_from:q.get('from'),p_to:q.get('to'),p_options:JSON.parse(q.get('options')??'{}')});
  if(error?.code==='28000')return NextResponse.json({}, {status:401});
  if(error)throw error;
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return actionFailure(error,'report.read',undefined,venue);}
}
