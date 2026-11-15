import Link from "next/link";
import { FileText, ListChecks, LockKeyhole } from "lucide-react";
import { getDict, type Locale } from "@/i18n/dict";
import { cx } from "@/lib/format";
import { HAS_OFFICER } from "@/lib/site";
import { Logo } from "@/components/ui/primitives";
import { LangSwitch, ThemeToggle } from "@/components/ui/Switchers";

type Key = "apply" | "my-applications";

/** The client side: a light top bar, no officer tools. */
export function ClientShell({ locale, active, title, lead, children }: { locale: Locale; active: Key; title: string; lead: string; children: React.ReactNode }) {
  const d = getDict(locale), C = d.client;
  const items: { key: Key; label: string; Icon: typeof FileText }[] = [
    { key: "apply", label: C.navApply, Icon: FileText },
    { key: "my-applications", label: C.navMine, Icon: ListChecks },
  ];
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">{d.common.skip}</a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href={`/${locale}`} className="rounded-lg"><Logo name={d.brand.name} tagline={C.tagline} /></Link>
          <nav className="order-3 flex w-full gap-1 sm:order-none sm:ms-6 sm:w-auto" aria-label="Main">
            {items.map(({ key, label, Icon }) => (
              <Link key={key} href={`/${locale}/${key}`} aria-current={key === active ? "page" : undefined}
                className={cx("inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm transition",
                  key === active ? "bg-accent-soft font-semibold text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="size-4" aria-hidden />{label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center">
            <LangSwitch label={d.common.language} target={d.common.languageCode} />
            <ThemeToggle labels={{ light: d.common.themeLight, dark: d.common.themeDark }} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{lead}</p>
        <div className="mt-6">{children}</div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <span>{d.brand.name} · {C.tagline}</span>
          {/* staff pages live on the officer site; only the combined dev site links to them */}
          {HAS_OFFICER && <Link href={`/${locale}/inbox`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 hover:text-foreground"><LockKeyhole className="size-3.5" aria-hidden />{C.staff}</Link>}
        </div>
      </footer>
    </div>
  );
}

/** Saved on this device so the client finds their applications again (demo identity: name and mobile, no password). */
export type ClientId = { name: string; phone: string };
const KEY = "mizan-client";
export function loadClient(): ClientId | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); return v && typeof v.phone === "string" ? v : null; } catch { return null; }
}
export function saveClient(c: ClientId | null) {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* storage blocked: works for this view only */ }
}
export const phoneDigits = (p: string) => p.replace(/\D/g, "");

/** Dates in the page's language, Gregorian calendar and Western digits. */
export const fmtDate = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
