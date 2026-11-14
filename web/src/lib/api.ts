// Types mirror the FastAPI responses in api/main.py and src/hc_app/scoring.py.

export type Lane = "fast" | "normal" | "high_risk";

/** Calibrated PD cut-offs from models/final/manifest.json ("lanes"). */
export const LANE_CUTS = { fast: 0.02597799511002445, strict: 0.19558553034947884 };
/** Example policy value from manifest.json ("eligibility.max_age_at_maturity"), set by the bank. */
export const ELIG_MAX_AGE = 65;

export interface Factor {
  feature: string;
  label: string;
  label_ar: string | null;
  effect: "raises risk" | "lowers risk";
  contribution: number;
}

export interface AmountSuggestion {
  available: boolean;
  status: "not_needed" | "suggested" | "not_reachable" | "below_noise" | "model_unavailable";
  message?: string;
  noise_gate_applied?: boolean;
  requested_credit?: number;
  requested_instalment?: number;
  max_instalment_sama?: number;
  reduction?: number;
  suggested_credit?: number;
  suggested_instalment?: number;
  probability_of_default_suggested?: number;
  lane_suggested?: Lane;
}

export interface ScoreResult {
  probability_of_default: number;
  model_used: "1_main" | "2_fallback";
  lane: Lane;
  top_factors: Factor[];
  sama_check: { cap: number; ratio: number; within_cap: boolean; max_instalment: number };
  eligibility: { eligible: boolean; flags: string[]; approx_term_years: number; note: string };
  amount_suggestion: AmountSuggestion;
  decision_support_only: true;
}

export interface ApplicantInput {
  age_years: number;
  retired: boolean;
  AMT_INCOME_TOTAL: number;
  AMT_CREDIT: number;
  AMT_ANNUITY: number;
  AMT_GOODS_PRICE?: number | null;
  existing_monthly_obligations: number;
  CNT_FAM_MEMBERS?: number | null;
  CNT_CHILDREN?: number | null;
  employed_years?: number | null;
  NAME_CONTRACT_TYPE?: string | null;
  NAME_INCOME_TYPE?: string | null;
  NAME_EDUCATION_TYPE?: string | null;
  OCCUPATION_TYPE?: string | null;
  EXT_SOURCE_1?: number | null;
  EXT_SOURCE_2?: number | null;
  EXT_SOURCE_3?: number | null;
}

export interface MonthRecord { dpd: number; dpd_def?: number; inst_total?: number | null; inst_left?: number | null }
export interface Contract { contract_id: string; history: MonthRecord[] }
export interface EarlyWarningResult {
  contract_id: string;
  available: boolean;
  status: "scored" | "already_in_arrears" | "completed" | "model_unavailable";
  probability_of_arrears_3m?: number;
  benchmark_max_dpd_last_3m?: number;
  features?: { months_on_book: number; inst_total: number | null; inst_left: number | null; dpd_max_l3: number };
}

export type Options = Record<"NAME_CONTRACT_TYPE" | "NAME_INCOME_TYPE" | "NAME_EDUCATION_TYPE" | "NAME_FAMILY_STATUS" | "NAME_HOUSING_TYPE" | "OCCUPATION_TYPE", string[]>;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError("unreachable", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch { /* keep statusText */ }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => call<{ status: string; phase2: Record<string, boolean> }>("/health"),
  options: () => call<Options>("/options"),
  score: (a: ApplicantInput) => call<ScoreResult>("/score", { method: "POST", body: JSON.stringify(a) }),
  earlyWarningBatch: (contracts: Contract[]) =>
    call<{ results: EarlyWarningResult[] }>("/early-warning/batch", { method: "POST", body: JSON.stringify({ contracts }) }),
};
