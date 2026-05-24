"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

interface BsCollapseProps {
  children: React.ReactNode;
  /** Optional: show a filled dot when the BS field has a value */
  hasValue?: boolean;
  /** Extra classes on the wrapper */
  className?: string;
  /** Start expanded instead of collapsed */
  defaultOpen?: boolean;
}

export default function BsCollapse({ children, hasValue, className, defaultOpen = false }: BsCollapseProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={clsx("mt-1.5", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          "flex items-center gap-1.5 text-[10px] font-semibold transition-colors rounded-lg px-2 py-1 -ml-1",
          open
            ? "text-blue-500"
            : hasValue
              ? "text-blue-400/80 hover:text-blue-500"
              : "adm-text-faint hover:text-muted adm-text-muted/70"
        )}
      >
        <span>🇧🇦</span>
        <span>Bosnian</span>
        {hasValue && !open && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
        )}
        <ChevronDown
          size={11}
          className={clsx("transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-1.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
