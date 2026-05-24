"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCmsStore } from "@/store/cmsStore";
import { ensureVenueLoaded } from "@/lib/venue-cloud/sync";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function VenueLayout({ children }: { children: React.ReactNode }) {
  const { venue } = useParams<{ venue: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!venue) return;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("preview") === "1") {
        setReady(true);
        return;
      }
    }

    const slug = decodeURIComponent(venue);
    let cancelled = false;
    (async () => {
      const ok = await ensureVenueLoaded(slug);
      if (cancelled) return;
      if (!ok) {
        router.replace("/");
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [venue, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <LanguageSwitcher />
      {children}
    </>
  );
}
