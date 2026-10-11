'use client';
import { useUiText } from "@/hooks/useUiText";
import { useOperationalText } from '@/hooks/useOperationalText';
type Config = { language: 'bs' | 'en'; timezone: string; kitchenEnabled: boolean };
export default function VenueLocaleFields({ value, onChange }: { value: Config; onChange: (value: Config) => void }) {
  const uiText = useUiText();
 const t=useOperationalText();
 return <div className="space-y-3">
  <label className="block text-sm adm-text">{t('Jezik lokala','Venue language')}<select value={value.language} onChange={e=>onChange({...value,language:e.target.value as 'bs'|'en'})} className="mt-1 block w-full min-h-11 rounded-xl border adm-border adm-bg px-3"><option value="bs">{uiText("Bosanski")}</option><option value="en">{uiText("English")}</option></select></label>
  <label className="block text-sm adm-text">{t('Vremenska zona','Time zone')}<input list="venue-timezones" value={value.timezone} onChange={e=>onChange({...value,timezone:e.target.value})} className="mt-1 block w-full min-h-11 rounded-xl border adm-border adm-bg px-3" placeholder="Europe/Sarajevo" /><datalist id="venue-timezones">{['Europe/Sarajevo','Europe/Zagreb','Europe/Belgrade','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','Asia/Dubai','UTC'].map(zone=><option key={zone} value={zone}/>)}</datalist></label>
  <label className="flex items-center gap-3 min-h-11 text-sm adm-text"><input type="checkbox" checked={value.kitchenEnabled} onChange={e=>onChange({...value,kitchenEnabled:e.target.checked})} className="h-5 w-5" />{t('Omogući kuhinju','Enable kitchen')}</label>
 </div>;
}
