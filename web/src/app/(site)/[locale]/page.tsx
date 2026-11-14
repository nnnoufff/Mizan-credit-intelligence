import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dict";
import { Landing } from "@/components/landing/Landing";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Landing locale={locale} />;
}
