"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { localParts } from '@/lib/venue-time';
import { useCmsStore } from '@/store/cmsStore';
import type { Tables } from '@/types/supabase';
export type ReportRow = Pick<Tables<'table_tabs'>,'id'|'created_at'|'closed_at'|'total'|'payment_method'|'waiter_id'|'origin'|'status'> & {table_label: string;waiter_name: string};
export type Report = { rows: ReportRow[]; nextCursor: {at:string;id:string} | null; summary: {count:number;total:number;cash:number;card:number;openCount:number;legacyGuestCount:number}; version:number;asOf:string;from:string;to:string;checkedAt:string;timezone:string;language:string;unchanged?:boolean };
export type Rankings = {products:{product_id:string;name:string;quantity:number;total:number}[];waiters:{waiter_id:string;name:string;bills:number;total:number}[]};
const cache = new Map<string,Report>();
useAuthStore.subscribe((state,previous) => {if (state.currentUserId!==previous.currentUserId) cache.clear();});
export async function requestReport(query:string,options:Record<string,unknown>={},signal?:AbortSignal) {
 const res=await fetch(`/api/reports?${query}&options=${encodeURIComponent(JSON.stringify(options))}`,{credentials:'include',signal,cache:'no-store'});
 const data=await res.json();
 if (!res.ok) throw Object.assign(new Error('Report unavailable'),{status:res.status});
 return data;
}
export function useReport(venue:string,range:'today'|'week'|'custom',from:string,to:string,mode:'closed'|'open') {
 const actor=useAuthStore(s=>s.currentUserId);
 const timezone=useCmsStore(s=>s.allRestaurants[venue]?.restaurant.timezone ?? 'Europe/Sarajevo');
 const [day,setDay]=useState(()=>localParts(new Date(),timezone).date);
 const query=new URLSearchParams({venue,range,...(range==='custom'?{from,to}:{})}).toString();
 const key=`${actor}:${query}:${mode}:${timezone}:${day}`;
 const [state,setState]=useState<{key:string;data?:Report}>({key});
 const data=state.key===key?state.data:cache.get(key);
 const [loading,setLoading]=useState(false),[error,setError]=useState(false),[paging,setPaging]=useState(false);
 const generation=useRef(0);
 const inFlight=useRef<string | null>(null);
 const enabled=!!actor&&!!venue&&(range!=='custom'||!!from&&!!to&&from<=to);
 const refresh=useCallback(async (force=false,signal?:AbortSignal)=>{
  if(!enabled||inFlight.current===key)return;
  inFlight.current=key;
  const current=++generation.current, previous=cache.get(key);
  setLoading(true);
  try {
   const next=await requestReport(query,{mode,...(!force&&previous?{knownVersion:previous.version}:{})},signal) as Report;
   if(current!==generation.current)return;
   const value=next.unchanged&&previous?{...previous,checkedAt:next.checkedAt}:next;
   cache.set(key,value);if(cache.size>24)cache.delete(cache.keys().next().value!);
   setState({key,data:value});setError(false);
  }catch(e){if(!signal?.aborted&&current===generation.current)setError(true);}
  finally{if(inFlight.current===key)inFlight.current=null;if(current===generation.current)setLoading(false);}
 },[enabled,key,query,mode]);
 useEffect(()=>{
  const controller=new AbortController();
  setState({key,data:cache.get(key)});setError(false);
  void refresh(false,controller.signal);
  const check=()=>{if(document.visibilityState==='visible'){setDay(localParts(new Date(),timezone).date);void refresh(false,controller.signal);}};
  const timer=setInterval(check,30000);
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
  return()=>{controller.abort();generation.current++;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
 },[key,refresh,timezone]);
 const loadMore=async()=>{
  if(!data?.nextCursor||paging)return;
  const current=generation.current;setPaging(true);
  try{
   const next=await requestReport(query,{mode,cursor:data.nextCursor,version:data.version,asOf:data.asOf}) as Report;
   if(current!==generation.current)return;
   const merged={...data,rows:[...data.rows,...next.rows],nextCursor:next.nextCursor};setState({key,data:merged});
  }catch(e){if((e as {status?:number}).status===409)await refresh(true);else setError(true);}
  finally{setPaging(false);}
 };
 return {data,query,loading,error,paging,enabled,refresh,loadMore};
}
