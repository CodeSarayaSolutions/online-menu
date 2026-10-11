"use client";
import {useParams} from 'next/navigation';
import {useCmsStore} from '@/store/cmsStore';
import {useLanguageStore} from '@/store/languageStore';
import {translateUi} from '@/lib/ui-messages';
export function useUiText(){
 const params=useParams(),venue=typeof params?.venue==='string'?params.venue:'';
 const configured=useCmsStore(s=>s.allRestaurants[venue]?.restaurant.language);
 const preference=useLanguageStore(s=>s.language);
 return (text:string)=>translateUi(text,configured??preference);
}
