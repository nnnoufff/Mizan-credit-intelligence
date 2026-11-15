"""Mizan – Credit Intelligence Platform: FastAPI service + the website. Run from the project root:  uvicorn api.main:app --reload
Website at http://127.0.0.1:8000/ (the static export in web/out; build it with `npm run build` in web/)
API at /api/... (and the same endpoints at the root, e.g. /score)   API docs at http://127.0.0.1:8000/docs"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from hc_app.scoring import Scorer, assess, build_row  # noqa: E402
sys.path.insert(0, str(ROOT))
from api.applications import build_router, require_officer  # noqa: E402

MODEL_DIR = Path(os.environ.get("HC_MODEL_DIR", ROOT / "models" / "final"))
# the website, exported by Next.js (web/next.config.ts, output: "export"); without it "/" shows the original page.
# The two-site deploy points this at web/out-client or web/out-officer (relative paths are taken from the project root).
WEB_DIR = Path(os.environ.get("MIZAN_WEB_DIR", ROOT / "web" / "out"))
if not WEB_DIR.is_absolute():
    WEB_DIR = ROOT / WEB_DIR
app = FastAPI(title="Mizan – Credit Intelligence Platform", version="1.0",
              description="Decision support only: estimates default risk, applies the SAMA obligation cap and explains the result.")
router = APIRouter()   # every endpoint, served at the root and again under /api for the website
# Scoring, early warning and the demo applicants are officer tools: they need the passcode (X-Officer-Code), like the inbox.
_scorer: Optional[Scorer] = None
_demo: Optional[pd.DataFrame] = None


def scorer() -> Scorer:
    global _scorer
    if _scorer is None:
        if not (MODEL_DIR / "manifest.json").exists():
            raise HTTPException(503, f"Model bundle not found in {MODEL_DIR}. Copy home_credit_runs/final/ into models/final/.")
        _scorer = Scorer(MODEL_DIR)
    return _scorer


def demo() -> pd.DataFrame:
    global _demo
    if _demo is None:
        f = MODEL_DIR / "demo_applicants.parquet"
        if not f.exists():
            raise HTTPException(404, "demo_applicants.parquet not found in the model bundle.")
        _demo = pd.read_parquet(f)
    return _demo


class Applicant(BaseModel):
    age_years: float = Field(..., ge=18, le=100, description="Used only for the eligibility rule, never as a model input")
    retired: bool = False
    AMT_INCOME_TOTAL: float = Field(..., gt=0, description="Gross monthly income")
    AMT_CREDIT: float = Field(..., gt=0, description="Requested credit amount")
    AMT_ANNUITY: float = Field(..., gt=0, description="Monthly instalment")
    AMT_GOODS_PRICE: Optional[float] = Field(None, gt=0)
    existing_monthly_obligations: float = Field(0.0, ge=0)
    CNT_FAM_MEMBERS: Optional[float] = 1
    CNT_CHILDREN: Optional[float] = 0
    employed_years: Optional[float] = Field(None, ge=0)
    NAME_CONTRACT_TYPE: Optional[str] = None
    NAME_INCOME_TYPE: Optional[str] = None
    NAME_EDUCATION_TYPE: Optional[str] = None
    NAME_FAMILY_STATUS: Optional[str] = None
    NAME_HOUSING_TYPE: Optional[str] = None
    OCCUPATION_TYPE: Optional[str] = None
    FLAG_OWN_CAR: Optional[str] = None
    FLAG_OWN_REALTY: Optional[str] = None
    EXT_SOURCE_1: Optional[float] = Field(None, ge=0, le=1)
    EXT_SOURCE_2: Optional[float] = Field(None, ge=0, le=1)
    EXT_SOURCE_3: Optional[float] = Field(None, ge=0, le=1)


class MonthRecord(BaseModel):
    dpd: float = Field(0, ge=0, description="Days past due in this month")
    dpd_def: float = Field(0, ge=0, description="Days past due with tolerance (small debts ignored)")
    inst_total: Optional[float] = Field(None, ge=0, description="Total number of instalments of the contract")
    inst_left: Optional[float] = Field(None, ge=0, description="Instalments left to pay")


class Contract(BaseModel):
    contract_id: Optional[str] = None
    history: list[MonthRecord] = Field(..., min_length=1, description="Monthly records, oldest first; the last one is the current month")


class Portfolio(BaseModel):
    contracts: list[Contract] = Field(..., min_length=1, max_length=5000)


@app.get("/", include_in_schema=False)
def index():
    if (WEB_DIR / "en" / "index.html").exists():
        return RedirectResponse("/en/")
    return FileResponse(ROOT / "api" / "static" / "index.html")


@router.get("/health")
def health():
    s = scorer()
    return {"status": "ok", "models": s.man["final_models"], "cv_auc": s.man.get("cv_auc", {}), "version_warnings": s.version_warnings,
            "demo_applicants": (MODEL_DIR / "demo_applicants.parquet").exists(),
            "phase2": {"amount_suggestion": s.mono is not None, "amount_suggestion_noise_gate": bool(s.mono_folds),
                       "early_warning": s.ew is not None}}


@router.get("/options")
def options():
    """Allowed values of the categorical fields (for the form drop-downs)."""
    lv = scorer().levels
    keys = ["NAME_CONTRACT_TYPE", "NAME_INCOME_TYPE", "NAME_EDUCATION_TYPE", "NAME_FAMILY_STATUS", "NAME_HOUSING_TYPE", "OCCUPATION_TYPE"]
    return {k: lv.get(k, []) for k in keys}


@router.post("/score", dependencies=[Depends(require_officer)])
def score(a: Applicant):
    inp = a.model_dump() if hasattr(a, "model_dump") else a.dict()
    return assess(scorer(), build_row(inp), a.AMT_INCOME_TOTAL, a.AMT_CREDIT, a.AMT_ANNUITY, a.age_years, a.retired, a.existing_monthly_obligations)


def _ew(c: Contract) -> dict:
    hist = [m.model_dump() if hasattr(m, "model_dump") else m.dict() for m in c.history]
    return {"contract_id": c.contract_id, **scorer().early_warning(hist)}


@router.post("/early-warning", dependencies=[Depends(require_officer)])
def early_warning(c: Contract):
    """Model 4: probability that a running contract (currently up to date) falls into arrears within 3 months."""
    return {**_ew(c), "decision_support_only": True}


@router.post("/early-warning/batch", dependencies=[Depends(require_officer)])
def early_warning_batch(p: Portfolio):
    """Model 4 for many contracts, sorted by risk (highest first; contracts not scored come last)."""
    rows = [_ew(c) for c in p.contracts]
    rows.sort(key=lambda r: -r.get("probability_of_arrears_3m", -1))
    return {"results": rows, "decision_support_only": True}


@router.get("/demo/ids", dependencies=[Depends(require_officer)])
def demo_ids():
    return demo()["SK_ID_CURR"].astype(int).tolist()


@router.post("/score/demo/{applicant_id}", dependencies=[Depends(require_officer)])
def score_demo(applicant_id: int):
    """Score a stored applicant that carries the full credit history (taken from the unlabeled test file)."""
    d = demo()
    row = d[d["SK_ID_CURR"] == applicant_id].reset_index(drop=True)
    if row.empty:
        raise HTTPException(404, "Unknown applicant id")
    income, credit, annuity = (float(row[c].iloc[0]) for c in ("AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY"))
    age = float(-row["DAYS_BIRTH"].iloc[0] / 365.25)
    existing = float(pd.to_numeric(row.get("aff_existing_oblig_est_to_income"), errors="coerce").fillna(0).iloc[0] * income)
    out = assess(scorer(), row, income, credit, annuity, age, str(row["NAME_INCOME_TYPE"].iloc[0]) == "Pensioner", existing)
    out["applicant"] = {"id": applicant_id, "income": income, "credit": credit, "annuity": annuity, "age_years": round(age, 1),
                        "income_type": str(row["NAME_INCOME_TYPE"].iloc[0])}
    return out


def _score_dict(inp: dict) -> dict:
    """Score an applicant dict and return plain JSON types (numpy values become Python numbers), ready to store."""
    out = score(Applicant(**inp))
    return json.loads(json.dumps(out, default=lambda o: o.item() if hasattr(o, "item") else str(o)))


# MIZAN_SITE picks what this service serves (one codebase, two sites on Render, one shared database):
#   client  -> the customers' site: health, form options, filing and answering their own applications. No scoring
#              endpoints and no officer endpoints.
#   officer -> the bank staff's site: scoring, early warning, the demo applicants and the officer inbox.
#   all     -> everything (the default, for local development and the tests).
SITE = os.environ.get("MIZAN_SITE", "all").strip().lower()
if SITE not in ("all", "client", "officer"):
    raise RuntimeError(f"MIZAN_SITE must be all, client or officer, not {SITE!r}")

if SITE == "client":
    served = APIRouter()
    served.add_api_route("/health", health, methods=["GET"])
    served.add_api_route("/options", options, methods=["GET"])
else:
    served = router
served.include_router(build_router(_score_dict, client=SITE != "officer", officer_routes=SITE != "client"))

app.include_router(served)
app.include_router(served, prefix="/api", include_in_schema=False)

# the website last, so the API routes and /docs win; html=True serves /en/ as en/index.html and 404.html for unknown pages
if WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
