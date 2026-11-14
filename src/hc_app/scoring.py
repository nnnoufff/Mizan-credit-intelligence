"""Scoring logic shared by the FastAPI service and the Streamlit app.

Loads the bundle produced by the training notebook (`home_credit_runs/final/`):
manifest.json, the final model pickles and the two probability calibrators.
"""
from __future__ import annotations

import json
import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

EXT = ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]

# Fields a user can enter by hand. Everything else the models use (bureau, previous-loan and payment history aggregates)
# is not known for a brand-new applicant and is left missing; the gradient-boosting models handle missing values natively.
MANUAL_FIELDS = [
    "AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY", "AMT_GOODS_PRICE", "CNT_FAM_MEMBERS", "CNT_CHILDREN",
    "NAME_CONTRACT_TYPE", "NAME_INCOME_TYPE", "NAME_EDUCATION_TYPE", "NAME_FAMILY_STATUS", "NAME_HOUSING_TYPE",
    "OCCUPATION_TYPE", "FLAG_OWN_CAR", "FLAG_OWN_REALTY", "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3",
]

# Readable English names for the factors shown to the user (fallback: the column name made readable).
LABELS_EN = {
    "EXT_SOURCE_1": "External credit score 1", "EXT_SOURCE_2": "External credit score 2", "EXT_SOURCE_3": "External credit score 3",
    "AMT_ANNUITY": "Monthly instalment", "AMT_CREDIT": "Credit amount", "AMT_GOODS_PRICE": "Goods price", "AMT_INCOME_TOTAL": "Income",
    "aff_credit_to_goods": "Credit relative to goods price", "aff_credit_to_annuity_term": "Approximate loan term (credit / instalment)",
    "aff_annuity_to_income": "Instalment relative to income", "aff_credit_to_income": "Credit relative to income",
    "ORGANIZATION_TYPE": "Employer type", "OCCUPATION_TYPE": "Occupation", "NAME_EDUCATION_TYPE": "Education", "NAME_INCOME_TYPE": "Income type",
    "DAYS_EMPLOYED": "Time in current job", "DAYS_REGISTRATION": "Time since registration change", "DAYS_ID_PUBLISH": "Time since ID document change",
    "DAYS_LAST_PHONE_CHANGE": "Time since last phone change", "OWN_CAR_AGE": "Car age", "REGION_RATING_CLIENT_W_CITY": "Region rating",
    "prev_mean_annuity_approved": "Average instalment on previous loans", "prev_mean_term_months": "Average term of previous loans",
    "prev_refusal_rate": "Share of previous applications refused", "hc_active_remaining_scheduled": "Remaining payments on active Home Credit loans",
    "inst_late_rate_all": "Share of late previous instalments", "bur_active_debt_to_credit": "Active bureau debt relative to credit limit",
    "cc_util_mean_all": "Average credit-card utilisation",
}


def readable(feature: str) -> str:
    if feature in LABELS_EN:
        return LABELS_EN[feature]
    return feature.replace("aff_", "").replace("bb_", "bureau balance ").replace("_", " ").strip().capitalize()


