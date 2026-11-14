import { notFound } from "next/navigation";
import { CheckCircle2, Info } from "lucide-react";
import { getDict, isLocale } from "@/i18n/dict";
import { AppShell } from "@/components/app/AppShell";
import { Card } from "@/components/ui/primitives";
import { ServiceStatus } from "@/components/app/ServiceStatus";

export default async function ModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale), M = d.modelsPage;
  return (
    <AppShell locale={locale} active="models" title={M.title} lead={M.lead} actions={<ServiceStatus locale={locale} />}>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {d.models.map((m) => (
          <article key={m.n} className="relative overflow-hidden rounded-lg bg-card p-6 shadow-card ring-1 ring-border/60">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent to-gold" aria-hidden />
            <p className="text-[13px] font-semibold text-accent">{locale === "ar" ? `النموذج ${m.n}` : `Model ${m.n}`}</p>
            <h2 className="mt-1 text-xl font-semibold">{m.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div><dt className="text-xs text-muted-foreground">{M.auc}</dt><dd className="text-2xl font-bold text-secondary tabular">{m.auc}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{M.pr}</dt><dd className="text-2xl font-bold tabular">{m.pr}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">{M.principlesTitle}</h2>
          <ul className="mt-4 space-y-4">
            {M.principles.map(([t, desc]) => (
              <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-fast" aria-hidden /><div><p className="font-medium">{t}</p><p className="text-sm text-muted-foreground">{desc}</p></div></li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">{M.limitsTitle}</h2>
          <ul className="mt-4 space-y-3">
            {M.limits.map((t) => <li key={t} className="flex gap-3 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><span className="text-muted-foreground">{t}</span></li>)}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
