"use client";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";
import {
  api,
  ApiError,
  type ApplicantInput,
  type CustomerApplicationResult,
  type Options,
} from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { Button, Card } from "@/components/ui/primitives";

type Values = Record<
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
const INITIAL: Values = {
  age: "",
  employed: "",
  fam: "1",
  kids: "0",
  education: "",
  occupation: "",
  income: "",
  existing: "0",
  incomeType: "",
  retired: "no",
  credit: "",
  annuity: "",
  goods: "",
  contract: "",
  e1: "",
  e2: "",
  e3: "",
};
const numeric = (v: string) => (v.trim() === "" ? null : Number(v));

export function CustomerApply({ locale }: { locale: Locale }) {
  const d = getDict(locale),
    C = d.customer,
    A = d.assess;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [f, setF] = useState(INITIAL);
  const [opts, setOpts] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CustomerApplicationResult | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    api
      .options()
      .then(setOpts)
      .catch(() => setOpts(null));
  }, []);
  const set =
    (key: keyof Values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((old) => ({ ...old, [key]: e.target.value }));
  const choices = (key: keyof Options, fallback: string[]) =>
    opts?.[key]?.length ? opts[key] : fallback;
  const tr = (value: string) => d.options[value] ?? value;
  const input = (
    key: keyof Values,
    required = false,
    unit?: string,
    placeholder?: string,
  ) => (
    <label className="block text-sm font-medium">
      {A.fields[key as keyof typeof A.fields]}
      {required && " *"}
      <span className="mt-1.5 flex items-center rounded-lg bg-background ring-1 ring-border focus-within:ring-2 focus-within:ring-ring">
        <input
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
          type="number"
          inputMode="decimal"
          required={required}
          min="0"
          step="any"
          value={f[key]}
          onChange={set(key)}
          placeholder={placeholder}
        />
        {unit && (
          <span className="pe-3 text-sm text-muted-foreground">{unit}</span>
        )}
      </span>
    </label>
  );
  const select = (key: keyof Values, values: string[]) => (
    <label className="block text-sm font-medium">
      {A.fields[key as keyof typeof A.fields]}
      <select
        className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
        value={f[key]}
        onChange={set(key)}
      >
        <option value="">{A.notSet}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {tr(v)}
          </option>
        ))}
      </select>
    </label>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const applicant: ApplicantInput = {
      age_years: numeric(f.age)!,
      retired: f.retired === "yes",
      AMT_INCOME_TOTAL: numeric(f.income)!,
      AMT_CREDIT: numeric(f.credit)!,
      AMT_ANNUITY: numeric(f.annuity)!,
      AMT_GOODS_PRICE: numeric(f.goods),
      existing_monthly_obligations: numeric(f.existing) ?? 0,
      CNT_FAM_MEMBERS: numeric(f.fam),
      CNT_CHILDREN: numeric(f.kids),
      employed_years: numeric(f.employed),
      NAME_CONTRACT_TYPE: f.contract || null,
      NAME_INCOME_TYPE: f.incomeType || null,
      NAME_EDUCATION_TYPE: f.education || null,
      OCCUPATION_TYPE: f.occupation || null,
      EXT_SOURCE_1: numeric(f.e1),
      EXT_SOURCE_2: numeric(f.e2),
      EXT_SOURCE_3: numeric(f.e3),
    };
    try {
      setResult(await api.createApplication(name, phone, applicant));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      setError(
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
  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-full bg-fast-bg text-fast">
            <CheckCircle2 />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">{C.submittedTitle}</h1>
          <p className="mt-2 text-muted-foreground">{C.submittedLead}</p>
          <div className="mt-6 rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">{C.reference}</p>
            <p className="mt-1 font-mono text-xl font-semibold" dir="ltr">
              {result.reference}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {C.saveReference}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
            <span className="text-sm text-muted-foreground">
              {C.resultTitle}
            </span>
            <span className="rounded-full bg-standard-bg px-3 py-1 text-sm font-semibold text-standard">
              {C.status.new}
            </span>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{C.disclaimer}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-semibold text-accent-foreground"
              href={`/${locale}/track/?reference=${result.reference}`}
            >
              {C.track}
            </a>
            <button
              className="min-h-11 rounded-lg border border-border px-5 font-semibold"
              onClick={() => {
                setResult(null);
                setF(INITIAL);
                setName("");
                setPhone("");
                setStep(0);
              }}
            >
              {C.startNew}
            </button>
          </div>
        </Card>
      </div>
    );
  }
  const steps = [C.contact, A.sections[1], A.sections[2]];
  const canContinue =
    step === 0
      ? Boolean(
          name.trim().length >= 2 && phone.trim().length >= 7 && numeric(f.age),
        )
      : step === 1
        ? Boolean(numeric(f.income))
        : Boolean(numeric(f.credit) && numeric(f.annuity));
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">{C.applyTitle}</h1>
        <p className="mt-1 text-muted-foreground">{C.applyLead}</p>
      </div>
      <Card className="p-0">
        <ol className="flex overflow-x-auto border-b border-border px-3 pt-4 sm:px-6">
          {steps.map((label, index) => (
            <li key={label} className="min-w-[80px] flex-1">
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                className={`flex w-full flex-col items-center gap-1.5 border-b-2 px-1 pb-3 ${step === index ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${index < step ? "bg-fast-bg text-fast" : step === index ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {index < step ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="max-w-28 truncate text-[11px] font-medium">
                  {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <form onSubmit={submit} className="p-4 sm:p-6">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold">{C.contact}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  {C.name} *
                  <input
                    className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={C.nameExample}
                  />
                </label>
                <label className="text-sm font-medium">
                  {C.phone} *
                  <input
                    className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
                    required
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={C.phoneExample}
                  />
                </label>
              </div>
              <h2 className="mt-7 border-t border-border pt-6 text-lg font-semibold">
                {A.sections[0]}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {input("age", true, undefined, "35")}
                {input("employed", false, undefined, "5")}
                {input("fam", false, undefined, "2")}
                {input("kids", false, undefined, "0")}
                {select(
                  "education",
                  choices("NAME_EDUCATION_TYPE", ["Higher education"]),
                )}
                {select("occupation", choices("OCCUPATION_TYPE", ["Managers"]))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold">{A.sections[1]}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {input("income", true, d.common.sar, "15000")}
                {input("existing", false, d.common.sar, "0")}
                {select("incomeType", choices("NAME_INCOME_TYPE", ["Working"]))}
                <label className="text-sm font-medium">
                  {A.fields.retired}
                  <select
                    className="mt-1.5 h-11 w-full rounded-lg bg-background px-3 ring-1 ring-border"
                    value={f.retired}
                    onChange={set("retired")}
                  >
                    <option value="no">{A.no}</option>
                    <option value="yes">{A.yes}</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold">{A.sections[2]}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {input("credit", true, d.common.sar, "300000")}
                {input("annuity", true, d.common.sar, "5500")}
                {input("goods", false, d.common.sar, "300000")}
                {select(
                  "contract",
                  choices("NAME_CONTRACT_TYPE", ["Cash loans"]),
                )}
              </div>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mt-5 flex gap-2 rounded-lg bg-strict-bg p-4 text-sm text-strict"
            >
              <AlertCircle className="size-5 shrink-0" />
              {error}
            </div>
          )}
          <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
            {step > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep((value) => value - 1)}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {steps[step - 1]}
              </Button>
            ) : (
              <span />
            )}
            {step < 2 ? (
              <Button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((value) => value + 1)}
              >
                {steps[step + 1]}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            ) : (
              <Button disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {busy ? C.sending : C.submit}
              </Button>
            )}
          </div>
        </form>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {C.disclaimer}
      </p>
    </div>
  );
}
