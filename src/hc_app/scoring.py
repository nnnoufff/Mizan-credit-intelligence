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
        "decision_support_only": True,
    }
