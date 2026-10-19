"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export function CopyButton({ value }: { value: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          // Zwischenablage nicht verfügbar – Link bleibt markierbar
        }
      }}
    >
      {done ? t("common.copied") : t("common.copy")}
    </button>
  );
}
