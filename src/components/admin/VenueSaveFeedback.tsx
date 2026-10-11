'use client';
import { useVenueSaveStore } from '@/store/venueSaveStore';
import { useCmsStore } from '@/store/cmsStore';
import { useOperationalText } from '@/hooks/useOperationalText';

export default function VenueSaveFeedback({ venue }: { venue: string }) {
  const status = useVenueSaveStore(s => s.venues[venue]);
  const t = useOperationalText();
  if (!status || status.state === 'saved') return null;
  const recoverConflict = () => {
    const draft = useCmsStore.getState().allRestaurants[venue];
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${venue}-draft.json`; link.click();
    URL.revokeObjectURL(url);
    window.location.reload();
  };
  return <div role={status.state === 'error' ? 'alert' : 'status'} className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-900">
    {status.state === 'saving' ? t('Čuvanje izmjena…', 'Saving changes…') : <>
      <p>{status.conflict ? t('Meni je u međuvremenu izmijenjen. Sačuvajte kopiju svojih izmjena i učitajte najnoviju verziju.', 'The menu has changed since you opened it. Keep a copy of your changes and load the latest version.') : t('Žao nam je, izmjene nisu sačuvane. Vaš unos je još ovdje. Pokušajte ponovo.', 'Sorry, your changes could not be saved. Your entries are still here. Please try again.')}</p>
      <button type="button" className="mt-3 min-h-11 rounded-xl bg-slate-900 px-4 text-white" onClick={status.conflict ? recoverConflict : () => void useCmsStore.getState().saveActiveToAllRestaurants(venue)}>
        {status.conflict ? t('Preuzmi izmjene i osvježi', 'Download changes and reload') : t('Pokušaj ponovo', 'Try again')}
      </button>
    </>}
  </div>;
}
