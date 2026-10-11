'use client';
import { useParams } from 'next/navigation';
import { useCmsStore } from '@/store/cmsStore';
import { useLanguageStore } from '@/store/languageStore';

export function useOperationalText() {
  const params = useParams();
  const venue = typeof params?.venue === 'string' ? params.venue : '';
  const venueLanguage = useCmsStore(s => s.allRestaurants[venue]?.restaurant.language);
  const preference = useLanguageStore(s => s.language);
  const language = venueLanguage ?? preference;
  return (bs: string, en: string) => language === 'bs' ? bs : en;
}
