"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone, Monitor, RotateCw, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageContent, ComponentStyles, LayoutConfig } from "@/types/cms";
import { useCmsStore } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import clsx from "clsx";

interface LivePreviewProps {
  pageContent: PageContent;
  componentStyles: ComponentStyles;
  layoutConfig: LayoutConfig;
  venueSlug?: string;
}

export default function LivePreview({ pageContent, componentStyles, layoutConfig, venueSlug }: LivePreviewProps) {
  // Always resolve the active venue – use prop if provided, otherwise fall back to authStore
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const resolvedSlug = venueSlug || activeRestaurantId || null;

  // Read products, categories, and restaurant from the store so the preview iframe always has the latest data
  const products = useCmsStore((s) => s.products);
  const categories = useCmsStore((s) => s.categories);
  const restaurant = useCmsStore((s) => s.restaurant);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"phone" | "tablet">("phone");
  const [scale, setScale] = useState(1);

  // Calculate scale to fit the phone frame in the container
  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      const containerHeight = containerRef.current.clientHeight;
      const containerWidth = containerRef.current.clientWidth;

      const deviceWidth = deviceMode === "phone" ? 375 : 768;
      const deviceHeight = deviceMode === "phone" ? 812 : 1024;
      const chromeHeight = 56;
      const totalDeviceHeight = deviceHeight + chromeHeight;

      const scaleX = (containerWidth - 32) / deviceWidth;
      const scaleY = (containerHeight - 32) / totalDeviceHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      setScale(Math.max(newScale, 0.3));
    };

    calculateScale();
    const observer = new ResizeObserver(calculateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [deviceMode]);

  // Listen for the iframe signaling it's ready (postMessage from child)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "cms-preview-ready") {
        setIframeLoaded(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Fallback: if onLoad or postMessage somehow fails, force-show after 4s
  useEffect(() => {
    if (iframeLoaded) return;
    const timer = setTimeout(() => setIframeLoaded(true), 4000);
    return () => clearTimeout(timer);
  }, [iframeLoaded]);

  // Send preview data to iframe whenever props or store data changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "cms-preview-update",
        payload: { pageContent, componentStyles, layoutConfig, products, categories, restaurant },
      },
      "*"
    );
  }, [pageContent, componentStyles, layoutConfig, products, categories, restaurant, iframeLoaded]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    // Send initial data once iframe loads
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "cms-preview-update",
          payload: { pageContent, componentStyles, layoutConfig, products, categories, restaurant },
        },
        "*"
      );
    }, 300);
  };

  const previewUrl = resolvedSlug ? `/${resolvedSlug}?preview=1` : "/?preview=1";

  const deviceWidth = deviceMode === "phone" ? 375 : 768;
  const deviceHeight = deviceMode === "phone" ? 812 : 1024;

  return (
    <div className="flex flex-col h-full">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-3 adm-surface adm-border border border-b border adm-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center">
            <Smartphone size={13} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-dark adm-text leading-tight">Live Preview</p>
            <p className="text-[10px] text-muted adm-text-muted">Changes appear instantly</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Device toggle */}
          <button
            onClick={() => setDeviceMode("phone")}
            className={clsx(
              "p-1.5 rounded-lg transition-all",
              deviceMode === "phone"
                ? "bg-primary/10 text-primary"
                : "text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]"
            )}
            title="Phone view"
          >
            <Smartphone size={14} />
          </button>
          <button
            onClick={() => setDeviceMode("tablet")}
            className={clsx(
              "p-1.5 rounded-lg transition-all",
              deviceMode === "tablet"
                ? "bg-primary/10 text-primary"
                : "text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]"
            )}
            title="Tablet view"
          >
            <Monitor size={14} />
          </button>

          {/* Refresh */}
          <button
            onClick={() => {
              setIframeLoaded(false);
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }}
            className="p-1.5 rounded-lg text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition-all ml-1"
            title="Refresh preview"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* Preview Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 relative"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      >
        {/* Loading overlay */}
        <AnimatePresence>
          {!iframeLoaded && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 adm-surface adm-border border/80 backdrop-blur-sm z-20 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <Smartphone size={18} className="text-primary" />
                </div>
                <p className="text-xs font-semibold text-muted adm-text-muted">Loading preview…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Device Frame */}
        <div
          className="relative transition-transform duration-300 ease-out"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* Phone chrome */}
          <div
            className={clsx(
              "relative bg-[#1a1a1a] shadow-2xl",
              deviceMode === "phone" ? "rounded-[3rem] p-[10px]" : "rounded-[1.5rem] p-[8px]"
            )}
            style={{
              width: deviceWidth + 20,
            }}
          >
            {/* Top notch (phone only) */}
            {deviceMode === "phone" && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-[#1a1a1a] rounded-b-2xl z-10 flex items-center justify-center gap-2">
                <div className="w-[8px] h-[8px] rounded-full bg-[#2a2a2a] ring-1 ring-[#333]" />
                <div className="w-[50px] h-[4px] rounded-full bg-[#2a2a2a]" />
              </div>
            )}

            {/* Screen */}
            <div
              className={clsx(
                "adm-surface adm-border border overflow-hidden relative",
                deviceMode === "phone" ? "rounded-[2.4rem]" : "rounded-[1rem]"
              )}
              style={{
                width: deviceWidth,
                height: deviceHeight,
              }}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={handleIframeLoad}
                className="w-full h-full border-0"
                style={{
                  width: deviceWidth,
                  height: deviceHeight,
                }}
                title="Live Menu Preview"
              />
            </div>

            {/* Bottom home indicator (phone only) */}
            {deviceMode === "phone" && (
              <div className="flex justify-center py-2">
                <div className="w-[100px] h-[4px] rounded-full bg-[#444]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
