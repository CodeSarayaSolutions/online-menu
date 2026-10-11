"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useReport, requestReport, type ReportRow, type Rankings } from '@/hooks/useReport';
import { useOperationalText } from '@/hooks/useOperationalText';
import type { TabWithItems } from '@/services/tabService';

export default function OrdersPage(){
 const {venue}=useParams<{venue:string}>(),t=useOperationalText();
 const [range,setRange]=useState<'today'|'week'|'custom'>('today'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [mode,setMode]=useState<'closed'|'open'>('closed');
 const {data,query,loading,error,paging,enabled,refresh,loadMore}=useReport(venue,range,from,to,mode);
 const [selected,setSelected]=useState<ReportRow|null>(null),[detail,setDetail]=useState<TabWithItems|null>(null),[detailError,setDetailError]=useState(false);
 const [showRankings,setShowRankings]=useState(false),[rankings,setRankings]=useState<Rankings|null>(null),[rankingError,setRankingError]=useState(false);
 const money=(n:number)=>new Intl.NumberFormat(data?.language==='en'?'en-GB':'bs-BA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n))+' KM';
 const stamp=(iso:string)=>new Intl.DateTimeFormat(data?.language==='en'?'en-GB':'bs-BA',{timeZone:data?.timezone??'Europe/Sarajevo',dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
 useEffect(()=>{setSelected(null);setDetail(null);setRankings(null);},[query,mode]);
 useEffect(()=>{
  if(!selected)return;const ctrl=new AbortController();setDetail(null);setDetailError(false);
  requestReport(query,{detail:selected.id},ctrl.signal).then(r=>setDetail(r.detail)).catch(()=>{if(!ctrl.signal.aborted)setDetailError(true);});return()=>ctrl.abort();
 },[query,selected]);
 useEffect(()=>{
  if(!showRankings||!data)return;const ctrl=new AbortController();setRankings(null);setRankingError(false);
  requestReport(query,{section:'rankings',asOf:data.asOf},ctrl.signal).then(r=>{if(r.version!==data.version){setRankingError(true);return;}setRankings(r.rankings);}).catch(()=>{if(!ctrl.signal.aborted)setRankingError(true);});return()=>ctrl.abort();
 },[query,showRankings,data?.version,data?.asOf]);
 return <div className="max-w-5xl space-y-5">
  <header><h1 className="text-2xl font-bold adm-text">{t('Narudžbe i promet','Orders and sales')}</h1><p className="mt-2 text-sm adm-text-muted">{t('Promet prikazuje naplaćene račune prema vremenu naplate.','Sales show settled bills by settlement time.')} {data?.timezone}</p></header>
  <div className="flex flex-wrap gap-2" aria-label={t('Period','Period')}>
   {(['today','week','custom'] as const).map((value,i)=><button key={value} aria-pressed={range===value} onClick={()=>setRange(value)} className={`min-h-11 rounded-xl border px-4 ${range===value?'bg-primary text-white':'adm-surface adm-border adm-text'}`}>{[t('Danas','Today'),t('Ova sedmica','This week'),t('Odaberi period','Choose dates')][i]}</button>)}
   <button disabled={loading} onClick={()=>void refresh()} className="min-h-11 rounded-xl border adm-border px-4 adm-text">{loading?t('Provjera…','Checking…'):t('Osvježi','Refresh')}</button>
  </div>
  {range==='custom'&&<div className="flex flex-wrap gap-3"><label className="text-sm adm-text">{t('Od','From')}<input aria-label={t('Od','From')} type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block min-h-11 rounded-xl border adm-border adm-bg px-3" /></label><label className="text-sm adm-text">{t('Do (uključivo)','To (inclusive)')}<input aria-label={t('Do (uključivo)','To (inclusive)')} type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} className="block min-h-11 rounded-xl border adm-border adm-bg px-3" /></label></div>}
  {!enabled&&<p className="adm-text-muted">{t('Odaberite početni i završni datum.','Choose a start and end date.')}</p>}
  {error&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{t('Žao nam je, provjera nije uspjela. Pokušajte osvježiti. Prikazani podaci možda nisu najnoviji.','Sorry, the check failed. Please refresh. Displayed data may be out of date.')}</p>}
  {enabled&&!data&&loading&&<p role="status" className="adm-text-muted">{t('Učitavanje…','Loading…')}</p>}
  {enabled&&data&&<>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[[t('Naplaćeno','Settled'),money(data.summary.total)],[t('Računi','Bills'),data.summary.count],[t('Gotovina','Cash'),money(data.summary.cash)],[t('Kartica','Card'),money(data.summary.card)]].map(([label,value])=><div key={label} className="rounded-2xl border adm-border adm-surface p-4"><p className="text-sm adm-text-muted">{label}</p><p className="mt-1 text-xl font-bold adm-text">{value}</p></div>)}</div>
   <p className="text-xs adm-text-muted">{t('Provjereno','Checked')} {stamp(data.checkedAt)}</p>
   {data.summary.legacyGuestCount>0&&<p className="rounded-xl border adm-border p-3 text-sm adm-text-muted">{data.summary.legacyGuestCount} {t('ranijih narudžbi gostiju nema potvrđenu naplatu i nije uključeno u promet.','earlier guest orders have no confirmed settlement and are excluded from sales.')}</p>}
   <div className="flex gap-2">{(['closed','open'] as const).map(m=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)} className={`min-h-11 rounded-xl border px-4 ${mode===m?'bg-primary text-white':'adm-surface adm-border adm-text'}`}>{m==='closed'?t('Naplaćeni računi','Settled bills'):`${t('Trenutno otvoreni','Currently open')} (${data.summary.openCount})`}</button>)}</div>
   {data.rows.length===0?<p className="rounded-2xl border adm-border p-6 adm-text-muted">{t('Nema računa za ovaj prikaz.','No bills in this view.')}</p>:<div className="space-y-2">{data.rows.map(row=><button key={row.id} onClick={()=>setSelected(row)} className="flex w-full items-center justify-between gap-4 rounded-2xl border adm-border adm-surface p-4 text-left"><span><span className="block font-bold adm-text">{t('Stol','Table')} {row.table_label} · {row.waiter_name??t('Nedodijeljeno','Unassigned')}</span><span className="block mt-1 text-xs adm-text-muted">{stamp(row.closed_at??row.created_at)} · {row.id.slice(0,8)}{row.origin==='guest'?` · ${t('Gost','Guest')}`:''}</span></span><span className="shrink-0 font-bold adm-text">{money(row.total)}</span></button>)}</div>}
   {data.nextCursor&&<button disabled={paging} onClick={()=>void loadMore()} className="w-full min-h-12 rounded-xl border adm-border adm-text">{paging?t('Učitavanje…','Loading…'):t('Prikaži još 50','Show 50 more')}</button>}
   <button aria-expanded={showRankings} onClick={()=>setShowRankings(!showRankings)} className="min-h-12 rounded-xl border adm-border px-4 adm-text">{t('Promet po osoblju i najprodavaniji proizvodi','Sales by staff and top products')}</button>
   {showRankings&&<section className="grid sm:grid-cols-2 gap-4">
    {rankingError?<p role="alert" className="adm-text-muted">{t('Podaci su se promijenili ili nisu dostupni. Osvježite prikaz.','Data changed or is unavailable. Refresh the report.')}</p>:!rankings?<p role="status" className="adm-text-muted">{t('Učitavanje…','Loading…')}</p>:<><div className="rounded-2xl border adm-border p-4"><h2 className="font-bold adm-text">{t('Osoblje','Staff')}</h2>{rankings.waiters.map(w=><div key={w.waiter_id??'none'} className="flex justify-between gap-3 py-2 text-sm adm-text"><span>{w.name??t('Nedodijeljeno','Unassigned')} ({w.bills})</span><strong>{money(w.total)}</strong></div>)}</div><div className="rounded-2xl border adm-border p-4"><h2 className="font-bold adm-text">{t('Prodane količine','Quantities sold')}</h2>{rankings.products.map(p=><div key={p.product_id} className="flex justify-between gap-3 py-2 text-sm adm-text"><span>{p.name}</span><strong>{p.quantity}</strong></div>)}</div></>}
   </section>}
  </>}
  {selected&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 grid place-items-center"><section role="dialog" aria-modal="true" aria-label={t('Detalji računa','Bill details')} className="w-full max-w-lg rounded-2xl adm-surface p-5 space-y-3"><div className="flex items-center justify-between"><h2 className="font-bold adm-text">{t('Stol','Table')} {selected.table_label} · {selected.id.slice(0,8)}</h2><button onClick={()=>setSelected(null)} className="min-h-11 px-3 adm-text">{t('Zatvori','Close')}</button></div>{detailError?<p role="alert">{t('Žao nam je, pokušajte ponovo otvoriti račun.','Sorry, please reopen the bill to try again.')}</p>:!detail?<p role="status">{t('Učitavanje…','Loading…')}</p>:<><p className="text-sm adm-text-muted">{detail.waiter_name} · {stamp(detail.closed_at??detail.created_at)} · {detail.payment_method==='card'?t('Kartica','Card'):detail.payment_method==='cash'?t('Gotovina','Cash'):t('Nije naplaćeno','Unsettled')}</p>{detail.tab_items.map(i=><div key={i.id} className="flex justify-between gap-3 border-b adm-border py-2 text-sm adm-text"><span>{i.quantity} × {i.product_name}<small className="block adm-text-muted">{money(i.unit_price)}</small></span><strong>{money(i.total_price)}</strong></div>)}<p className="text-right font-bold adm-text">{money(detail.total)}</p></>}</section></div>}
 </div>;
}
