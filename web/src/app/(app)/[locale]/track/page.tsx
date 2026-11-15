import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dict";
import { PortalShell } from "@/components/app/PortalShell";
import { CustomerTrack } from "@/components/app/CustomerTrack";

export default async function TrackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PortalShell locale={locale}><Suspense><CustomerTrack locale={locale} /></Suspense></PortalShell>;
}
