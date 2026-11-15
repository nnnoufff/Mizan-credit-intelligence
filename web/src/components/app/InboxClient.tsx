"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Ban, Check, Gift, Inbox, Loader2, LockKeyhole, Phone, RefreshCw } from "lucide-react";
import { api, ApiError, errorMessage, instalmentOf, type Decision, type OfficerDetail, type OfficerSummary } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { cx, money, pct } from "@/lib/format";
import { Button, Card, LaneBadge } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/client/StatusBadge";
import { fmtDate } from "@/components/client/ClientShell";
import { Results } from "./AssessClient";

type Filter = "open" | "waiting" | "closed" | "all";
const IN: Record<Exclude<Filter, "all">, OfficerSummary["status"][]> = {
  open: ["submitted"], waiting: ["offered"], closed: ["approved", "rejected", "offer_accepted", "offer_declined"],
};
const KEY = "mizan-officer-code";

export function InboxClient({ locale }: { locale: Locale }) {
  const d = getDict(locale), I = d.inbox;
  const [code, setCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<OfficerSummary[] | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { try { setCode(sessionStorage.getItem(KEY)); } catch { /* storage blocked */ } setReady(true); }, []);

  const msg = useCallback((x: unknown) => errorMessage(x, locale, d.common.apiDown), [d]);
  const load = useCallback(async (c: string) => {
    setBusy(true); setErr(null);
    try { setList((await api.officerList(c)).applications); }
    catch (x) {
      if (x instanceof ApiError && x.status === 401) { try { sessionStorage.removeItem(KEY); } catch { /* */ } setCode(null); setErr(I.codeWrong); }
      else setErr(msg(x));
    } finally { setBusy(false); }
  }, [I, msg]);
  useEffect(() => { if (code) load(code); }, [code, load]);

  const shown = useMemo(() => (list ?? []).filter((a) => filter === "all" || IN[filter].includes(a.status)), [list, filter]);
  const count = (f: Filter) => (list ?? []).filter((a) => f === "all" || IN[f].includes(a.status)).length;

  if (!ready) return null;
  if (!code) return <CodeGate locale={locale} error={err} onOpen={(c) => { try { sessionStorage.setItem(KEY, c); } catch { /* */ } setCode(c); }} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label={I.title}>
          {(["open", "waiting", "closed", "all"] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={cx("inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition", filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {I.filters[f]}<span className="rounded-full bg-background px-1.5 text-xs tabular">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="ms-auto flex gap-2">
          <Button type="button" variant="secondary" className="min-h-10 px-3 text-sm" onClick={() => load(code)} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}{I.refresh}
          </Button>
          <Button type="button" variant="secondary" className="min-h-10 px-3 text-sm" onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* */ } setCode(null); setList(null); setSel(null); setErr(null); }}>
            <LockKeyhole className="size-4" aria-hidden />{I.signOut}
          </Button>
        </div>
      </div>
      {err && <div role="alert" className="flex gap-3 rounded-lg bg-strict-bg p-4 text-strict ring-1 ring-strict/30"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm">{err}</p></div>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card as="div" className="p-0">
          {list && shown.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground"><Inbox className="mx-auto mb-3 size-8" aria-hidden />{I.empty}</div>
          ) : (
            <ul className="divide-y divide-border" aria-label={I.title}>
              {shown.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setSel(a.id)} aria-current={sel === a.id ? "true" : undefined}
                    className={cx("flex w-full flex-col gap-2 px-5 py-4 text-start transition hover:bg-muted/60", sel === a.id && "bg-accent-soft hover:bg-accent-soft")}>
                    <span className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{a.client_name} <span className="font-normal text-muted-foreground">#{a.id}</span></span>
                      <StatusBadge status={a.status} label={d.statusOfficer[a.status]} />
                    </span>
                    <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="tabular">{money(a.requested_credit)} {d.common.sar}</span>
                      {a.probability_of_default != null && <span className="tabular">{I.cols.risk} <bdi dir="ltr">{pct(a.probability_of_default)}</bdi></span>}
                      {a.lane && <LaneBadge lane={a.lane} label={d.assess.lanes[a.lane]} />}
                      <span>{fmtDate(a.created_at, locale)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5 xl:sticky xl:top-6">
          {sel == null ? (
            <Card className="text-center text-sm text-muted-foreground">{I.pick}</Card>
          ) : (
            <Detail key={sel} id={sel} code={code} locale={locale} onDecided={(x) => setList((l) => l?.map((a) => (a.id === x.id ? x : a)) ?? null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function CodeGate({ locale, error, onOpen }: { locale: Locale; error: string | null; onOpen: (c: string) => void }) {
  const I = getDict(locale).inbox;
  const [v, setV] = useState("");
  return (
    <Card className="max-w-md">
      <LockKeyhole className="size-8 text-accent" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold">{I.codeTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{I.codeLead}</p>
      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onOpen(v.trim()); }}>
        <div>
          <label htmlFor="officer-code" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{I.codeLabel}</label>
          <input id="officer-code" type="password" autoComplete="current-password" value={v} onChange={(e) => setV(e.target.value)}
            aria-invalid={!!error || undefined} aria-describedby={error ? "code-err" : undefined}
            className={cx("h-11 w-full rounded-lg bg-background px-3 text-base ring-1 outline-none transition focus:ring-2 focus:ring-ring", error ? "ring-strict" : "ring-border")} />
          {error && <p id="code-err" className="mt-1.5 text-[13px] text-strict">{error}</p>}
        </div>
        <Button type="submit">{I.codeSubmit}</Button>
      </form>
    </Card>
  );
}

function Detail({ id, code, locale, onDecided }: { id: number; code: string; locale: Locale; onDecided: (a: OfficerSummary) => void }) {
  const d = getDict(locale), I = d.inbox;
  const [a, setA] = useState<OfficerDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.officerGet(code, id).then(setA).catch((x) => setErr(errorMessage(x, locale, d.common.apiDown))); }, [code, id]);

  if (err) return <div role="alert" className="rounded-lg bg-strict-bg p-4 text-sm text-strict">{err}</div>;
  if (!a) return <Card className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden /></Card>;

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{a.client_name} <span className="font-normal text-muted-foreground">#{a.id}</span></h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="size-3.5" aria-hidden />{I.contact} <bdi dir="ltr" className="tabular">{a.client_phone}</bdi></p>
          </div>
          <StatusBadge status={a.status} label={d.statusOfficer[a.status]} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {([
            [d.client.requested, `${money(a.requested_credit)} ${d.common.sar}`],
            [d.client.term, `${a.term_months} ${d.client.months}`],
            [d.client.monthly, `${money(a.requested_instalment)} ${d.common.sar}`],
            [d.assess.fields.income, `${money(a.applicant.AMT_INCOME_TOTAL)} ${d.common.sar}`],
          ] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-semibold tabular">{v}</dd></div>)}
        </dl>
        {a.model_used === "2_fallback" && <p className="mt-4 text-xs text-muted-foreground">{I.fallbackNote}</p>}
      </Card>

      {a.status === "submitted" ? <DecisionPanel a={a} code={code} locale={locale} onDone={(x) => { setA(x); onDecided(x); }} /> : <Outcome a={a} locale={locale} />}

      <Results r={a.assessment} locale={locale} age={a.applicant.age_years} />
    </>
  );
}

function Outcome({ a, locale }: { a: OfficerDetail; locale: Locale }) {
  const d = getDict(locale), I = d.inbox;
  return (
    <Card>
      <h3 className="font-semibold">{I.decisionTitle}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3"><StatusBadge status={a.status} label={d.statusOfficer[a.status]} />
        {a.offer_credit != null && <span className="font-semibold tabular">{money(a.offer_credit)} {d.common.sar} · {money(a.offer_instalment ?? 0)} {d.common.perMonth}</span>}
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {a.decided_at && <li>{I.decided(fmtDate(a.decided_at, locale))}</li>}
        {a.responded_at && <li>{I.responded(fmtDate(a.responded_at, locale))}</li>}
      </ul>
      {a.officer_note && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{a.officer_note}</p>}
    </Card>
  );
}

function DecisionPanel({ a, code, locale, onDone }: { a: OfficerDetail; code: string; locale: Locale; onDone: (x: OfficerDetail) => void }) {
  const d = getDict(locale), I = d.inbox;
  const sug = a.assessment.amount_suggestion;
  const rec: Decision["decision"] | null =
    sug.status === "suggested" ? "offer" : sug.status === "not_needed" ? "approve" : sug.status === "not_reachable" ? "reject" : null;
  const suggested = sug.status === "suggested" && sug.suggested_credit ? Math.floor(sug.suggested_credit / 1000) * 1000 : null;
  const [choice, setChoice] = useState<Decision["decision"] | null>(rec);
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const offer = Number(amount);
  const offerBad = choice === "offer" && !(offer > 0 && offer < a.requested_credit);

  async function confirm() {
    if (!choice || offerBad) { if (offerBad) setErr(I.offerTooHigh); return; }
    setBusy(true); setErr(null);
    try { onDone(await api.decide(code, a.id, { decision: choice, offer_credit: choice === "offer" ? offer : undefined, note: note.trim() || null })); }
    catch (x) { setErr(errorMessage(x, locale, d.common.apiDown)); }
    finally { setBusy(false); }
  }

  const opts: { key: Decision["decision"]; label: string; Icon: typeof Check; why: string }[] = [
    { key: "approve", label: I.approve, Icon: Check, why: I.recApprove },
    { key: "offer", label: I.offer, Icon: Gift, why: I.recOffer },
    { key: "reject", label: I.reject, Icon: Ban, why: I.recReject },
  ];

  return (
    <Card>
      <h3 className="font-semibold">{I.decisionTitle}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{I.decisionLead}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={I.decisionTitle}>
        {opts.map(({ key, label, Icon, why }) => (
          <button key={key} type="button" role="radio" aria-checked={choice === key} onClick={() => { setChoice(key); setErr(null); }}
            className={cx("flex flex-col items-start gap-2 rounded-lg p-4 text-start ring-1 transition hover:-translate-y-0.5",
              choice === key ? "bg-accent-soft ring-2 ring-accent" : "bg-card ring-border hover:ring-foreground/30")}>
            <span className="flex w-full items-center justify-between gap-2"><Icon className="size-5 text-accent" aria-hidden />{rec === key && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{I.recommended}</span>}</span>
            <span className="font-semibold">{label}</span>
            {rec === key && <span className="text-xs text-muted-foreground">{why}</span>}
          </button>
        ))}
      </div>

      {choice === "offer" && (
        <div className="mt-5">
          <label htmlFor="offer-amount" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{I.offerAmount}</label>
          <div className="flex flex-wrap items-center gap-3">
            <div className={cx("flex w-56 items-center rounded-lg bg-background ring-1 focus-within:ring-2 focus-within:ring-ring", offerBad && amount ? "ring-strict" : "ring-border")}>
              <input id="offer-amount" type="number" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(null); }}
                aria-invalid={(offerBad && !!amount) || undefined} aria-describedby="offer-help"
                className="h-11 w-full min-w-0 bg-transparent px-3 text-base tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <span className="pe-3 text-sm text-muted-foreground">{d.common.sar}</span>
            </div>
            {suggested && String(suggested) !== amount && <button type="button" onClick={() => setAmount(String(suggested))} className="min-h-10 rounded-lg px-2 text-sm text-accent underline-offset-4 hover:underline">{I.useSuggested}</button>}
          </div>
          <p id="offer-help" className="mt-1.5 text-sm text-muted-foreground tabular">{offer > 0 ? I.offerInstalment(money(instalmentOf(offer, a.term_months)), a.term_months) : "—"}</p>
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="officer-note" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{I.note}</label>
        <textarea id="officer-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
          className="w-full rounded-lg bg-background p-3 text-base ring-1 ring-border outline-none transition focus:ring-2 focus:ring-ring" />
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-strict">{err}</p>}
      <Button type="button" className="mt-5" onClick={confirm} disabled={busy || !choice}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{busy ? I.sending : I.confirm}</Button>
    </Card>
  );
}
