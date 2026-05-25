"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import type { ImagePlacement } from "@/lib/storage/constants";
import clsx from "clsx";

type Props = {
  label: string;
  restaurantId: string;
  placement: ImagePlacement;
  value: string;
  onChange: (url: string) => void;
  className?: string;
  /** Hide built-in preview (e.g. when parent shows a small thumbnail) */
  hidePreview?: boolean;
};

export default function ImageUploadField({
  label,
  restaurantId,
  placement,
  value,
  onChange,
  className,
  hidePreview = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File | null) => {
    if (!file || !restaurantId) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("restaurantId", restaurantId);
      body.append("placement", placement);

      const res = await fetch("/api/upload", {
        method: "POST",
        body,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      onChange(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <label className="flex items-center gap-2 text-xs font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">
        <ImageIcon size={12} className="text-primary/50" />
        {label}
      </label>

      {value && !hidePreview ? (
        <div className="relative rounded-2xl overflow-hidden border border-primary/10 mb-2 h-32 adm-bg">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={uploading || !restaurantId}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "flex-1 py-3 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 border transition",
            uploading
              ? "border adm-border text-muted adm-text-muted"
              : "border-primary/20 text-dark adm-text hover:bg-primary/5"
          )}
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <p className="text-[10px] text-muted adm-text-muted mt-1.5">
        Saved to bucket <span className="font-mono">sarayamenu/{restaurantId}/{placement}-filename</span>
      </p>

      {error && (
        <p className="text-[11px] text-red-600 mt-1 bg-red-50 px-2 py-1 rounded-lg">{error}</p>
      )}
    </div>
  );
}
