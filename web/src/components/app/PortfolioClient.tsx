"use client";
import { useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, Gauge, Loader2, Target, Upload, XCircle } from "lucide-react";
import { api, ApiError, type Contract, type EarlyWarningResult } from "@/lib/api";
import { getDict, type Locale } from "@/i18n/dict";
import { cx, pct } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/CountUp";

function parseCsv(text: string): Contract[] {
  const lines = text.trim().split(/\r?\n/);
  const head = lines.shift()!.split(",").map((h) => h.trim().toLowerCase());
  const idx = (k: string) => head.indexOf(k);
  if (idx("contract_id") < 0 || idx("dpd") < 0) throw new Error("CSV needs at least contract_id and dpd columns.");
  const by = new Map<string, Contract>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = line.split(",").map((x) => x.trim());
    const id = c[idx("contract_id")];
    const num = (k: string) => (idx(k) >= 0 && c[idx(k)] !== "" ? Number(c[idx(k)]) : null);
    if (!by.has(id)) by.set(id, { contract_id: id, history: [] });
    by.get(id)!.history.push({ dpd: num("dpd") ?? 0, dpd_def: num("dpd_def") ?? 0, inst_total: num("inst_total"), inst_left: num("inst_left") });
  }
  return [...by.values()];
}

export function PortfolioClient({ locale }: { locale: Locale }) {
  const d = getDict(locale), P = d.portfolio;
  const [rows, setRows] = useState<EarlyWarningResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function run(contracts: Contract[]) {
    setBusy(true); setErr(null);
    try { setRows((await api.earlyWarningBatch(contracts)).results); }
    catch (x) { setErr(x instanceof ApiError && x.status === 0 ? d.common.apiDown : x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try { await run(parseCsv(await f.text())); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    e.target.value = "";
  }

  const scored = rows?.filter((r) => r.status === "scored") ?? [];
  const probs = scored.map((r) => r.probability_of_arrears_3m!);
  const top = scored[0];
  const avg = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => file.current?.click()} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}{P.upload}</Button>
        <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} aria-label={P.upload} />
        <p className="text-xs text-muted-foreground">{P.csvHelp} <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 text-[11px]">contract_id, dpd, inst_total, inst_left, dpd_def?</code></p>
      </div>

      {err && (
        <div role="alert" className="flex gap-3 rounded-lg bg-strict-bg p-4 text-strict ring-1 ring-strict/30"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm">{err}</p></div>
      )}

      {!rows ? (
        <div className="relative isolate overflow-hidden rounded-lg bg-gradient-to-br from-ink to-ink-2 px-6 py-16 text-center text-on-ink shadow-float">
          <div className="absolute -top-24 start-1/2 -z-10 size-80 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" aria-hidden />
          <span className="mx-auto grid size-14 place-items-center rounded-lg bg-white/10 text-gold"><Gauge className="size-7" aria-hidden /></span>
          <p className="mt-5 text-lg font-semibold">{P.emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-on-ink-muted">{P.emptyLead}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
            <Kpi icon={<CheckCircle2 className="size-5" aria-hidden />} label={P.scored} value={<CountUp value={scored.length} />} note={P.skipped(rows.length - scored.length)} />
            <div className="rise relative isolate overflow-hidden rounded-lg bg-gradient-to-br from-ink to-ink-2 p-5 text-on-ink shadow-float">
              <div className="absolute -top-16 end-[-30px] -z-10 size-40 rounded-full bg-[#fda29b]/20 blur-2xl" aria-hidden />
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#fda29b]"><AlertTriangle className="size-5" aria-hidden /></span>
              <p className="mt-4 text-[13px] text-on-ink-muted">{P.highest}</p>
              <p className="text-3xl font-semibold text-[#fda29b] tabular">{top ? <CountUp value={top.probability_of_arrears_3m! * 100} decimals={1} suffix="%" /> : "—"}</p>
              <p className="mt-1 text-xs text-on-ink-muted">{top?.contract_id}</p>
            </div>
            <Kpi icon={<Target className="size-5" aria-hidden />} label={P.average} value={<CountUp value={avg * 100} decimals={1} suffix="%" />} note={P.across} />
            <Kpi icon={<Gauge className="size-5" aria-hidden />} label={P.accuracy} value="AUC 0.68" note={P.accuracyNote} />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4"><h2 className="font-semibold">{P.table}</h2><span className="text-xs text-muted-foreground">{P.sorted}</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] whitespace-nowrap text-sm">
                <thead className="bg-muted/60 text-start text-[13px] text-muted-foreground">
                  <tr>{P.cols.map((c) => <th key={c} scope="col" className="px-6 py-3 text-start font-semibold">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const p = r.probability_of_arrears_3m;
                    const f = r.features;
                    const tone = p == null ? "muted" : p >= 0.3 ? "strict" : p >= 0.1 ? "standard" : "fast";
                    const S = { strict: [AlertTriangle, "bg-strict-bg text-strict", "bg-strict"], standard: [Eye, "bg-standard-bg text-standard", "bg-standard"], fast: [CheckCircle2, "bg-fast-bg text-fast", "bg-fast"], muted: [XCircle, "bg-muted text-muted-foreground", ""] } as const;
                    const [Icon, badge, bar] = S[tone];
                    return (
                      <tr key={r.contract_id + i} className="border-t border-border transition hover:bg-muted/30">
                        <th scope="row" className="px-6 py-4 text-start font-semibold"><bdi dir="ltr">{r.contract_id}</bdi></th>
                        <td className="px-6 py-4">
                          {p != null ? (
                            <span className="flex items-center gap-3"><span className="h-2 w-40 overflow-hidden rounded-full bg-muted" dir="ltr" aria-hidden><span className={cx("block h-full rounded-full transition-all duration-700", bar)} style={{ width: `${Math.max(2, p * 100)}%` }} /></span><span className="font-semibold tabular">{pct(p)}</span></span>
                          ) : <span className="text-muted-foreground">{P.notScored}</span>}
                        </td>
                        <td className="px-6 py-4 tabular">{f?.dpd_max_l3 ?? 0} {P.days}</td>
                        <td className="px-6 py-4 tabular">{f?.months_on_book ?? "—"}</td>
                        <td className="px-6 py-4 tabular">{f?.inst_left ?? "—"} {P.of} {f?.inst_total ?? "—"}</td>
                        <td className="px-6 py-4"><span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold", badge)}><Icon className="size-4" aria-hidden />{P.status[r.status]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-6 py-4 text-xs text-muted-foreground">{P.note}</p>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: React.ReactNode; note: string }) {
  return (
    <Card as="div" className="rise p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent-soft to-[#c9e6e9] text-accent dark:to-accent-soft">{icon}</span>
      <p className="mt-4 text-[13px] text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}
