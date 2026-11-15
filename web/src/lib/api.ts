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

/** The API answers in English; these are the messages a person can meet, in Arabic. */
const AR_ERRORS: Record<string, string> = {
  "Application not found.": "لم يُعثر على الطلب.",
  "Wrong officer passcode.": "الرمز غير صحيح.",
  "There is no open offer on this application.": "لا يوجد عرض بانتظار الرد على هذا الطلب.",
  "This application already has a decision.": "صدر قرار بشأن هذا الطلب مسبقًا.",
  "The offer must be an amount below the requested amount.": "يجب أن يكون مبلغ العرض أقل من المبلغ المطلوب.",
  "Write a phone number of 7 to 15 digits.": "يرجى إدخال رقم جوال من 7 إلى 15 رقمًا.",
};
const EN_INVALID = "Some details are not valid. Check the form and try again.";
const AR_INVALID = "بعض البيانات غير صحيحة. يرجى مراجعة النموذج والمحاولة مرة أخرى.";

/** A message for the person on the page, in the page's language. */
export function errorMessage(x: unknown, locale: "en" | "ar", apiDown: string): string {
  if (x instanceof ApiError) {
    if (x.status === 0) return apiDown;
    const known = AR_ERRORS[x.message];
    if (known) return locale === "ar" ? known : x.message;
    if (x.status === 422) return locale === "ar" ? AR_INVALID : EN_INVALID;   // field validation details from FastAPI
    return locale === "ar" ? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." : x.message;
  }
  return x instanceof Error ? x.message : String(x);
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

// ---------------- client applications (api/applications.py)
export type AppStatus = "submitted" | "approved" | "rejected" | "offered" | "offer_accepted" | "offer_declined";

/** What the client sees: no risk estimate, no officer note. */
export interface ClientApp {
  id: number;
  created_at: string;
  updated_at: string;
  client_name: string;
  status: AppStatus;
  requested_credit: number;
  term_months: number;
  requested_instalment: number;
  offer_credit: number | null;
  offer_instalment: number | null;
  decided_at: string | null;
  responded_at: string | null;
}

export interface ClientApplicationInput {
  client_name: string;
  client_phone: string;
  age_years: number;
  retired: boolean;
  employed_years?: number | null;
  CNT_FAM_MEMBERS?: number | null;
  CNT_CHILDREN?: number | null;
  NAME_EDUCATION_TYPE?: string | null;
  OCCUPATION_TYPE?: string | null;
  NAME_INCOME_TYPE?: string | null;
  AMT_INCOME_TOTAL: number;
  existing_monthly_obligations: number;
  AMT_CREDIT: number;
  term_months: number;
}

export interface OfficerSummary extends ClientApp {
  client_phone: string;
  probability_of_default: number | null;
  lane: Lane | null;
  model_used: ScoreResult["model_used"] | null;
  within_cap: boolean | null;
  eligible: boolean | null;
  suggested_credit: number | null;
}

export interface OfficerDetail extends OfficerSummary {
  officer_note: string | null;
  applicant: ApplicantInput;
  assessment: ScoreResult;
}

export interface Decision { decision: "approve" | "offer" | "reject"; offer_credit?: number; note?: string | null }

/** Example policy value, the same as MIZAN_PROFIT_RATE in api/applications.py: flat annual profit rate. */
export const PROFIT_RATE = 0.05;
export const instalmentOf = (credit: number, months: number) => (credit * (1 + PROFIT_RATE * months / 12)) / months;

const officerHeaders = (code: string) => ({ "X-Officer-Code": code });

export const api = {
  fileApplication: (a: ClientApplicationInput) => call<ClientApp>("/applications", { method: "POST", body: JSON.stringify(a) }),
  myApplications: (phone: string) => call<{ applications: ClientApp[] }>(`/applications?phone=${encodeURIComponent(phone)}`),
  respond: (id: number, phone: string, accept: boolean) =>
    call<ClientApp>(`/applications/${id}/respond`, { method: "POST", body: JSON.stringify({ client_phone: phone, accept }) }),
  officerList: (code: string) => call<{ applications: OfficerSummary[] }>("/officer/applications", { headers: officerHeaders(code) }),
  officerGet: (code: string, id: number) => call<OfficerDetail>(`/officer/applications/${id}`, { headers: officerHeaders(code) }),
  decide: (code: string, id: number, d: Decision) =>
    call<OfficerDetail>(`/officer/applications/${id}/decision`, { method: "POST", headers: officerHeaders(code), body: JSON.stringify(d) }),
  health: () => call<{ status: string; phase2: Record<string, boolean> }>("/health"),
  options: () => call<Options>("/options"),
  score: (a: ApplicantInput) => call<ScoreResult>("/score", { method: "POST", body: JSON.stringify(a) }),
  earlyWarningBatch: (contracts: Contract[]) =>
    call<{ results: EarlyWarningResult[] }>("/early-warning/batch", { method: "POST", body: JSON.stringify({ contracts }) }),
};
