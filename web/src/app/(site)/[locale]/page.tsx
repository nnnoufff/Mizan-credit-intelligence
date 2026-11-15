import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/dict";
import { Landing } from "@/components/landing/Landing";
import { ClientHome } from "@/components/landing/ClientHome";
import { SITE } from "@/lib/site";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // the client site opens on the customers' home page; the officer site (and the combined dev site) on the bank landing.
  // The landing is public; the staff sign-in comes when an officer opens the app (AppShell wraps its pages in OfficerGate).
  return SITE === "client" ? <ClientHome locale={locale} /> : <Landing locale={locale} />;
}
