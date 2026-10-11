import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-server';
import { actionFailure,sameOrigin } from '@/lib/hos-server';
import { guestCookieName,guestHash } from '@/lib/guest-server';
import { tableQrParam } from '@/lib/table-qr-url';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({}, {status:403});
 let venue='';
 try{
  const body=await request.json();venue=body.venue;
  if(typeof venue!=='string'||typeof body.table!=='string'||body.table.length>200)return NextResponse.json({}, {status:400});
  const {data:settings,error:se}=await supabaseAdmin.from('component_styles').select('styles').eq('restaurant_id',venue).maybeSingle();if(se)throw se;
  if((settings?.styles as {viewOnlyMode?:boolean}|null)?.viewOnlyMode!==false)return NextResponse.json({}, {status:403});
  // Preserve printed legacy QR labels; reject collisions instead of guessing a table.
  const tables=[];
  for(let offset=0;;offset+=500){const {data,error}=await supabaseAdmin.from('restaurant_tables').select('*').eq('restaurant_id',venue).eq('is_active',true).order('id').range(offset,offset+499);if(error)throw error;tables.push(...data??[]);if(!data||data.length<500)break;}
  const matches=tables.filter(t=>t.id===body.table||tableQrParam(t)===body.table);
  if(matches.length!==1)return NextResponse.json({}, {status:404});
  const token=randomBytes(32).toString('hex'),expiresAt=Date.now()+5*60*1000;
  const {error}=await supabaseAdmin.from('guest_sessions').insert({token_hash:guestHash(token),restaurant_id:venue,table_id:matches[0].id,expires_at:new Date(expiresAt).toISOString()});if(error)throw error;
  const response=NextResponse.json({tableId:matches[0].id,tableNumber:matches[0].label,expiresAt},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(guestCookieName(venue),token,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',path:'/api/guest',maxAge:7200});return response;
 }catch(error){return actionFailure(error,'guest.session',undefined,venue);}
}
