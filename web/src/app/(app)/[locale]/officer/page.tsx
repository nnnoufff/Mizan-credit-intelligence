import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dict";
import { OfficerPortalShell } from "@/components/app/OfficerPortalShell";
import { OfficerWorkspace } from "@/components/app/OfficerWorkspace";

export default async function OfficerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <OfficerPortalShell locale={locale}><OfficerWorkspace locale={locale} /></OfficerPortalShell>;
}
