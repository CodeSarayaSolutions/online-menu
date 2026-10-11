import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { actionFailure,sameOrigin } from '@/lib/hos-server';
import { readGuestToken,guestHash } from '@/lib/guest-server';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({}, {status:403});let venue='';
 try{const body=await request.json();venue=body.venue;
  if(typeof venue!=='string'||!Array.isArray(body.items)||typeof body.requestKey!=='string'||typeof body.tableId!=='string')return NextResponse.json({}, {status:400});
  const token=readGuestToken(request,venue);if(!token)return NextResponse.json({}, {status:401});
  const {data,error}=await supabaseAdmin.rpc('hos_guest_submit',{p_hash:guestHash(token),p_venue:venue,p_request:body.requestKey,p_items:body.items,p_note:body.note??'',p_table:body.tableId});
  if(error?.code==='28000')return NextResponse.json({expired:true},{status:401});if(error)throw error;
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return actionFailure(error,'guest.submit',undefined,venue);}
}
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,venue=q.get('venue')??'',id=q.get('id')??'';
 try{const token=readGuestToken(request,venue);if(!token)return NextResponse.json({}, {status:401});
  const {data,error}=await supabaseAdmin.from('orders').select('id,status,total,estimated_minutes,accepted_at').eq('restaurant_id',venue).eq('id',id).eq('guest_token_hash',guestHash(token)).gte('created_at',new Date(Date.now()-7200000).toISOString()).maybeSingle();if(error)throw error;if(!data)return NextResponse.json({}, {status:404});return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return actionFailure(error,'guest.status',undefined,venue);}
}
