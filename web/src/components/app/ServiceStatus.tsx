"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { cx } from "@/lib/format";

export function ServiceStatus({ locale }: { locale: Locale }) {
  const M = getDict(locale).modelsPage;
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { api.health().then((h) => setOk(h.status === "ok")).catch(() => setOk(false)); }, []);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[13px] font-medium shadow-soft ring-1 ring-border" role="status">
      <span className={cx("size-2 rounded-full", ok == null ? "bg-muted-foreground animate-pulse" : ok ? "bg-fast" : "bg-strict")} aria-hidden />
      {M.status}: {ok == null ? "…" : ok ? M.online : M.offline}
    </span>
  );
}
