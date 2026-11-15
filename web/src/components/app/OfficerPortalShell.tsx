import { Activity, LayoutDashboard } from "lucide-react";
import { getDict, type Locale } from "@/i18n/dict";
import { Logo } from "@/components/ui/primitives";
import { LangSwitch, ThemeToggle } from "@/components/ui/Switchers";

export function OfficerPortalShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const d = getDict(locale);
  const links = [
    ["officer", d.nav.applications, LayoutDashboard], ["portfolio", d.nav.portfolio, Activity],
  ] as const;
  return <div className="min-h-dvh bg-background lg:flex"><aside className="bg-ink p-4 text-on-ink lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col"><div className="flex items-center justify-between"><a href={`/${locale}/officer/`}><Logo name={d.brand.name} tagline={d.officer.title} onInk /></a><div className="flex lg:hidden"><LangSwitch label={d.common.language} target={d.common.languageCode} onInk /><ThemeToggle labels={{ light: d.common.themeLight, dark: d.common.themeDark }} onInk /></div></div><nav className="mt-4 flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col" aria-label={d.officer.title}>{links.map(([path, label, Icon]) => <a key={path} href={`/${locale}/${path}/`} className="flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-on-ink-muted transition hover:bg-white/10 hover:text-on-ink"><Icon className="size-[18px]" />{label}</a>)}</nav><div className="mt-auto hidden items-center justify-between rounded-lg bg-white/5 p-1 lg:flex"><LangSwitch label={d.common.language} target={d.common.languageCode} onInk /><ThemeToggle labels={{ light: d.common.themeLight, dark: d.common.themeDark }} onInk /></div></aside><main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8"><div className="mx-auto max-w-[1280px]">{children}</div></main></div>;
}
