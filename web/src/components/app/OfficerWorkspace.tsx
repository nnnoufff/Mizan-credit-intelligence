"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  ChevronLeft,
  LogOut,
  Loader2,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import {
  api,
  ApiError,
  type ApplicationStatus,
  type OfficerApplication,
  type OfficerApplicationSummary,
} from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { Button, Card } from "@/components/ui/primitives";
import { Results } from "@/components/app/AssessClient";
import { money } from "@/lib/format";

export const OFFICER_TOKEN_KEY = "mizan-officer-token";
export function OfficerWorkspace({ locale }: { locale: Locale }) {
  const d = getDict(locale),
    O = d.officer,
    C = d.customer;
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<OfficerApplicationSummary[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [selected, setSelected] = useState<OfficerApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alert, setAlert] = useState("");
  const previousCount = useRef<number | null>(null);
  useEffect(() => {
    setToken(sessionStorage.getItem(OFFICER_TOKEN_KEY) ?? "");
  }, []);
  const load = useCallback(
    async (auth: string, quiet = false) => {
      if (!auth) return;
      if (!quiet) setBusy(true);
      try {
        const data = await api.officerApplications(auth);
        setRows(data.applications);
        setNewCount(data.new_count);
        if (
          previousCount.current != null &&
          data.new_count > previousCount.current
        ) {
          setAlert(O.newAlert);
          window.setTimeout(() => setAlert(""), 6000);
        }
        previousCount.current = data.new_count;
        setError("");
      } catch (x) {
        if (x instanceof ApiError && x.status === 401) {
          sessionStorage.removeItem(OFFICER_TOKEN_KEY);
          setToken("");
        } else setError(O.loadError);
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [O.loadError, O.newAlert],
  );
  useEffect(() => {
    if (!token) return;
    load(token);
    const timer = window.setInterval(() => load(token, true), 15000);
    return () => window.clearInterval(timer);
  }, [token, load]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.officerLogin(password);
      sessionStorage.setItem(OFFICER_TOKEN_KEY, data.token);
      setToken(data.token);
      setPassword("");
    } catch {
      setError(O.authError);
    } finally {
      setBusy(false);
    }
  }
  async function open(reference: string) {
    setBusy(true);
    try {
      setSelected(await api.officerApplication(token, reference));
    } catch {
      setError(O.loadError);
    } finally {
      setBusy(false);
    }
  }
  function logout() {
    sessionStorage.removeItem(OFFICER_TOKEN_KEY);
    setToken("");
    setRows([]);
    setSelected(null);
    previousCount.current = null;
  }
  if (!token)
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <span className="grid size-11 place-items-center rounded-full bg-muted">
            <LockKeyhole className="size-5" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">{O.loginTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{O.passwordHint}</p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              {O.password}
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            {error && (
              <p className="flex gap-2 text-sm text-strict">
                <AlertCircle className="size-5 shrink-0" />
                {error}
              </p>
            )}
            <Button className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {O.login}
            </Button>
          </form>
        </Card>
      </div>
    );
  if (selected)
    return (
      <OfficerDetail
        locale={locale}
        item={selected}
        token={token}
        onBack={() => {
          setSelected(null);
          load(token);
        }}
        onChange={setSelected}
      />
    );
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{O.title}</h1>
          <p className="mt-1 text-muted-foreground">{O.lead}</p>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="size-4" />
          {O.logout}
        </Button>
      </div>
      {alert && (
        <div
          className="mt-5 flex items-center gap-2 rounded-lg bg-accent-soft p-4 text-accent"
          role="status"
        >
          <Bell className="size-5" />
          {alert}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-strict-bg px-3 py-1.5 font-semibold text-strict">
          <Bell className="size-4" />
          {newCount} {O.newApplications}
        </div>
        <button
          className="flex items-center gap-2 text-sm text-muted-foreground"
          onClick={() => load(token)}
        >
          <RefreshCw className="size-4" />
          {O.autoRefresh}
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-strict">{error}</p>}
      <div className="mt-5 space-y-3">
        {busy && !rows.length ? (
          <Loader2 className="mx-auto size-6 animate-spin" />
        ) : !rows.length ? (
          <Card>
            <p className="text-center text-muted-foreground">
              {O.noApplications}
            </p>
          </Card>
        ) : (
          rows.map((row) => (
            <button
              key={row.reference}
              onClick={() => open(row.reference)}
              className="grid w-full gap-3 rounded-lg bg-card p-4 text-start shadow-card ring-1 ring-border/60 transition hover:ring-accent sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-muted-foreground">
                  <bdi dir="ltr">{row.phone}</bdi> ·{" "}
                  <bdi dir="ltr">{row.reference}</bdi>
                </p>
              </div>
              <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-sm font-medium">
                {C.status[row.status]}
              </span>
              <span className="text-sm font-semibold text-accent">
                {O.open}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function OfficerDetail({
  locale,
  item,
  token,
  onBack,
  onChange,
}: {
  locale: Locale;
  item: OfficerApplication;
  token: string;
  onBack: () => void;
  onChange: (item: OfficerApplication) => void;
}) {
  const d = getDict(locale),
    O = d.officer,
    C = d.customer;
  const [status, setStatus] = useState<ApplicationStatus>(item.status);
  const [note, setNote] = useState(item.officer_note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const suggestion = item.analysis.amount_suggestion;
  const [amount, setAmount] = useState(
    String(item.proposed_amount ?? suggestion.suggested_credit ?? ""),
  );
  const [instalment, setInstalment] = useState(
    String(item.proposed_instalment ?? suggestion.suggested_instalment ?? ""),
  );
  const [score1, setScore1] = useState(String(item.applicant.EXT_SOURCE_1 ?? ""));
  const [score2, setScore2] = useState(String(item.applicant.EXT_SOURCE_2 ?? ""));
  const [score3, setScore3] = useState(String(item.applicant.EXT_SOURCE_3 ?? ""));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api.updateApplication(
        token,
        item.reference,
        status,
        note,
        status === "amount_proposed" ? Number(amount) : null,
        status === "amount_proposed" && instalment ? Number(instalment) : null,
      );
      onChange({ ...item, ...updated });
      setMessage(O.saved);
    } catch (x) {
      setMessage(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }
  async function startReview() {
    setBusy(true);
    try {
      const updated = await api.updateApplication(
        token,
        item.reference,
        "in_review",
        note,
      );
      onChange({ ...item, ...updated });
      setStatus("in_review");
    } catch (x) {
      setMessage(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }
  async function rescore() {
    setBusy(true); setMessage("");
    try {
      const value = (score: string) => score.trim() === "" ? null : Number(score);
      const updated = await api.rescoreApplication(token, item.reference, { EXT_SOURCE_1: value(score1), EXT_SOURCE_2: value(score2), EXT_SOURCE_3: value(score3) });
      onChange({ ...item, applicant: updated.applicant, analysis: updated.analysis });
      setAmount(String(updated.analysis.amount_suggestion.suggested_credit ?? ""));
      setInstalment(String(updated.analysis.amount_suggestion.suggested_instalment ?? ""));
      setMessage(O.rescored);
    } catch (x) { setMessage(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  }
  const fields: [string, React.ReactNode][] = [
    [d.customer.name, item.name],
    [
      d.customer.phone,
      <bdi key="phone" dir="ltr">
        {item.phone}
      </bdi>,
    ],
    [d.assess.fields.age, item.applicant.age_years],
    [d.assess.fields.employed, item.applicant.employed_years ?? "—"],
    [
      d.assess.fields.income,
      `${money(item.applicant.AMT_INCOME_TOTAL)} ${d.common.sar}`,
    ],
    [
      d.assess.fields.existing,
      `${money(item.applicant.existing_monthly_obligations)} ${d.common.sar}`,
    ],
    [
      d.assess.fields.credit,
      `${money(item.applicant.AMT_CREDIT)} ${d.common.sar}`,
    ],
    [
      d.assess.fields.annuity,
      `${money(item.applicant.AMT_ANNUITY)} ${d.common.sar}`,
    ],
    [
      d.assess.fields.goods,
      item.applicant.AMT_GOODS_PRICE
        ? `${money(item.applicant.AMT_GOODS_PRICE)} ${d.common.sar}`
        : "—",
    ],
    [
      d.assess.fields.contract,
      item.applicant.NAME_CONTRACT_TYPE
        ? (d.options[item.applicant.NAME_CONTRACT_TYPE] ??
          item.applicant.NAME_CONTRACT_TYPE)
        : "—",
    ],
    [
      d.assess.fields.incomeType,
      item.applicant.NAME_INCOME_TYPE
        ? (d.options[item.applicant.NAME_INCOME_TYPE] ??
          item.applicant.NAME_INCOME_TYPE)
        : "—",
    ],
    [
      d.assess.fields.occupation,
      item.applicant.OCCUPATION_TYPE
        ? (d.options[item.applicant.OCCUPATION_TYPE] ??
          item.applicant.OCCUPATION_TYPE)
        : "—",
    ],
  ];
  const reviewing = item.status !== "new";
  return (
    <div>
      <button
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-accent"
        onClick={onBack}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {O.back}
      </button>
      <Card>
        <p className="text-sm text-muted-foreground">{item.reference}</p>
        <h1 className="mt-1 text-2xl font-semibold">{O.enteredDetails}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{O.reviewHint}</p>
        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-border pb-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {!reviewing && (
          <div className="mt-6 border-t border-border pt-5">
            <Button onClick={startReview} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {O.startReview}
            </Button>
            {message && <p className="mt-3 text-sm text-strict">{message}</p>}
          </div>
        )}
      </Card>
      {reviewing && (
        <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <h2 className="mb-4 text-xl font-semibold">{O.analysis}</h2>
            <Card className="mb-5">
              <h3 className="font-semibold">{O.externalScores}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{O.externalScoresHint}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[[d.assess.fields.e1, score1, setScore1], [d.assess.fields.e2, score2, setScore2], [d.assess.fields.e3, score3, setScore3]].map(([label, value, setter]) => <label key={label as string} className="text-sm font-medium">{label as string}<input type="number" min="0" max="1" step="0.01" value={value as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 ring-1 ring-border" /></label>)}
              </div>
              <div className="mt-4 flex items-center gap-3"><Button type="button" onClick={rescore} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{O.rescore}</Button>{message === O.rescored && <span className="text-sm text-fast">{message}</span>}</div>
            </Card>
            <Results
              r={item.analysis}
              locale={locale}
              age={item.applicant.age_years}
              requestedCredit={item.applicant.AMT_CREDIT}
              requestedInstalment={item.applicant.AMT_ANNUITY}
            />
          </div>
          <Card className="xl:sticky xl:top-6">
            <h2 className="text-lg font-semibold">{O.updateTitle}</h2>
            {item.status === "in_review" ? (
              <form onSubmit={save} className="mt-5 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      "approved",
                      "amount_proposed",
                      "rejected",
                    ] as ApplicationStatus[]
                  ).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setStatus(choice)}
                      className={`min-h-11 rounded-lg border px-2 text-xs font-semibold ${status === choice ? "border-accent bg-accent-soft text-accent" : "border-border"}`}
                    >
                      {C.status[choice]}
                    </button>
                  ))}
                </div>
                {status === "amount_proposed" && (
                  <div className="space-y-3 rounded-lg bg-accent-soft p-4">
                    <p className="text-sm font-semibold">{O.proposeAmount}</p>
                    {suggestion.suggested_credit && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-accent"
                        onClick={() => {
                          setAmount(String(suggestion.suggested_credit));
                          setInstalment(
                            String(suggestion.suggested_instalment ?? ""),
                          );
                        }}
                      >
                        {O.modelSuggestion}
                      </button>
                    )}
                    <label className="block text-sm font-medium">
                      {O.proposedAmount}
                      <input
                        required
                        type="number"
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 ring-1 ring-border"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      {O.proposedInstalment}
                      <input
                        type="number"
                        min="1"
                        value={instalment}
                        onChange={(e) => setInstalment(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 ring-1 ring-border"
                      />
                    </label>
                  </div>
                )}
                <label className="block text-sm font-medium">
                  {O.note}
                  <textarea
                    className="mt-1.5 min-h-28 w-full rounded-lg bg-background p-3 ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                {message && (
                  <p className="text-sm text-muted-foreground">{message}</p>
                )}
                <Button
                  className="w-full"
                  disabled={busy || status === "in_review"}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {O.save}
                </Button>
              </form>
            ) : (
              <div className="mt-5 rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">{O.statusLabel}</p>
                <p className="mt-1 font-semibold">{C.status[item.status]}</p>
                {item.officer_note && (
                  <p className="mt-3 text-sm">{item.officer_note}</p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
