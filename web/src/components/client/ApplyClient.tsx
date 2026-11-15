"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Send } from "lucide-react";
import { api, ApiError, errorMessage, instalmentOf, type ClientApp, type Options } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { cx, money } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";
import { loadClient, phoneDigits, saveClient } from "./ClientShell";

type F = Record<"name" | "phone" | "age" | "employed" | "fam" | "kids" | "education" | "occupation" | "incomeType" | "retired" | "income" | "existing" | "credit" | "term", string>;
const EMPTY: F = { name: "", phone: "", age: "", employed: "", fam: "", kids: "", education: "", occupation: "", incomeType: "Working", retired: "no", income: "", existing: "0", credit: "", term: "48" };
const TERMS = [12, 24, 36, 48, 60, 72, 84, 96, 120];
const n = (s: string) => (s.trim() === "" ? null : Number(s));

export function ApplyClient({ locale }: { locale: Locale }) {
  const d = getDict(locale), C = d.client;
  const [f, setF] = useState<F>(EMPTY);
  const [opts, setOpts] = useState<Options | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<ClientApp | null>(null);

  useEffect(() => {
    api.options().then(setOpts).catch(() => setOpts(null));
    const c = loadClient();
    if (c) setF((s) => ({ ...s, name: c.name, phone: c.phone }));
  }, []);

  const invalid = useMemo(() => {
    const bad = new Map<keyof F, string>();
    if (f.name.trim().length < 2) bad.set("name", C.errors.name);
    const p = phoneDigits(f.phone).length; if (p < 7 || p > 15) bad.set("phone", C.errors.phone);
    const age = n(f.age); if (age == null || age < 18 || age > 100) bad.set("age", C.errors.age);
    for (const k of ["income", "credit"] as const) { const v = n(f[k]); if (v == null || !(v > 0)) bad.set(k, C.errors.amount); }
    return bad;
  }, [f, C]);

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const est = n(f.credit) && n(f.credit)! > 0 ? instalmentOf(n(f.credit)!, Number(f.term)) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid.size) { document.getElementById([...invalid.keys()][0])?.focus(); return; }
    setBusy(true); setErr(null);
    try {
      const phone = phoneDigits(f.phone);
      const r = await api.fileApplication({
        client_name: f.name.trim(), client_phone: phone, age_years: n(f.age)!, retired: f.retired === "yes",
        employed_years: n(f.employed), CNT_FAM_MEMBERS: n(f.fam), CNT_CHILDREN: n(f.kids), NAME_EDUCATION_TYPE: f.education || null,
        OCCUPATION_TYPE: f.occupation || null, NAME_INCOME_TYPE: f.incomeType || null, AMT_INCOME_TOTAL: n(f.income)!,
        existing_monthly_obligations: n(f.existing) ?? 0, AMT_CREDIT: n(f.credit)!, term_months: Number(f.term),
      });
      saveClient({ name: f.name.trim(), phone });
      setSent(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      setErr(errorMessage(x, locale, d.common.apiDown));
    } finally { setBusy(false); }
  }

  if (sent) return (
    <Card className="max-w-xl">
      <CheckCircle2 className="size-10 text-fast" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold">{C.sentTitle}</h2>
      <p className="mt-2 text-muted-foreground">{C.sentLead(sent.id)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/${locale}/my-applications`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accent-foreground transition hover:brightness-110">{C.seeMine}</Link>
      </div>
    </Card>
  );

  const tr = (v: string) => d.options[v] ?? v;
  const pick = (k: keyof Options, fallback: string[]) => (opts?.[k]?.length ? opts[k] : fallback);
  const label = (k: keyof F) => C.fields[k as keyof typeof C.fields];
  const input = (k: keyof F, o: { type?: string; unit?: string; inputMode?: "decimal" | "tel" | "text"; autoComplete?: string; help?: string } = {}) => {
    const bad = touched && invalid.has(k);
    const desc = [bad ? `${k}-err` : "", o.help ? `${k}-help` : ""].filter(Boolean).join(" ") || undefined;
    return (
      <div>
        <label htmlFor={k} className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{label(k)}</label>
        <div className={cx("flex items-center rounded-lg bg-background ring-1 transition focus-within:ring-2 focus-within:ring-ring", bad ? "ring-strict" : "ring-border")}>
          <input id={k} name={k} type={o.type ?? "number"} inputMode={o.inputMode ?? "decimal"} autoComplete={o.autoComplete} value={f[k]} onChange={set(k)}
            aria-invalid={bad || undefined} aria-describedby={desc}
            className="h-11 w-full min-w-0 bg-transparent px-3 text-base tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          {o.unit && <span className="pe-3 text-sm text-muted-foreground">{o.unit}</span>}
        </div>
        {o.help && <p id={`${k}-help`} className="mt-1.5 text-xs text-muted-foreground">{o.help}</p>}
        {bad && <p id={`${k}-err`} className="mt-1.5 text-[13px] text-strict">{invalid.get(k)}</p>}
      </div>
    );
  };
  const select = (k: keyof F, values: string[], labels?: Record<string, string>, allowEmpty = true) => (
    <div>
      <label htmlFor={k} className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{label(k)}</label>
      <div className="relative">
        <select id={k} name={k} value={f[k]} onChange={set(k)} className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-background pe-9 ps-3 text-base ring-1 ring-border outline-none transition focus:ring-2 focus:ring-ring">
          {allowEmpty && <option value="">{d.assess.notSet}</option>}
          {values.map((v) => <option key={v} value={v}>{labels?.[v] ?? tr(v)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );

  const groups = [
    [input("name", { type: "text", inputMode: "text", autoComplete: "name" }), input("phone", { type: "tel", inputMode: "tel", autoComplete: "tel", help: C.phoneHelp }),
      input("age"), input("employed"), input("fam"), input("kids"),
      select("education", pick("NAME_EDUCATION_TYPE", ["Higher education"])), select("occupation", pick("OCCUPATION_TYPE", ["Managers"]))],
    [input("income", { unit: d.common.sar }), input("existing", { unit: d.common.sar }),
      select("incomeType", pick("NAME_INCOME_TYPE", ["Working"])), select("retired", ["no", "yes"], { no: d.assess.no, yes: d.assess.yes }, false)],
    [input("credit", { unit: d.common.sar }), select("term", TERMS.map(String), Object.fromEntries(TERMS.map((t) => [String(t), `${t} ${C.months}`])), false)],
  ];

  return (
    <Card as="div" className="max-w-3xl p-0">
      <form onSubmit={submit} noValidate>
        <div className="space-y-7 p-6">
          {groups.map((fields, i) => (
            <fieldset key={i} className={cx(i > 0 && "border-t border-border pt-7")}>
              <legend className="mb-4 flex items-center gap-2.5 font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>{C.sections[i]}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">{fields.map((el, j) => <div key={j}>{el}</div>)}</div>
              {i === 2 && (
                <div className="mt-4 rounded-lg bg-accent-soft p-4" aria-live="polite">
                  <p className="font-semibold tabular">{est ? C.estimate(money(est)) : C.estimate("—")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{C.estimateNote}</p>
                </div>
              )}
            </fieldset>
          ))}
          {err && (
            <div role="alert" className="flex gap-3 rounded-lg bg-strict-bg p-4 text-strict ring-1 ring-strict/30">
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm">{err}</p>
            </div>
          )}
          <div className="border-t border-border pt-6">
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}{busy ? C.sending : C.submit}</Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
