"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useOperationalText } from '@/hooks/useOperationalText';
import { useCmsStore } from '@/store/cmsStore';
import { localParts } from '@/lib/venue-time';
import { performAction } from '@/services/actionService';
import { readInventoryPage, type InventoryPage as Page, type StockProduct, type InventoryMovementRow } from '@/services/inventoryService';

const button='min-h-[44px] rounded-xl px-4 py-2 border adm-border font-semibold disabled:opacity-40';
const input='w-full min-h-[48px] rounded-xl border adm-border adm-bg px-3';
export default function InventoryPage(){
 const venue=String(useParams().venue??''),t=useOperationalText();
 const zone=useCmsStore(s=>s.restaurant.timezone)||'Europe/Sarajevo';
 const today=localParts(new Date(),zone).date;
 const [from,setFrom]=useState(today),[to,setTo]=useState(today),[search,setSearch]=useState(''),[query,setQuery]=useState('');
 const [page,setPage]=useState<Page<StockProduct>|null>(null),[history,setHistory]=useState<Page<InventoryMovementRow>|null>(null);
 const [historyOpen,setHistoryOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const [edit,setEdit]=useState<{row:StockProduct;mode:'initialize'|'add'|'remove'}|null>(null),[quantity,setQuantity]=useState('');
 const generation=useRef(0),lastToday=useRef(today);
 useEffect(()=>{if(lastToday.current!==today){setFrom(today);setTo(today);lastToday.current=today;}},[today]);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search),200);return()=>clearTimeout(timer);},[search]);
 const load=useCallback(async()=>{
  const version=++generation.current;setError(false);
  try{
   const data=await readInventoryPage<StockProduct>(venue,{from,to,search:query});
   if(version!==generation.current)return;setPage(data);
   if(historyOpen){const h=await readInventoryPage<InventoryMovementRow>(venue,{mode:'movements',from,to});if(version===generation.current)setHistory(h);}
  }catch{if(version===generation.current)setError(true);}
 },[venue,from,to,query,historyOpen]);
 useEffect(()=>{setPage(null);setHistory(null);void load();return()=>{generation.current++;};},[load]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};},[load]);
 const more=async(mode:'products'|'movements')=>{
  const current=mode==='products'?page:history;if(!current?.next)return;const version=generation.current;setBusy(true);
  try{const data=await readInventoryPage<StockProduct|InventoryMovementRow>(venue,{mode,from,to,search:query,cursor:current.next,asOf:current.asOf});
   if(version===generation.current){if(mode==='products')setPage({...data,rows:[...page!.rows,...data.rows as StockProduct[]]});else setHistory({...data,rows:[...history!.rows,...data.rows as InventoryMovementRow[]]});}
  }catch{setError(true);}finally{setBusy(false);}
 };
 const changeTracking=async(row:StockProduct)=>{
  if(!row.inventory_id){setEdit({row,mode:'initialize'});setQuantity('0');return;}
  setBusy(true);setError(false);try{await performAction('inventory.tracked',venue,{productId:row.id,tracked:!row.tracked});await load();}catch{setError(true);}finally{setBusy(false);}
 };
 const save=async()=>{
  if(!edit)return;const value=Number(quantity);if(!Number.isFinite(value)||value<0||(edit.mode!=='initialize'&&value===0))return;
  setBusy(true);setError(false);
  try{await performAction(edit.mode==='initialize'?'inventory.initialize':'inventory.adjust',venue,{productId:edit.row.id,...(edit.mode==='initialize'?{quantity:value,unit:'kom',tracked:true}:{delta:edit.mode==='remove'?-value:value})});setEdit(null);await load();}catch{setError(true);}finally{setBusy(false);}
 };
 return <div className="max-w-2xl mx-auto p-4 lg:p-8 pb-24 adm-text space-y-5">
  <header><h1 className="text-2xl font-bold">{t('Zalihe i prodaja','Stock and sales')}</h1><p className="text-sm adm-text-muted mt-1">{t('Prodaja se broji za sve proizvode. Stanje zaliha pratite samo gdje je potrebno.','Sales are counted for every product. Track stock only where you need it.')}</p></header>
  <div className="grid grid-cols-2 gap-3"><label className="text-sm">{t('Od','From')}<input className={input} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">{t('Do','To')}<input className={input} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
  <p className="text-xs adm-text-muted">{t('Prodaja obuhvata naplaćene račune u vremenskoj zoni objekta.','Sales include settled bills in the venue timezone.')} {zone}</p>
  <label className="block"><span className="sr-only">{t('Pretraži proizvode','Search products')}</span><input className={input} type="search" placeholder={t('Pretraži proizvode','Search products')} value={search} onChange={e=>setSearch(e.target.value)}/></label>
  {error&&<div role="alert" className="rounded-xl bg-red-50 text-red-800 p-4">{t('Žao nam je, nešto nije uspjelo. Pokušajte ponovo.','Sorry, something went wrong. Please try again.')} <button className={button} onClick={()=>void load()}>{t('Pokušaj ponovo','Try again')}</button></div>}
  {!page&&!error&&<p role="status">{t('Učitavanje…','Loading…')}</p>}
  {page?.rows.map(row=><article key={row.id} className="rounded-2xl adm-surface border adm-border p-4 space-y-3">
   <h2 className="font-bold text-lg">{row.name}</h2>
   <div className="grid grid-cols-2 gap-3"><p><span className="text-sm adm-text-muted block">{t('Prodano u periodu','Sold in period')}</span><strong className="text-xl">{row.sold}</strong></p><p><span className="text-sm adm-text-muted block">{t('Prihod u periodu','Revenue in period')}</span><strong className="text-xl">{Number(row.revenue).toFixed(2)} KM</strong></p></div>
   <p>{t('Trenutne zalihe:','Current stock:')} <strong>{row.tracked?`${row.quantity??0} ${row.unit??'kom'}`:t('Ne prati se','Not counted')}</strong></p>
   <button className={button} disabled={busy} aria-pressed={row.tracked} onClick={()=>void changeTracking(row)}>{row.tracked?t('Isključi praćenje zaliha','Stop counting stock'):t('Prati zalihe','Count stock')}</button>
   {row.tracked&&<div className="grid grid-cols-2 gap-2">{(['remove','add'] as const).map(mode=><button key={mode} className={button} disabled={busy} onClick={()=>{setEdit({row,mode});setQuantity('');}}>{mode==='add'?t('+ Dodaj zalihu','+ Add stock'):t('− Umanji zalihu','− Remove stock')}</button>)}</div>}
  </article>)}
  {page?.rows.length===0&&<p>{t('Nema proizvoda za ovu pretragu.','No products match your search.')}</p>}
  {page?.next&&<button className={button} disabled={busy} onClick={()=>void more('products')}>{t('Učitaj još proizvoda','Load more products')}</button>}
  <button className={button} aria-expanded={historyOpen} onClick={()=>setHistoryOpen(!historyOpen)}>{t('Kretanje zaliha','Stock movements')}</button>
  {historyOpen&&<section className="space-y-3"><h2 className="font-bold">{t('Kretanje u odabranom periodu','Movements in selected period')}</h2>{history?.rows.map(m=><div key={m.id} className="p-3 rounded-xl border adm-border"><div className="flex justify-between gap-2"><strong>{m.product_name}</strong><span>{m.quantity_delta>0?'+':''}{m.quantity_delta}</span></div><div className="text-sm adm-text-muted">{m.reason==='order'?t('Prodaja','Sale'):m.reason==='init'?t('Početno stanje','Initial stock'):t('Ručna promjena','Manual adjustment')} · {new Intl.DateTimeFormat('bs',{timeZone:history.timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(m.created_at))}</div></div>)}{history?.rows.length===0&&<p>{t('Nema promjena u periodu.','No movements in this period.')}</p>}{history?.next&&<button className={button} disabled={busy} onClick={()=>void more('movements')}>{t('Učitaj još promjena','Load more movements')}</button>}</section>}
  {edit&&<div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3"><form role="dialog" aria-modal="true" aria-labelledby="stock-title" className="w-full max-w-md adm-surface rounded-2xl p-5 space-y-4" onSubmit={e=>{e.preventDefault();void save();}}><h2 id="stock-title" className="font-bold text-lg">{edit.row.name} — {edit.mode==='initialize'?t('Početno stanje','Initial stock'):edit.mode==='add'?t('Dodaj zalihu','Add stock'):t('Umanji zalihu','Remove stock')}</h2><label className="block">{t('Količina','Quantity')}<input autoFocus required className={input} inputMode="decimal" type="number" step="any" min={edit.mode==='initialize'?0:0.001} value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/></label>{error&&<p role="alert">{t('Spremanje nije uspjelo. Pokušajte ponovo.','Could not save. Please try again.')}</p>}<div className="grid grid-cols-2 gap-2"><button type="button" className={button} disabled={busy} onClick={()=>setEdit(null)}>{t('Odustani','Cancel')}</button><button className={button+' bg-primary text-white'} disabled={busy||quantity===''}>{busy?t('Spremanje…','Saving…'):t('Spremi','Save')}</button></div></form></div>}
 </div>;
}
