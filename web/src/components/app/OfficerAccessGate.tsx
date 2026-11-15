"use client";
import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { api } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { Card } from "@/components/ui/primitives";
import { OFFICER_TOKEN_KEY } from "@/components/app/OfficerWorkspace";

export function OfficerAccessGate({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const d = getDict(locale); const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { const token = sessionStorage.getItem(OFFICER_TOKEN_KEY); if (!token) { setAllowed(false); return; } api.officerApplications(token).then(() => setAllowed(true)).catch(() => { sessionStorage.removeItem(OFFICER_TOKEN_KEY); setAllowed(false); }); }, []);
  if (allowed === null) return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-7 animate-spin text-accent" /></div>;
  if (!allowed) return <div className="grid min-h-dvh place-items-center bg-background px-4"><Card className="w-full max-w-md text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-muted"><LockKeyhole className="size-5" /></span><h1 className="mt-4 text-xl font-semibold">{d.officer.loginTitle}</h1><p className="mt-2 text-sm text-muted-foreground">{d.officer.passwordHint}</p><a href={`/${locale}/officer/`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-semibold text-accent-foreground">{d.officer.login}</a></Card></div>;
  return children;
}
