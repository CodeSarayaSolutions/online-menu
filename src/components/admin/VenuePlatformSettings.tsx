'use client';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCmsStore } from '@/store/cmsStore';
import { performAction } from '@/services/actionService';
import { loadVenueBundle } from '@/lib/venue-cloud/sync';
import { isTimeZone } from '@/lib/venue-time';
import { useOperationalText } from '@/hooks/useOperationalText';
import VenueLocaleFields from './VenueLocaleFields';
export default function VenuePlatformSettings({venue}:{venue:string}){
 const isAdmin=useAuthStore(s=>s.getCurrentUser()?.platformRole==='admin');
 const info=useCmsStore(s=>s.allRestaurants[venue]?.restaurant);
 const [value,setValue]=useState({language:info?.language??'bs',timezone:info?.timezone??'Europe/Sarajevo',kitchenEnabled:info?.kitchenEnabled??false});
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),[saved,setSaved]=useState(false);const t=useOperationalText();
 if(!isAdmin)return null;
 const save=async()=>{setBusy(true);setError(false);setSaved(false);try{
  await performAction('venue.configure',venue,value);
  const bundle=await loadVenueBundle(venue);if(!bundle)throw new Error('Missing venue');
  useCmsStore.setState(s=>({allRestaurants:{...s.allRestaurants,[venue]:bundle}}));useCmsStore.getState().loadVenuePublic(venue);setSaved(true);
 }catch{setError(true);}finally{setBusy(false);}};
 return <section className="mt-6 rounded-2xl border adm-border adm-surface p-5 space-y-4"><h2 className="font-bold adm-text">{t('Postavke platforme','Platform settings')}</h2><VenueLocaleFields value={value} onChange={v=>{setValue(v);setSaved(false);}} /><button disabled={busy||!isTimeZone(value.timezone)} onClick={()=>void save()} className="min-h-11 rounded-xl bg-primary px-4 text-white disabled:opacity-50">{busy?t('Čuvanje…','Saving…'):t('Sačuvaj postavke','Save settings')}</button>{error&&<p role="alert">{t('Žao nam je, pokušajte ponovo.','Sorry, please try again.')}</p>}{saved&&<p role="status">{t('Sačuvano.','Saved.')}</p>}</section>;
}
