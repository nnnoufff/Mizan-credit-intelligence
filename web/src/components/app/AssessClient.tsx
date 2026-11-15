"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Cpu,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  api,
  ApiError,
  ELIG_MAX_AGE,
  LANE_CUTS,
  type ApplicantInput,
  type Options,
  type ScoreResult,
} from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { cx, money, num, pct } from "@/lib/format";
import {
  Button,
  Card,
  LaneBadge,
  StatusPill,
} from "@/components/ui/primitives";

type FormState = Record<
  | "age"
  | "employed"
  | "fam"
  | "kids"
  | "education"
  | "occupation"
  | "income"
  | "existing"
  | "incomeType"
  | "retired"
  | "credit"
  | "annuity"
  | "goods"
  | "contract"
  | "e1"
  | "e2"
  | "e3",
  string
>;
// Example applicant (the same profile used in the design review).
const EXAMPLE: FormState = {
  age: "35",
  employed: "5",
  fam: "2",
  kids: "0",
  education: "Higher education",
  occupation: "Managers",
  income: "15000",
  existing: "0",
  incomeType: "Working",
  retired: "no",
  credit: "300000",
  annuity: "5500",
  goods: "300000",
  contract: "Cash loans",
  e1: "",
  e2: "0.6",
  e3: "",
};
const REQUIRED: (keyof FormState)[] = ["age", "income", "credit", "annuity"];
const SECTIONS: (keyof FormState)[][] = [
  ["age", "employed", "fam", "kids", "education", "occupation"],
  ["income", "existing", "incomeType", "retired"],
  ["credit", "annuity", "goods", "contract"],
  ["e1", "e2", "e3"],
];

