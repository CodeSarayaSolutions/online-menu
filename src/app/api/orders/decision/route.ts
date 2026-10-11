import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { actionFailure,sameOrigin } from '@/lib/hos-server';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({}, {status:403});const user=await getSessionUserFromRequest(request);if(!user)return NextResponse.json({}, {status:401});let venue='';
 try{const body=await request.json();venue=body.venue;if(typeof venue!=='string'||typeof body.orderId!=='string'||typeof body.accept!=='boolean')return NextResponse.json({}, {status:400});
 const {data,error}=await supabaseAdmin.rpc('hos_guest_decide',{p_actor:user.id,p_venue:venue,p_order:body.orderId,p_accept:body.accept,p_minutes:body.minutes??10});if(error)throw error;return NextResponse.json(data);
 }catch(error){return actionFailure(error,'guest.decision',user.id,venue);}
}
