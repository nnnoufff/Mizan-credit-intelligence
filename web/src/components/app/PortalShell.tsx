import { getDict, type Locale } from "@/i18n/dict";
import { Logo } from "@/components/ui/primitives";
import { LangSwitch, ThemeToggle } from "@/components/ui/Switchers";

export function PortalShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const d = getDict(locale);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href={`/${locale}/apply/`}><Logo name={d.brand.name} tagline={d.brand.tagline} /></a>
          <div className="flex items-center gap-1">
            <a className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted sm:block" href={`/${locale}/apply/`}>{d.customer.applyTitle}</a>
            <a className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted sm:block" href={`/${locale}/track/`}>{d.customer.track}</a>
            <LangSwitch label={d.common.language} target={d.common.languageCode} />
            <ThemeToggle labels={{ light: d.common.themeLight, dark: d.common.themeDark }} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
