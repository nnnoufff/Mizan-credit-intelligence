import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { LOCALES, dirOf, isLocale } from "@/i18n/dict";
import { getLanding } from "@/i18n/landing";

/*
  The landing pages: built with the taste-skill kit (web/public/assets), not Tailwind, so they have a root
  layout of their own. Deal: software, hero split, palette cool-white-slate, type familjen, radius sharp,
  nav-mega, close-word, footer-statement, dark-band, buttons solid, mark arc, ground sky,
  effect silk-folds (hero frame), moment letters-assemble (English only: it splits letters, and Arabic letters join).
  The kit's module scripts run after React has hydrated (lazyOnload), because they add to the page's DOM.
*/

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getLanding(isLocale(locale) ? locale : "en");
  return {
    // the public address, set as SITE_URL on the host (Vercel), so share images resolve
    metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
    title: t.title,
    description: t.description,
    icons: { icon: { url: "/landing/favicon.svg", type: "image/svg+xml" } },
    openGraph: { type: "website", title: t.title, description: t.ogDescription, images: ["/landing/share.jpg"] },
    twitter: { card: "summary_large_image" },
    alternates: { languages: { en: "/en", ar: "/ar" } },
    other: { "site-kind": "software", "page-type": "software" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f9fa" };

const KIT_CSS = [
  "/assets/system.css", "/assets/ui/cards.css", "/assets/motion/motion.css", "/assets/backgrounds/backgrounds.css",
  "/assets/layout/layout.css", "/assets/icons/icon.css", "/assets/ui/base.css", "/assets/ui/window/fragment.css",
  "/assets/diagrams/diagram.css",
];

const tokens = (ar: boolean) => `:root {
  --p-bg: #f7f9fa; --p-surface: #ecf0f2; --p-ink: #1f3038; --p-muted: #5d6b72;
  --p-accent: #0d7480; --p-accent-ink: #ffffff; --p-action: #0d7480; --p-action-ink: #ffffff;
  --p-inv-bg: #1f3038; --p-inv-surface: #2c3c44; --p-inv-ink: #f7f9fa; --p-inv-muted: #9ea7ab;
  --p-inv-accent: #f7f9fa; --p-inv-accent-ink: #1f3038; --p-inv-action: #f7f9fa; --p-inv-action-ink: #1f3038;
  --font-display: ${ar ? '"IBM Plex Sans Arabic", ' : ""}"Familjen Grotesk", system-ui, sans-serif;
  --font-text: ${ar ? '"IBM Plex Sans Arabic", ' : ""}"Familjen Grotesk", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --display-weight: 400;
  --display-tracking: ${ar ? "0" : "-0.03em"};
  --display-tracking-xl: ${ar ? "0" : "-0.04em"};
}`;

const FONTS_EN = "https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400..700&family=IBM+Plex+Mono:wght@400;500&display=swap";
const FONTS_AR = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Familjen+Grotesk:wght@400..700&family=IBM+Plex+Mono:wght@400;500&display=swap";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  return (
    <html lang={locale} dir={dirOf(locale)} data-type="software" data-radius="sharp" data-ground="sky" data-buttons="solid" data-motion="" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={ar ? FONTS_AR : FONTS_EN} />
        {KIT_CSS.map((h) => <link key={h} rel="stylesheet" href={h} />)}
        {!ar && <link rel="stylesheet" href="/assets/moments/letters-assemble/moment.css" />}
        <link rel="stylesheet" href="/landing/landing.css" />
        <style dangerouslySetInnerHTML={{ __html: tokens(ar) }} />
        {/* the hero's entrance and the moments' guard, set before the first paint (motion.md, moments.md) */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700);document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)" }} />
        <script src="/assets/backgrounds/backgrounds.js" />
      </head>
      <body>
        {children}
        <Script src="/assets/system.js" type="module" strategy="lazyOnload" />
        <Script src="/assets/motion/motion.js" type="module" strategy="lazyOnload" />
        <Script src="/assets/layout/layout.js" type="module" strategy="lazyOnload" />
        <Script src="/assets/diagrams/mount.js" type="module" strategy="lazyOnload" />
      </body>
    </html>
  );
}
