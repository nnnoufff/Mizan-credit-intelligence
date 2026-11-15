import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dict";
import { ClientShell } from "@/components/client/ClientShell";
import { ApplyClient } from "@/components/client/ApplyClient";

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const C = getDict(locale).client;
  return (
    <ClientShell locale={locale} active="apply" title={C.applyTitle} lead={C.applyLead}>
      <ApplyClient locale={locale} />
    </ClientShell>
  );
}
