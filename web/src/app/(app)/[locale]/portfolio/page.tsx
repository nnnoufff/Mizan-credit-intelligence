import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/i18n/dict";
import { AppShell } from "@/components/app/AppShell";
import { PortfolioClient } from "@/components/app/PortfolioClient";
import { OfficerAccessGate } from "@/components/app/OfficerAccessGate";

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  return (
    <OfficerAccessGate locale={locale}><AppShell locale={locale} active="portfolio" title={d.portfolio.title} lead={d.portfolio.lead}>
      <PortfolioClient locale={locale} />
    </AppShell></OfficerAccessGate>
  );
}