const n = (s: string) => (s.trim() === "" ? null : Number(s));
const EXT_FIELDS: (keyof FormState)[] = ["e1", "e2", "e3"];
const MAX_TERM_MONTHS = 480; // 40 years
const MIN_AGE = 21; // example policy value, manifest.json eligibility.min_age
/** A ratio as a percentage, readable at any size (1,234.5%; anything past 999% reads "over 999%"). */
const ratioPct = (v: number) =>
  v * 100 > 999
    ? "999%+"
    : `${(v * 100).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

export function AssessClient({ locale }: { locale: Locale }) {
  const d = getDict(locale),
    A = d.assess;
  const [f, setF] = useState<FormState>(EXAMPLE);
  const [opts, setOpts] = useState<Options | null>(null);
  const [res, setRes] = useState<{ r: ScoreResult; age: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    api
      .options()
      .then(setOpts)
      .catch(() => setOpts(null));
  }, []);

  // each failing field with the reason shown under it (checked on submit, never while typing)
  const invalid = useMemo(() => {
    const bad = new Map<keyof FormState, string>();
    for (const k of REQUIRED) {
      const v = n(f[k]);
      if (v == null || !(v > 0)) bad.set(k, A.errors.required);
    }
    const age = n(f.age);
    if (age != null && (age < 18 || age > 100)) bad.set("age", A.errors.age);
    for (const k of ["e1", "e2", "e3"] as const) {
      const v = n(f[k]);
      if (v != null && (v < 0 || v > 1)) bad.set(k, A.errors.score);
    }
    // a term past 40 years means the instalment cannot repay the amount: catch it before it reaches the model
    const credit = n(f.credit),
      annuity = n(f.annuity);
    if (
      credit &&
      annuity &&
      annuity > 0 &&
      credit / annuity > MAX_TERM_MONTHS &&
      !bad.has("annuity")
    )
      bad.set("annuity", A.errors.term(Math.round(credit / annuity / 12)));
    return bad;
  }, [f, A]);

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid.size) {
      const firstInvalid = SECTIONS.findIndex((section) =>
        section.some((key) => invalid.has(key)),
      );
      if (firstInvalid >= 0) setStep(firstInvalid);
      return;
    }
    const body: ApplicantInput = {
      age_years: n(f.age)!,
      retired: f.retired === "yes",
      AMT_INCOME_TOTAL: n(f.income)!,
      AMT_CREDIT: n(f.credit)!,
      AMT_ANNUITY: n(f.annuity)!,
      AMT_GOODS_PRICE: n(f.goods),
      existing_monthly_obligations: n(f.existing) ?? 0,
      CNT_FAM_MEMBERS: n(f.fam),
      CNT_CHILDREN: n(f.kids),
      employed_years: n(f.employed),
      NAME_CONTRACT_TYPE: f.contract || null,
      NAME_INCOME_TYPE: f.incomeType || null,
      NAME_EDUCATION_TYPE: f.education || null,
      OCCUPATION_TYPE: f.occupation || null,
      EXT_SOURCE_1: n(f.e1),
      EXT_SOURCE_2: n(f.e2),
      EXT_SOURCE_3: n(f.e3),
    };
    setBusy(true);
    setErr(null);
    try {
      setRes({ r: await api.score(body), age: body.age_years });
      // results sit below the form on narrow screens: bring them into view
      if (window.innerWidth < 1280)
        requestAnimationFrame(() =>
          document
            .getElementById("results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
    } catch (x) {
      setErr(
        x instanceof ApiError && x.status === 0
          ? d.common.apiDown
          : x instanceof Error
            ? x.message
            : String(x),
      );
    } finally {
      setBusy(false);
    }
  }

  const tr = (v: string) => d.options[v] ?? v;
  const field = (
    k: keyof FormState,
    opt?: { unit?: string; step?: string; min?: number; max?: number },
  ) => {
    const bad = touched && invalid.has(k);
    return (
      <div>
        <label
          htmlFor={k}
          className="mb-1.5 block text-[13px] font-medium text-muted-foreground"
        >
          {A.fields[k as keyof typeof A.fields]}
          {REQUIRED.includes(k) && (
            <span className="text-strict" aria-hidden>
              {" "}
              *
            </span>
          )}
        </label>
        <div
          className={cx(
            "flex items-center rounded-lg bg-background ring-1 transition focus-within:ring-2 focus-within:ring-ring",
            bad ? "ring-strict" : "ring-border",
          )}
        >
          <input
            id={k}
            name={k}
            type="number"
            inputMode="decimal"
            value={f[k]}
            onChange={set(k)}
            step={opt?.step ?? "any"}
            min={opt?.min}
            max={opt?.max}
            required={REQUIRED.includes(k)}
            aria-invalid={bad || undefined}
            aria-describedby={bad ? `${k}-err` : undefined}
            placeholder={
              EXT_FIELDS.includes(k) ? "0.00" : EXAMPLE[k] || undefined
            }
            className="h-11 w-full min-w-0 bg-transparent px-3 text-base tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          {opt?.unit && (
            <span className="pe-3 text-sm text-muted-foreground">
              {opt.unit}
            </span>
          )}
        </div>
        {bad && (
          <p id={`${k}-err`} className="mt-1.5 text-[13px] text-strict">
            {invalid.get(k)}
          </p>
        )}
      </div>
    );
  };
  const select = (
    k: keyof FormState,
    values: string[],
    labels?: Record<string, string>,
  ) => (
    <div>
      <label
        htmlFor={k}
        className="mb-1.5 block text-[13px] font-medium text-muted-foreground"
      >
        {A.fields[k as keyof typeof A.fields]}
      </label>
      <div className="relative">
        <select
          id={k}
          name={k}
          value={f[k]}
          onChange={set(k)}
          className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-background pe-9 ps-3 text-base ring-1 ring-border outline-none transition focus:ring-2 focus:ring-ring"
        >
          <option value="">{A.notSet}</option>
          {values.map((v) => (
            <option key={v} value={v}>
              {labels?.[v] ?? tr(v)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    </div>
  );
  const pick = (k: keyof Options, fallback: string[]) =>
    opts?.[k]?.length ? opts[k] : fallback;
  const filled = SECTIONS.map(
    (s) => s.some((k) => f[k] !== "") && !s.some((k) => invalid.has(k)),
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,500px)_minmax(0,1fr)]">
      {/* ---------------- form ---------------- */}
      <Card as="div" className="p-0">
        <form onSubmit={submit} noValidate>
          <ol
            className="flex overflow-x-auto border-b border-border px-3 pt-4 sm:px-6"
            aria-label="Sections"
          >
            {A.sections.map((s, i) => (
              <li key={s} className="min-w-[72px] flex-1">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={step === i ? "step" : undefined}
                  className={cx(
                    "flex w-full flex-col items-center gap-1.5 border-b-2 px-1 pb-3 text-center transition",
                    step === i
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cx(
                      "grid size-7 place-items-center rounded-full text-xs font-semibold",
                      step === i
                        ? "bg-primary text-primary-foreground"
                        : filled[i]
                          ? "bg-fast-bg text-fast"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {filled[i] ? (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="max-w-28 truncate text-[11px] font-medium">
                    {s}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="p-4 sm:p-6">
            {[
              [
                field("age", { min: 18, max: 100 }),
                field("employed", { min: 0, step: "0.5" }),
                field("fam", { min: 1 }),
                field("kids", { min: 0 }),
                select(
                  "education",
                  pick("NAME_EDUCATION_TYPE", ["Higher education"]),
                ),
                select("occupation", pick("OCCUPATION_TYPE", ["Managers"])),
              ],
              [
                field("income", { unit: d.common.sar, min: 1 }),
                field("existing", { unit: d.common.sar, min: 0 }),
                select("incomeType", pick("NAME_INCOME_TYPE", ["Working"])),
                select("retired", ["no", "yes"], { no: A.no, yes: A.yes }),
              ],
              [
                field("credit", { unit: d.common.sar, min: 1 }),
                field("annuity", { unit: d.common.sar, min: 1 }),
                field("goods", { unit: d.common.sar, min: 1 }),
                select("contract", pick("NAME_CONTRACT_TYPE", ["Cash loans"])),
              ],
              [
                field("e1", { min: 0, max: 1 }),
                field("e2", { min: 0, max: 1 }),
                field("e3", { min: 0, max: 1 }),
              ],
            ].map(
              (fields, i) =>
                i === step && (
                  <fieldset key={i}>
                    <legend className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
                      <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                        {i + 1}
                      </span>
                      {A.sections[i]}
                      {i === 3 && (
                        <span className="text-xs font-normal text-muted-foreground">
                          · {A.optional}
                        </span>
                      )}
                    </legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {fields.map((el, j) => (
                        <div key={j}>{el}</div>
                      ))}
                    </div>
                    {i === 3 && (
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        {A.extNote}
                      </p>
                    )}
                  </fieldset>
                ),
            )}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <div className="flex gap-2">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={A.sections[step - 1]}
                    onClick={() => setStep((s) => s - 1)}
                  >
                    <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                    <span className="hidden sm:inline">
                      {A.sections[step - 1]}
                    </span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={A.reset}
                  onClick={() => {
                    setF(EXAMPLE);
                    setRes(null);
                    setErr(null);
                    setTouched(false);
                    setStep(0);
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{A.reset}</span>
                </Button>
              </div>
              {step < SECTIONS.length - 1 ? (
                <Button type="button" onClick={() => setStep((s) => s + 1)}>
                  {A.sections[step + 1]}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Button>
              ) : (
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  {busy ? d.common.loading : A.submit}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>

      {/* ---------------- results ---------------- */}
      <div
        id="results"
        className="scroll-mt-28 space-y-5 xl:sticky xl:top-6"
        aria-live="polite"
      >
        {err && (
          <div
            role="alert"
            className="flex gap-3 rounded-lg bg-strict-bg p-4 text-strict ring-1 ring-strict/30"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{A.errorTitle}</p>
              <p className="mt-1 text-sm">{err}</p>
            </div>
          </div>
        )}
        {!res ? (
          <EmptyResults locale={locale} />
        ) : (
          <Results r={res.r} locale={locale} age={res.age} />
        )}
      </div>
    </div>
  );
}

function EmptyResults({ locale }: { locale: Locale }) {
  const A = getDict(locale).assess;
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center sm:p-12">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Check className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-semibold">{A.emptyTitle}</p>
      <p className="mx-auto mt-1 max-w-sm text-center text-sm text-muted-foreground">
        {A.emptyLead}
      </p>
    </div>
  );
}

export function Results({
  r,
  locale,
  age,
  requestedCredit,
  requestedInstalment,
}: {
  r: ScoreResult;
  locale: Locale;
  age: number;
  requestedCredit?: number;
  requestedInstalment?: number;
}) {
  const d = getDict(locale),
    A = d.assess;
  const s = r.sama_check,
    e = r.eligibility,
    sug = r.amount_suggestion;
  const ageEnd = e.approx_term_years || 0;
  const factors = r.top_factors;
  const maxAbs = Math.max(
    ...factors.map((x) => Math.abs(x.contribution)),
    0.0001,
  );

  return (
    <div className="space-y-5">
      {/* risk hero card */}
      <section
        className="rounded-lg bg-ink p-5 text-on-ink shadow-card sm:p-6"
        aria-labelledby="risk-h"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <h2 id="risk-h" className="font-semibold">
            {A.pd}
          </h2>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
            <Cpu className="size-4 text-gold" aria-hidden />
            <span>
              <span className="block text-on-ink-muted">{A.modelUsed}</span>
              <span className="font-semibold">
                {r.model_used === "1_main" ? A.model1 : A.model2}
              </span>
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-on-ink-muted">{A.lanes[r.lane]}</p>
            <div className="mt-2">
              <LaneBadge lane={r.lane} label={A.lanes[r.lane]} size="lg" />
            </div>
            <p className="mt-3 text-sm text-on-ink-muted">
              {A.laneExplain[r.lane]}
            </p>
          </div>
          <div className="sm:border-s sm:border-white/10 sm:ps-5">
            <p className="text-5xl font-semibold tabular" dir="ltr">
              {pct(r.probability_of_default)}
            </p>
            <p className="text-on-ink">
              {A.pdExplain(num(r.probability_of_default * 100, 0))}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              <li className="rounded-full bg-[#6ce9a6]/15 px-2.5 py-1 font-medium text-[#6ce9a6]">
                {A.fastCut} <bdi dir="ltr">≤ {pct(LANE_CUTS.fast)}</bdi>
              </li>
              <li className="rounded-full bg-[#fda29b]/15 px-2.5 py-1 font-medium text-[#fda29b]">
                {A.strictCut} <bdi dir="ltr">≥ {pct(LANE_CUTS.strict)}</bdi>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* SAMA + eligibility */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{A.sama}</h3>
            <StatusPill
              ok={s.within_cap}
              label={s.within_cap ? A.samaOk : A.samaBad}
            />
          </div>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tabular" dir="ltr">
              {ratioPct(s.ratio)}
            </span>
            <span className="text-sm text-muted-foreground">
              {A.ofSalary} · {A.cap} {pct(s.cap)}
            </span>
          </p>
          <div
            className="relative mt-4 h-2.5 rounded-full bg-muted"
            dir="ltr"
            aria-hidden
          >
            <div
              className={cx(
                "h-full rounded-full transition-all duration-700",
                s.within_cap ? "bg-fast" : "bg-strict",
              )}
              style={{ width: `${Math.min(100, (s.ratio / 0.5) * 100)}%` }}
            />
            <div
              className="absolute -top-1.5 h-5 w-0.5 rounded bg-foreground"
              style={{ left: `${(s.cap / 0.5) * 100}%` }}
            />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {A.samaMax(money(s.max_instalment))}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{A.elig}</h3>
            <StatusPill
              ok={e.eligible}
              label={e.eligible ? A.eligOk : A.eligBad}
            />
          </div>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tabular">
              {num(age + ageEnd, 1)}
            </span>
            <span className="text-sm text-muted-foreground">
              {A.atMaturity} · {A.limit} {ELIG_MAX_AGE}
            </span>
          </p>
          {/* the API's flags are English; the same two rules are worded here in the page's language */}
          {!e.eligible && (
            <ul className="mt-3 space-y-1 text-sm text-strict">
              {age < MIN_AGE && <li>{A.eligYoung(MIN_AGE)}</li>}
              {age + ageEnd > ELIG_MAX_AGE && (
                <li>{A.eligOld(ELIG_MAX_AGE)}</li>
              )}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted-foreground">{A.eligNote}</p>
        </Card>
      </div>

      {/* amount suggestion */}
      <section
          className={cx(
            "rounded-lg p-6 shadow-card ring-1",
            sug.status === "suggested"
              ? "bg-accent-soft ring-accent/40"
              : "bg-card ring-border/60",
          )}
        >
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-accent/20">
              <Lightbulb className="size-4" aria-hidden />
            </span>
            {A.sugTitle}
          </h3>
          {sug.status === "suggested" ? (
            <>
              <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl bg-card p-4 ring-1 ring-border">
                  <p className="text-[13px] text-muted-foreground">
                    {A.before} · {A.requested}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular">
                    {money(sug.requested_credit ?? requestedCredit ?? 0)} {d.common.sar}
                  </p>
                  <p className="text-sm text-muted-foreground tabular">
                    {money(sug.requested_instalment ?? requestedInstalment ?? 0)} {d.common.perMonth}
                  </p>
                </div>
                <ArrowRight
                  className="mx-auto size-6 rotate-90 text-accent sm:rotate-0 sm:rtl:rotate-180"
                  aria-hidden
                />
                <div className="rounded-xl bg-card p-4 ring-2 ring-accent">
                  <p className="text-[13px] text-muted-foreground">
                    {A.after} · {A.suggested}{" "}
                    <span dir="ltr">(−{pct(sug.reduction!, 0)})</span>
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular">
                    {money(sug.suggested_credit!)} {d.common.sar}
                  </p>
                  <p className="text-sm text-muted-foreground tabular">
                    {money(sug.suggested_instalment!)} {d.common.perMonth}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm">
                {A.sugText(
                  pct(sug.reduction!, 0),
                  `${pct(sug.probability_of_default_suggested!)} (${A.lanes[sug.lane_suggested!]})`,
                )}
              </p>
            </>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-[13px] text-muted-foreground">{A.requested}</p>
                <p className="mt-1 text-xl font-semibold">{money(sug.requested_credit ?? requestedCredit ?? 0)} {d.common.sar}</p>
                <p className="text-sm text-muted-foreground">{money(sug.requested_instalment ?? requestedInstalment ?? 0)} {d.common.perMonth}</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-[13px] text-muted-foreground">{A.maxAllowedInstalment}</p>
                <p className="mt-1 text-xl font-semibold">{money(sug.max_instalment_sama ?? s.max_instalment)} {d.common.sar}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.max_instalment <= 0 ? A.existingOverCap : A.noSuggestionReason}</p>
              </div>
            </div>
          )}
          {sug.noise_gate_applied === false && sug.status === "suggested" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {A.noiseGateOff}
            </p>
          )}
        </section>

      {/* factors */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{A.factorsTitle}</h3>
          <span className="text-xs text-muted-foreground">{A.factorsTop}</span>
        </div>
        <ul className="mt-5 space-y-4">
          {factors.map((x) => {
            const up = x.contribution > 0,
              w = Math.max(4, (Math.abs(x.contribution) / maxAbs) * 100);
            return (
              <li
                key={x.feature}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_200px_auto]"
              >
                <span className="text-sm">
                  {(locale === "ar" &&
                    (x.label_ar || d.factorLabels[x.feature])) ||
                    x.label}
                </span>
                <span
                  className="col-span-2 row-start-2 flex h-2.5 sm:col-span-1 sm:row-start-auto"
                  dir="ltr"
                  aria-hidden
                >
                  <span className="flex flex-1 justify-end">
                    {!up && (
                      <span
                        className="h-full rounded-s-full bg-fast transition-all duration-700"
                        style={{ width: `${w}%` }}
                      />
                    )}
                  </span>
                  <span className="w-px bg-border" />
                  <span className="flex flex-1">
                    {up && (
                      <span
                        className="h-full rounded-e-full bg-strict transition-all duration-700"
                        style={{ width: `${w}%` }}
                      />
                    )}
                  </span>
                </span>
                <span
                  className={cx(
                    "flex items-center gap-1 justify-self-end text-[13px] font-medium",
                    up ? "text-strict" : "text-fast",
                  )}
                >
                  {up ? (
                    <ArrowUp className="size-3.5" aria-hidden />
                  ) : (
                    <ArrowDown className="size-3.5" aria-hidden />
                  )}
                  {up ? A.raises : A.lowers}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          {A.factorsNote}
        </p>
      </Card>
    </div>
  );
}
