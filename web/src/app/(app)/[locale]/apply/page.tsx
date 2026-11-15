import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dict";
import { PortalShell } from "@/components/app/PortalShell";
import { CustomerApply } from "@/components/app/CustomerApply";

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PortalShell locale={locale}><CustomerApply locale={locale} /></PortalShell>;
}
