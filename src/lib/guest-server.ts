import 'server-only';
import { createHash } from 'crypto';
export const guestCookieName=(venue:string)=>'onm_guest_'+createHash('sha256').update(venue).digest('hex').slice(0,20);
export const guestHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function readGuestToken(request:Request,venue:string){
 const name=guestCookieName(venue)+'=';
 return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name))?.slice(name.length)??'';
}
