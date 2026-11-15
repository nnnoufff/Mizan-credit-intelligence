import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getDict, isLocale } from "@/i18n/dict";
import { AppShell } from "@/components/app/AppShell";
import { AssessClient } from "@/components/app/AssessClient";
import { OfficerAccessGate } from "@/components/app/OfficerAccessGate";

export default async function AssessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  return (
    <OfficerAccessGate locale={locale}><AppShell locale={locale} active="assess" title={d.assess.title} lead={d.assess.lead}
      actions={<span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold text-secondary"><ShieldCheck className="size-4" aria-hidden />{d.common.decisionSupport}</span>}>
      <AssessClient locale={locale} />
    </AppShell></OfficerAccessGate>
  );
}
