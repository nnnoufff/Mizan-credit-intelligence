"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Inbox, Loader2, RefreshCw } from "lucide-react";
import { api, ApiError, errorMessage, type ClientApp } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { cx, money } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";
import { fmtDate, loadClient, phoneDigits, saveClient, type ClientId } from "./ClientShell";
import { StatusBadge } from "./StatusBadge";

export function MyApplicationsClient({ locale }: { locale: Locale }) {
  const d = getDict(locale), C = d.client;
  const [who, setWho] = useState<ClientId | null>(null);
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<ClientApp[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneBad, setPhoneBad] = useState(false);

  useEffect(() => { setWho(loadClient()); setReady(true); }, []);

  const load = useCallback(async (p: string) => {
    setBusy(true); setErr(null);
    try { setList((await api.myApplications(p)).applications); }
    catch (x) { setErr(errorMessage(x, locale, d.common.apiDown)); }
    finally { setBusy(false); }
  }, [d]);
  useEffect(() => { if (who) load(who.phone); }, [who, load]);

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    const p = phoneDigits(phone);
    if (p.length < 7 || p.length > 15) { setPhoneBad(true); return; }
    const c = { name: who?.name ?? "", phone: p };
    saveClient(c); setWho(c);
  };
  const replace = (a: ClientApp) => setList((l) => l?.map((x) => (x.id === a.id ? a : x)) ?? null);

  if (!ready) return null;
  if (!who) return (
    <Card className="max-w-md">
      <form onSubmit={lookup} noValidate className="space-y-4">
        <div>
          <label htmlFor="lookup-phone" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{C.fields.phone}</label>
          <input id="lookup-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneBad(false); }}
            aria-invalid={phoneBad || undefined} aria-describedby={phoneBad ? "lookup-err" : "lookup-help"}
            className={cx("h-11 w-full rounded-lg bg-background px-3 text-base tabular ring-1 outline-none transition focus:ring-2 focus:ring-ring", phoneBad ? "ring-strict" : "ring-border")} />
          {phoneBad ? <p id="lookup-err" className="mt-1.5 text-[13px] text-strict">{C.errors.phone}</p> : <p id="lookup-help" className="mt-1.5 text-xs text-muted-foreground">{C.phoneHelp}</p>}
        </div>
        <Button type="submit">{C.lookup}</Button>
      </form>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">{C.who}</span>
        <bdi dir="ltr" className="font-semibold tabular">{who.phone}</bdi>
        <button type="button" onClick={() => { saveClient(null); setWho(null); setList(null); setPhone(""); }} className="min-h-10 rounded-lg px-2 text-accent underline-offset-4 hover:underline">{C.change}</button>
        <Button type="button" variant="secondary" className="ms-auto min-h-10 px-3 text-sm" onClick={() => load(who.phone)} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}{C.refresh}
        </Button>
      </div>
      {err && <div role="alert" className="flex gap-3 rounded-lg bg-strict-bg p-4 text-strict ring-1 ring-strict/30"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm">{err}</p></div>}
      {list && list.length === 0 && (
        <Card className="text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-semibold">{C.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{C.emptyLead}</p>
          <Link href={`/${locale}/apply`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accent-foreground transition hover:brightness-110">{C.applyNow}</Link>
        </Card>
      )}
      {list?.map((a) => <AppCard key={a.id} a={a} locale={locale} phone={who.phone} onChange={replace} />)}
    </div>
  );
}

function AppCard({ a, locale, phone, onChange }: { a: ClientApp; locale: Locale; phone: string; onChange: (a: ClientApp) => void }) {
  const d = getDict(locale), C = d.client;
  const [ask, setAsk] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function answer(accept: boolean) {
    setBusy(true); setErr(null);
    try { onChange(await api.respond(a.id, phone, accept)); setAsk(null); }
    catch (x) { setErr(errorMessage(x, locale, d.common.apiDown)); }
    finally { setBusy(false); }
  }

  const facts: [string, string][] = [
    [C.requested, `${money(a.requested_credit)} ${d.common.sar}`],
    [C.term, `${a.term_months} ${C.months}`],
    [C.monthly, `${money(a.requested_instalment)} ${d.common.sar}`],
    [C.filed, fmtDate(a.created_at, locale)],
  ];

  return (
    <Card as="article" className="space-y-4" aria-labelledby={`app-${a.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`app-${a.id}`} className="font-semibold">#{a.id}</h2>
        <StatusBadge status={a.status} label={d.status[a.status]} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {facts.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-semibold tabular">{v}</dd></div>)}
      </dl>

      {a.status === "offered" && a.offer_credit != null ? (
        <section className="rounded-lg bg-accent-soft p-5 ring-1 ring-accent/30">
          <h3 className="font-semibold">{C.offerTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{C.offerLead}</p>
          <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <p className="text-[13px] text-muted-foreground">{C.requested}</p>
              <p className="mt-1 text-lg font-semibold tabular text-muted-foreground line-through decoration-strict decoration-2">{money(a.requested_credit)} {d.common.sar}</p>
            </div>
            <ArrowRight className="mx-auto size-6 rotate-90 text-accent sm:rotate-0 sm:rtl:rotate-180" aria-hidden />
            <div className="rounded-xl bg-card p-4 ring-2 ring-accent">
              <p className="text-[13px] text-muted-foreground">{C.offered}</p>
              <p className="mt-1 text-xl font-semibold tabular">{money(a.offer_credit)} {d.common.sar}</p>
              <p className="text-sm text-muted-foreground tabular">{money(a.offer_instalment ?? 0)} {d.common.perMonth} · {a.term_months} {C.months}</p>
            </div>
          </div>
          {ask === null ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={() => setAsk(true)}>{C.accept}</Button>
              <Button type="button" variant="secondary" onClick={() => setAsk(false)}>{C.decline}</Button>
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-card p-4 ring-1 ring-border" role="group" aria-label={ask ? C.confirmAccept : C.confirmDecline}>
              <p className="font-semibold">{ask ? C.confirmAccept : C.confirmDecline}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button type="button" onClick={() => answer(ask)} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{C.confirm}</Button>
                <Button type="button" variant="secondary" onClick={() => setAsk(null)} disabled={busy}>{C.cancel}</Button>
              </div>
            </div>
          )}
          {err && <p role="alert" className="mt-3 text-sm text-strict">{err}</p>}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {a.status !== "offered" && C.msg[a.status as keyof typeof C.msg]}
          {a.status === "offer_accepted" && a.offer_credit != null && <> <span className="font-semibold text-foreground tabular">{money(a.offer_credit)} {d.common.sar}</span></>}
        </p>
      )}
    </Card>
  );
}
