"use client";

import { useState, useEffect } from "react";
import { Save, Check, MapPin, Clock, Wifi, Phone, Image, Type, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useCmsStore } from "@/store/cmsStore";
import { RestaurantInfo } from "@/types/cms";
import BsCollapse from "@/components/admin/BsCollapse";
import ImageUploadField from "@/components/admin/ImageUploadField";
import clsx from "clsx";

export default function RestaurantEditor() {
  const { venue } = useParams<{ venue: string }>();
  const restaurant = useCmsStore((s) => s.restaurant);
  const componentStyles = useCmsStore((s) => s.componentStyles);
  const updateRestaurant = useCmsStore((s) => s.updateRestaurant);
  const saveActiveToAllRestaurants = useCmsStore((s) => s.saveActiveToAllRestaurants);

  const [form, setForm] = useState<RestaurantInfo>(restaurant);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "contact">("general");

  useEffect(() => {
    setForm(restaurant);
  }, [restaurant]);

  const handleChange = (field: keyof RestaurantInfo, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = () => {
    updateRestaurant(form);
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  type FieldDef = {
    key: keyof RestaurantInfo;
    label: string;
    icon: typeof Type;
    placeholder: string;
    bilingual?: boolean;
    upload?: "hero" | "logo";
  };

  const generalFields: FieldDef[] = [
    { key: "name", label: "Naziv restorana", icon: Type, placeholder: "npr. Moj restoran", bilingual: true },
    { key: "tagline", label: "Slogan", icon: FileText, placeholder: "npr. Autentična italijanska kuhinja", bilingual: true },
    { key: "image", label: "Hero slika", icon: Image, placeholder: "", upload: "hero" },
    { key: "logo", label: "Logo", icon: Image, placeholder: "", upload: "logo" },
  ];

  const contactFields: FieldDef[] = [
    { key: "address", label: "Adresa", icon: MapPin, placeholder: "Ulica i broj, grad", bilingual: true },
    { key: "openHours", label: "Radno vrijeme", icon: Clock, placeholder: "10:00 - 23:00", bilingual: true },
    { key: "wifi", label: "WiFi mreža", icon: Wifi, placeholder: "GuestWiFi" },
    { key: "phone", label: "Broj telefona", icon: Phone, placeholder: "+387 33 123 456" },
  ];

  const activeFields = activeTab === "general" ? generalFields : contactFields;

  return (
    <div className="max-w-3xl w-full px-0 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-dark adm-text tracking-tight">Informacije o restoranu</h1>
        <p className="text-sm text-muted adm-text-muted mt-1">Prilagodite kako vaš restoran izgleda na meniju</p>
      </div>

      {/* Live preview card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden mb-6 border border-primary/5 w-full"
      >
        <div className="relative h-44 adm-bg overflow-hidden w-full">
          {componentStyles.heroMediaType === 'video' && componentStyles.heroVideoUrl ? (
            <video src={componentStyles.heroVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          ) : (componentStyles.heroImageUrl || form.image) ? (
            <img src={componentStyles.heroImageUrl || form.image} alt="Hero" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-bg to-primary/5 flex items-center justify-center">
              <Image size={40} className="adm-text-faint" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-end gap-3">
              {form.logo && (
                <div className="w-12 h-12 rounded-2xl adm-surface adm-border border/20 backdrop-blur-md overflow-hidden border-2 border-white/30 shrink-0">
                  <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <p className="text-white font-extrabold text-xl leading-tight drop-shadow-md">
                  {form.name || "Restaurant Name"}
                </p>
                <p className="text-white/60 text-xs mt-0.5">{form.tagline || "Your tagline here"}</p>
              </div>
            </div>
          </div>
          <div className="absolute top-3 right-3 glass px-2.5 py-1 rounded-full text-[10px] font-semibold text-dark adm-text">
            Live Preview
          </div>
        </div>
      </motion.div>

      {/* Editor card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden border border-primary/5 w-full"
      >
        {/* Tabs */}
        <div className="flex border-b border-bg">
          {(["general", "contact"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "flex-1 py-3.5 text-[13px] font-semibold transition-all relative",
                activeTab === tab
                  ? "text-dark adm-text"
                  : "text-muted adm-text-muted hover:adm-text"
              )}
            >
              {tab === "general" ? "Opšte" : "Kontakt i radno vrijeme"}
              {activeTab === tab && (
                <motion.div
                  layoutId="restaurantTab"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[2px] bg-gradient-to-r from-primary to-amber-500 rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="p-6 space-y-5">
          {activeFields.map((f, i) => (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              {!f.upload && (
                <label className="flex items-center gap-2 text-xs font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">
                  <f.icon size={12} className="text-primary/50" />
                  {f.label}
                </label>
              )}
              {f.upload ? (
                <ImageUploadField
                  label={f.label}
                  restaurantId={venue}
                  placement={f.upload}
                  value={form[f.key] ?? ""}
                  onChange={(url) => handleChange(f.key, url)}
                />
              ) : f.bilingual ? (
                <div>
                  <input
                    type="text"
                    value={form[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 adm-bg rounded-2xl text-sm text-dark adm-text outline-none border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 transition-all placeholder:adm-text-faint"
                  />
                  <BsCollapse hasValue={!!((form as any)[`${f.key}_bs`])}>
                    <input
                      type="text"
                      value={(form as any)[`${f.key}_bs`] || ""}
                      onChange={(e) => handleChange(`${f.key}_bs` as keyof RestaurantInfo, e.target.value)}
                      placeholder={`${f.placeholder} (Bosanski)`}
                      className="w-full px-4 py-3 adm-bg rounded-2xl text-sm text-dark adm-text outline-none border border-blue-200/30 focus:border-blue-400 focus:adm-surface adm-border border focus:ring-4 focus:ring-blue-100 transition-all placeholder:adm-text-faint"
                    />
                  </BsCollapse>
                </div>
              ) : (
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 adm-bg rounded-2xl text-sm text-dark adm-text outline-none border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 transition-all placeholder:adm-text-faint"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Save button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            className={clsx(
              "w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-300",
              saved
                ? "bg-accent-green text-white shadow-lg shadow-green-200"
                : "bg-gradient-to-r from-primary to-amber-500 text-white shadow-glow hover:brightness-105"
            )}
          >
            {saved ? (
              <>
                <Check size={16} strokeWidth={3} />
                Uspješno sačuvano
              </>
            ) : (
              <>
                <Save size={16} />
                Spremi izmjene
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