class Scorer:
    def __init__(self, folder: str | Path):
        self.folder = Path(folder)
        self.man = json.loads((self.folder / "manifest.json").read_text(encoding="utf-8"))
        self.levels = self.man["categorical_levels"]
        self.models = {t: [(a, self._load(self.folder / f"{t}__{a}.pkl")) for a in algos]
                       for t, algos in self.man["final_models"].items() if t in ("1_main", "2_fallback")}
        self.cal = {k: self._load(self.folder / v) for k, v in self.man["calibrators"].items()}
        self.labels = self.man.get("arabic_labels", {})
        self.version_warnings = self._check_versions()
        # Phase 2 models (optional: the service still works without them)
        self.mono = self._load_optional("3_monotone", "lightgbm")
        self.ew = self._load_optional("4_early_warning", "lightgbm")
        self.mono_folds = self._load_fold_models(self.man.get("amount_suggestion", {}).get("fold_models", []))

    def _load_optional(self, task: str, algo: str):
        path = self.folder / f"{task}__{algo}.pkl"
        return self._load(path) if algo in self.man["final_models"].get(task, []) and path.exists() else None

    def _load_fold_models(self, rel_paths: list[str]) -> list:
        """Fold models for the amount-suggestion noise gate. Looked up next to the bundle and one level up
        (the notebook keeps them in home_credit_runs/models/). All five are needed, otherwise the gate is skipped."""
        import lightgbm as lgb
        found = []
        for rel in rel_paths:
            for base in (self.folder, self.folder.parent):
                p = base / rel
                if p.exists():
                    found.append(lgb.Booster(model_file=str(p)))
                    break
        return found if rel_paths and len(found) == len(rel_paths) else []

    @staticmethod
    def _load(path: Path):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with open(path, "rb") as fh:
                return pickle.load(fh)

    def _check_versions(self) -> list[str]:
        saved = self.man.get("library_versions", {})
        out = []
        for name, want in saved.items():
            try:
                have = __import__(name).__version__
            except Exception:
                have = None
            if have != want:
                out.append(f"{name}: trained with {want}, installed {have}")
        return out

    # ---- feature preparation -------------------------------------------------------------------------------------
    def _prep(self, df: pd.DataFrame, feats: list[str]) -> pd.DataFrame:
        X = df.reindex(columns=feats).copy()
        for c in feats:
            if c in self.levels:
                X[c] = pd.Categorical(X[c].astype(object).where(X[c].notna()), categories=self.levels[c])
            else:
                X[c] = pd.to_numeric(X[c], errors="coerce").astype("float32")
        return X

    def _predict(self, task: str, X: pd.DataFrame) -> np.ndarray:
        cat = [c for c in X.columns if c in self.levels]
        ps = []
        for algo, m in self.models[task]:
            if algo == "lightgbm":
                ps.append(m.predict(X))
            elif algo == "xgboost":
                ps.append(m.predict_proba(X.replace([np.inf, -np.inf], np.nan))[:, 1])
            else:
                Xc = X.copy()
                for c in cat:
                    Xc[c] = Xc[c].astype(object).where(Xc[c].notna(), "NA").astype(str)
                ps.append(m.predict_proba(Xc.replace([np.inf, -np.inf], np.nan))[:, 1])
        return np.mean(ps, axis=0)

    # ---- public API ----------------------------------------------------------------------------------------------
    def score(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calibrated probability of default, model used and triage lane for each row."""
        feats = self.man["features"]
        no_ext = df.reindex(columns=EXT).isna().all(axis=1).values
        p_main = self.cal["main"].predict(self._predict("1_main", self._prep(df, feats["main"])))
        p_fb = self.cal["fallback"].predict(self._predict("2_fallback", self._prep(df, feats["fallback"])))
        pdv = np.where(no_ext, p_fb, p_main)
        lanes = self.man["lanes"]
        lane = np.where(pdv <= lanes["fast_max_pd"], "fast", np.where(pdv >= lanes["high_risk_min_pd"], "high_risk", "normal"))
        return pd.DataFrame({"pd": pdv, "model_used": np.where(no_ext, "2_fallback", "1_main"), "lane": lane}, index=df.index)

    def explain(self, df: pd.DataFrame, top: int = 5) -> list[list[dict]]:
        """Top risk factors per row from SHAP contributions of the LightGBM member of the model that scored the row."""
        feats = self.man["features"]
        no_ext = df.reindex(columns=EXT).isna().all(axis=1).values
        out: list[list[dict]] = [[] for _ in range(len(df))]
        for task, key, mask in (("1_main", "main", ~no_ext), ("2_fallback", "fallback", no_ext)):
            if not mask.any():
                continue
            lgbm = dict(self.models[task]).get("lightgbm")
            if lgbm is None:
                continue
            X = self._prep(df[mask], feats[key])
            phi = lgbm.predict(X, pred_contrib=True)[:, :-1]
            for k, i in enumerate(np.where(mask)[0]):
                idx = np.argsort(-np.abs(phi[k]))[:top]
                out[i] = [{"feature": feats[key][j], "label": readable(feats[key][j]), "label_ar": self.labels.get(feats[key][j]),
                           "effect": "raises risk" if phi[k, j] > 0 else "lowers risk", "contribution": float(phi[k, j])} for j in idx]
        return out

    # ---- policy rules (no model) ---------------------------------------------------------------------------------
    def sama_check(self, income: float, annuity: float, retired: bool, existing_monthly_obligations: float = 0.0) -> dict:
        """Salary-linked obligation cap: monthly obligations / gross monthly salary. Income is treated as monthly."""
        s = self.man["sama"]
        cap = s["cap_retired"] if retired else s["cap_employee"]
        ratio = (annuity + existing_monthly_obligations) / income if income > 0 else float("inf")
        return {"cap": cap, "ratio": ratio, "within_cap": bool(ratio <= cap),
                "max_instalment": max(cap * income - existing_monthly_obligations, 0.0)}

    def eligibility(self, age_years: float, credit: float, annuity: float) -> dict:
        e = self.man["eligibility"]
        term_years = (credit / annuity) / 12 if annuity > 0 else float("nan")
        flags = []
        if age_years < e["min_age"]:
            flags.append(f"Applicant is younger than {e['min_age']}.")
        if age_years + term_years > e["max_age_at_maturity"]:
            flags.append(f"Age at the end of the loan would exceed {e['max_age_at_maturity']}.")
        return {"eligible": not flags, "flags": flags, "approx_term_years": term_years,
                "note": "Age limits are example policy values, not SAMA numbers."}

    # ---- phase 2: Model 3, loan-amount suggestion ---------------------------------------------------------------
    def suggest_amount(self, df: pd.DataFrame, retired: bool, existing_monthly_obligations: float = 0.0) -> dict:
        """Largest reduced amount (credit and instalment scaled together, down to -max_cut) that satisfies BOTH the SAMA
        cap and the Model 3 risk threshold. Same search as notebook step 15. One row only."""
        if self.mono is None:
            return {"available": False, "status": "model_unavailable", "message": "Model 3 is not in the model bundle."}
        cfg = self.man["amount_suggestion"]
        thr, max_cut, step = float(cfg["risk_threshold_raw_monotone_pd"]), float(cfg["max_cut"]), float(cfg["step"])
        feats = self.man["features"]["monotone"]
        row = df.iloc[[0]].reset_index(drop=True)
        income, credit, annuity = (float(row[c].iloc[0]) for c in ("AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY"))
        sama = self.sama_check(income, annuity, retired, existing_monthly_obligations)
        max_ann = sama["max_instalment"]

        def mono_pd(d: pd.DataFrame, model) -> float:
            return float(model.predict(self._prep(d, feats))[0])

        p0 = mono_pd(row, self.mono)
        base = {"available": True, "risk_threshold": thr, "monotone_risk_requested": p0,
                "within_risk_threshold": bool(p0 <= thr), "within_sama_cap": sama["within_cap"],
                "requested_credit": credit, "requested_instalment": annuity, "max_instalment_sama": max_ann,
                "noise_gate_applied": bool(self.mono_folds)}
        if p0 <= thr and sama["within_cap"]:
            return {**base, "status": "not_needed", "message": "The requested amount already meets the SAMA cap and the risk threshold."}

        n = int(round(max_cut / step))
        for f in np.round([1 - step * k for k in range(1, n + 1)], 4):
            d = shrink(row, float(f))
            p1 = mono_pd(d, self.mono)
            if p1 <= thr and annuity * f <= max_ann:
                if self.mono_folds:   # noise gate: the risk drop must exceed 2 SD of the drop across the fold models
                    drops = np.array([mono_pd(row, m) - mono_pd(d, m) for m in self.mono_folds])
                    if (p0 - p1) < 2 * drops.std(ddof=1):
                        return {**base, "status": "below_noise", "message": "A smaller amount was found, but the risk change is within model noise."}
                rescored = self.score(d).iloc[0]
                f = float(f)
                return {**base, "status": "suggested", "reduction": round(1 - f, 4), "suggested_credit": credit * f,
                        "suggested_instalment": annuity * f, "monotone_risk_suggested": p1,
                        "probability_of_default_suggested": float(rescored["pd"]), "lane_suggested": rescored["lane"],
                        "message": f"Reducing the amount by {1 - f:.0%} meets both the SAMA cap and the risk threshold."}
        return {**base, "status": "not_reachable",
                "message": f"No amount within -{max_cut:.0%} meets both the SAMA cap and the risk threshold."}

    # ---- phase 2: Model 4, early warning for running contracts --------------------------------------------------
    def early_warning(self, history: list[dict]) -> dict:
        """Probability that a running contract, currently up to date, falls into arrears within the next 3 months."""
        if self.ew is None:
            return {"available": False, "status": "model_unavailable", "message": "Model 4 is not in the model bundle."}
        feats = early_warning_features(history)
        benchmark = feats["dpd_max_l3"]
        if history[-1].get("dpd", 0) > 0:
            return {"available": True, "status": "already_in_arrears", "features": feats, "benchmark_max_dpd_last_3m": benchmark,
                    "message": "The contract is already past due this month. The model only scores contracts that are currently up to date."}
        if feats["inst_left"] is not None and feats["inst_left"] <= 0:
            return {"available": True, "status": "completed", "features": feats, "benchmark_max_dpd_last_3m": benchmark,
                    "message": "No instalments are left on this contract."}
        names = self.man["features"]["early_warning"]
        X = pd.DataFrame([[feats[c] for c in names]], columns=names).astype("float32")
        return {"available": True, "status": "scored", "probability_of_arrears_3m": float(self.ew.predict(X)[0]),
                "features": feats, "benchmark_max_dpd_last_3m": benchmark,
                "note": "Prioritisation aid with modest accuracy (cross-validated AUC 0.68), not a precise alarm."}


AFF_DTI = ["aff_dti_plus_bureau_raw", "aff_dti_plus_bureau_est", "aff_dti_plus_bureau_est_fallback", "aff_dti_plus_hc_active",
           "aff_dti_total_raw", "aff_dti_total_est", "aff_dti_total_est_fallback"]
AFF_RESIDUAL = ["aff_residual_per_member_new_only", "aff_residual_per_member_total_raw", "aff_residual_per_member_total_est"]


def shrink(df: pd.DataFrame, f: float) -> pd.DataFrame:
    """Scale credit and instalment by f and update the derived affordability ratios (notebook step 15)."""
    d = df.copy()
    num = lambda c: pd.to_numeric(d[c], errors="coerce").astype(float).values if c in d else np.full(len(d), np.nan)
    inc = num("AMT_INCOME_TOTAL")
    fam = num("CNT_FAM_MEMBERS"); fam = np.where(fam == 0, np.nan, fam)
    c0, a0 = num("AMT_CREDIT"), num("AMT_ANNUITY")
    c1, a1 = c0 * f, a0 * f
    d["AMT_CREDIT"], d["AMT_ANNUITY"] = c1, a1
    d["aff_annuity_to_income"], d["aff_credit_to_income"], d["aff_credit_to_goods"] = a1 / inc, c1 / inc, c1 / num("AMT_GOODS_PRICE")
    for c in AFF_DTI:
        if c in d:
            d[c] = num(c) + (a1 - a0) / inc
    if "aff_total_debt_incl_new_to_income" in d:
        d["aff_total_debt_incl_new_to_income"] = num("aff_total_debt_incl_new_to_income") + (c1 - c0) / inc
    for c in AFF_RESIDUAL:
        if c in d:
            d[c] = num(c) - (a1 - a0) / fam
    return d


def early_warning_features(history: list[dict]) -> dict:
    """The 11 Model 4 inputs at the latest month, computed like the notebook's SQL (step 17).
    history: monthly records, oldest first, each with dpd, dpd_def, inst_total, inst_left."""
    if not history:
        raise ValueError("history must contain at least one month")
    g = lambda r, k: None if r.get(k) is None else float(r[k])
    dpd = [g(r, "dpd") or 0.0 for r in history]
    last = history[-1]
    inst_total, inst_left = g(last, "inst_total"), g(last, "inst_left")
    left_3 = g(history[-4], "inst_left") if len(history) >= 4 else None
    return {
        "dpd_def": g(last, "dpd_def") or 0.0,
        "dpd_max_l3": max(dpd[-3:]), "dpd_max_l6": max(dpd[-6:]), "dpd_max_all": max(dpd),
        "dpd_share_l6": float(np.mean([x > 0 for x in dpd[-6:]])), "dpd_share_all": float(np.mean([x > 0 for x in dpd])),
        "months_on_book": float(len(history)),
        "inst_total": inst_total, "inst_left": inst_left,
        "share_left": inst_left / inst_total if inst_total and inst_left is not None else None,
        "paid_down_l3": left_3 - inst_left if left_3 is not None and inst_left is not None else None,
    }


def build_row(inp: dict) -> pd.DataFrame:
    """One-row frame from manually entered fields; derives the simple affordability ratios."""
    row = {k: inp.get(k) for k in MANUAL_FIELDS}
    inc, cred, ann, goods = (float(inp[k]) if inp.get(k) is not None else np.nan for k in ("AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY", "AMT_GOODS_PRICE"))
    fam = float(inp["CNT_FAM_MEMBERS"]) if inp.get("CNT_FAM_MEMBERS") else np.nan
    row.update({
        "aff_annuity_to_income": ann / inc, "aff_credit_to_income": cred / inc, "aff_credit_to_annuity_term": cred / ann,
        "aff_credit_to_goods": cred / goods, "aff_income_per_member": inc / fam, "aff_residual_per_member_new_only": (inc - ann) / fam,
        "aff_income_log_winsor": float(np.log(inc)) if inc and inc > 0 else np.nan,
    })
    # In training, "no record" means no known obligation (0), so a new applicant with no declared obligations gets the same values.
    ex = float(inp.get("existing_monthly_obligations") or 0.0)
    for c in ("aff_dti_plus_bureau_raw", "aff_dti_plus_bureau_est", "aff_dti_plus_bureau_est_fallback", "aff_dti_plus_hc_active",
              "aff_dti_total_raw", "aff_dti_total_est", "aff_dti_total_est_fallback"):
        row[c] = (ann + ex) / inc
    row.update({"aff_existing_oblig_est_to_income": ex / inc, "aff_bureau_debt_to_income": 0.0, "aff_total_debt_to_income": 0.0,
                "aff_total_debt_incl_new_to_income": cred / inc})
    for c in ("aff_residual_per_member_total_raw", "aff_residual_per_member_total_est"):
        row[c] = (inc - ann - ex) / fam
    if inp.get("employed_years") is not None:
        row["DAYS_EMPLOYED"] = -float(inp["employed_years"]) * 365.25
    return pd.DataFrame([row])


def assess(s: Scorer, df: pd.DataFrame, income: float, credit: float, annuity: float, age_years: float, retired: bool, existing: float = 0.0) -> dict:
    """Full assessment of one applicant row: risk, lane, explanation and the two policy checks."""
    res = s.score(df).iloc[0]
    return {
        "probability_of_default": float(res["pd"]),
        "model_used": res["model_used"],
        "lane": res["lane"],
        "top_factors": s.explain(df)[0],
        "sama_check": s.sama_check(income, annuity, retired, existing),
        "eligibility": s.eligibility(age_years, credit, annuity),
        "amount_suggestion": s.suggest_amount(df, retired, existing),
        "decision_support_only": True,
    }
