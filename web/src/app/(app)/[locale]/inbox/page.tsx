import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dict";
import { AppShell } from "@/components/app/AppShell";
import { InboxClient } from "@/components/app/InboxClient";

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const I = getDict(locale).inbox;
  return (
    <AppShell locale={locale} active="inbox" title={I.title} lead={I.lead}>
      <InboxClient locale={locale} />
    </AppShell>
  );
}
