import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dict";
import { ClientShell } from "@/components/client/ClientShell";
import { MyApplicationsClient } from "@/components/client/MyApplicationsClient";

export default async function MyApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const C = getDict(locale).client;
  return (
    <ClientShell locale={locale} active="my-applications" title={C.mineTitle} lead={C.mineLead}>
      <MyApplicationsClient locale={locale} />
    </ClientShell>
  );
}
