import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { actionFailure } from '@/lib/hos-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const user=await getSessionUserFromRequest(request);
 if(!user||user.platform_role!=='admin')return NextResponse.json({}, {status:403});
 try{
  const options=JSON.parse(new URL(request.url).searchParams.get('options')??'{}');
  const {data,error}=await supabaseAdmin.rpc('hos_support_feed',{p_actor:user.id,p_options:options});
  if(error)throw error;
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return actionFailure(error,'support.read',user.id);}
}
