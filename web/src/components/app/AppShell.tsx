import Link from "next/link";
import { Activity, FilePlus2, Info, ShieldCheck } from "lucide-react";
import { getDict, type Locale } from "@/i18n/dict";
import { cx } from "@/lib/format";
import { Logo } from "@/components/ui/primitives";
import { LangSwitch, ThemeToggle } from "@/components/ui/Switchers";

type Key = "assess" | "portfolio" | "models";
const ITEMS: { key: Key; Icon: typeof Info }[] = [
  { key: "assess", Icon: FilePlus2 },
  { key: "portfolio", Icon: Activity },
  { key: "models", Icon: Info },
];

export function AppShell({ locale, active, title, lead, actions, children }: { locale: Locale; active: Key; title: string; lead: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const d = getDict(locale);
  const nav = (mobile: boolean) => ITEMS.map(({ key, Icon }) => {
    const on = key === active;
    return (
      <Link key={key} href={`/${locale}/${key}`} aria-current={on ? "page" : undefined}
        className={cx("relative flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-sm transition",
          on ? "bg-white/10 font-semibold text-on-ink" : "text-on-ink-muted hover:bg-white/5 hover:text-on-ink")}>
        {on && !mobile && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-gold" aria-hidden />}
        <Icon className="size-[18px]" aria-hidden />
        {d.nav[key]}
      </Link>
    );
  });

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">{d.common.skip}</a>
      {/* desktop sidebar */}
      <aside className="relative hidden w-64 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-ink to-ink-2 p-4 lg:flex">
        <div className="pointer-events-none absolute -top-24 start-[-60px] size-64 rounded-full bg-gold/10 blur-3xl" aria-hidden />
        <Link href={`/${locale}`} className="relative mb-8 rounded-lg px-2 pt-2"><Logo name={d.brand.name} tagline={d.brand.tagline} onInk /></Link>
        <nav className="relative flex flex-col gap-1" aria-label="Main">{nav(false)}</nav>
        <div className="relative mt-auto flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
            <LangSwitch label={d.common.language} target={d.common.languageCode} onInk />
            <ThemeToggle labels={{ light: d.common.themeLight, dark: d.common.themeDark }} onInk />
          </div>
          <p className="flex gap-2 px-1 text-xs leading-relaxed text-on-ink-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
            {d.common.disclaimer}
          </p>
        </div>
      </aside>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 bg-ink lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={`/${locale}`}><Logo name={d.brand.name} onInk /></Link>
          <div className="flex items-center">
            <LangSwitch label={d.common.language} target={d.common.languageCode} onInk />
            <ThemeToggle labels={{ light: d.common.themeLight, dark: d.common.themeDark }} onInk />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="Main">{nav(true)}</nav>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-6 flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{lead}</p>
            </div>
            {actions}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
