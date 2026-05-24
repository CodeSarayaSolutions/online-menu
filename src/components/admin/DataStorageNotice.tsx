import { Database } from "lucide-react";
import { DATA_STORAGE_LINE, DATA_STORAGE_TITLE } from "@/lib/admin-branding";

export default function DataStorageNotice() {
  return (
    <div className="mx-1 mb-2 p-3 rounded-2xl adm-bg border border-primary/10">
      <div className="flex items-center gap-2 mb-1">
        <Database size={11} className="text-primary shrink-0" />
        <span className="text-[9px] font-bold text-dark adm-text">{DATA_STORAGE_TITLE}</span>
      </div>
      <p className="text-[9px] text-muted adm-text-muted leading-relaxed">{DATA_STORAGE_LINE}</p>
    </div>
  );
}
