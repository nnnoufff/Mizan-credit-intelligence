"""Mizan – Credit Intelligence Platform: FastAPI service + the website. Run from the project root:  uvicorn api.main:app --reload
Website at http://127.0.0.1:8000/ (the static export in web/out; build it with `npm run build` in web/)
API at /api/... (and the same endpoints at the root, e.g. /score)   API docs at http://127.0.0.1:8000/docs"""
from __future__ import annotations

import os
import json
import secrets
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
# The bundled XGBoost model may remember a CUDA training device. Default to CPU for the local demo
# so loading or scoring cannot terminate the API on machines without a compatible CUDA runtime.
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
from hc_app.scoring import Scorer, assess, build_row  # noqa: E402

MODEL_DIR = Path(os.environ.get("HC_MODEL_DIR", ROOT / "models" / "final"))
# the website, exported by Next.js (web/next.config.ts, output: "export"); without it "/" shows the original page
WEB_DIR = Path(os.environ.get("MIZAN_WEB_DIR", ROOT / "web" / "out"))
app = FastAPI(title="Mizan – Credit Intelligence Platform", version="1.0",
              description="Decision support only: estimates default risk, applies the SAMA obligation cap and explains the result.")
router = APIRouter()   # every endpoint, served at the root and again under /api for the website
_scorer: Optional[Scorer] = None
_demo: Optional[pd.DataFrame] = None
DB_PATH = Path(os.environ.get("MIZAN_DB_PATH", ROOT / "api" / "mizan.sqlite3"))
_officer_tokens: set[str] = set()


def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            applicant_json TEXT NOT NULL,
            analysis_json TEXT NOT NULL,
            preliminary_result TEXT NOT NULL,
            preliminary_reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            officer_note TEXT NOT NULL DEFAULT '',
            proposed_amount REAL,
            proposed_instalment REAL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    columns = {row[1] for row in con.execute("PRAGMA table_info(applications)")}
    if "proposed_amount" not in columns:
        con.execute("ALTER TABLE applications ADD COLUMN proposed_amount REAL")
    if "proposed_instalment" not in columns:
        con.execute("ALTER TABLE applications ADD COLUMN proposed_instalment REAL")
    con.commit()
    return con


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_officer(authorization: Optional[str]) -> None:
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not token or token not in _officer_tokens:
        raise HTTPException(401, "Officer authentication required")


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


class CustomerApplication(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20, pattern=r"^[0-9+() -]+$")
    applicant: Applicant


class OfficerLogin(BaseModel):
    password: str


class ApplicationUpdate(BaseModel):
    status: str
    note: str = Field("", max_length=2000)
    proposed_amount: Optional[float] = Field(None, gt=0)
    proposed_instalment: Optional[float] = Field(None, gt=0)


class OfferResponse(BaseModel):
    action: str


class ExternalScoresUpdate(BaseModel):
    EXT_SOURCE_1: Optional[float] = Field(None, ge=0, le=1)
    EXT_SOURCE_2: Optional[float] = Field(None, ge=0, le=1)
    EXT_SOURCE_3: Optional[float] = Field(None, ge=0, le=1)


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


@router.post("/score")
def score(a: Applicant):
    inp = a.model_dump() if hasattr(a, "model_dump") else a.dict()
    return assess(scorer(), build_row(inp), a.AMT_INCOME_TOTAL, a.AMT_CREDIT, a.AMT_ANNUITY, a.age_years, a.retired, a.existing_monthly_obligations)


def _ew(c: Contract) -> dict:
    hist = [m.model_dump() if hasattr(m, "model_dump") else m.dict() for m in c.history]
    return {"contract_id": c.contract_id, **scorer().early_warning(hist)}


@router.post("/early-warning")
def early_warning(c: Contract):
    """Model 4: probability that a running contract (currently up to date) falls into arrears within 3 months."""
    return {**_ew(c), "decision_support_only": True}


@router.post("/early-warning/batch")
def early_warning_batch(p: Portfolio):
    """Model 4 for many contracts, sorted by risk (highest first; contracts not scored come last)."""
    rows = [_ew(c) for c in p.contracts]
    rows.sort(key=lambda r: -r.get("probability_of_arrears_3m", -1))
    return {"results": rows, "decision_support_only": True}


@router.get("/demo/ids")
def demo_ids():
    return demo()["SK_ID_CURR"].astype(int).tolist()


@router.post("/score/demo/{applicant_id}")
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


# Application workflow endpoints intentionally live only under /api. The existing scoring endpoints above remain unchanged.
@app.post("/api/applications", status_code=201)
def create_application(payload: CustomerApplication):
    a = payload.applicant
    inp = a.model_dump() if hasattr(a, "model_dump") else a.dict()
    analysis = assess(scorer(), build_row(inp), a.AMT_INCOME_TOTAL, a.AMT_CREDIT, a.AMT_ANNUITY,
                      a.age_years, a.retired, a.existing_monthly_obligations)
    sama_ok = bool(analysis["sama_check"]["within_cap"])
    eligible = bool(analysis["eligibility"]["eligible"])
    preliminary = "eligible" if analysis["lane"] in {"fast", "normal"} and sama_ok and eligible else "review"
    if not eligible:
        reason = "eligibility"
    elif not sama_ok:
        reason = "sama_cap"
    elif analysis["lane"] == "high_risk":
        reason = "additional_review"
    else:
        reason = "initial_checks_passed"
    reference = f"MZ-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"
    now = _now()
    with _db() as con:
        con.execute("""INSERT INTO applications
            (reference, name, phone, applicant_json, analysis_json, preliminary_result, preliminary_reason, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (reference, payload.name.strip(), payload.phone.strip(), json.dumps(inp), json.dumps(analysis), preliminary, reason, now, now))
    suggestion = analysis.get("amount_suggestion", {})
    return {
        "reference": reference,
        "preliminary_result": preliminary,
        "preliminary_reason": reason,
        "suggestion": {k: suggestion.get(k) for k in ("status", "suggested_credit", "suggested_instalment", "reduction")},
        "status": "new",
        "decision_support_only": True,
    }


@app.get("/api/applications/{reference}/status")
def application_status(reference: str):
    with _db() as con:
        row = con.execute("""SELECT reference, preliminary_result, preliminary_reason, status, officer_note,
                                  proposed_amount, proposed_instalment, created_at, updated_at
                           FROM applications WHERE reference = ?""", (reference.upper(),)).fetchone()
    if row is None:
        raise HTTPException(404, "Application not found")
    return dict(row)


@app.post("/api/officer/login")
def officer_login(payload: OfficerLogin):
    configured = os.environ.get("OFFICER_PASSWORD", "1234")
    if not secrets.compare_digest(payload.password, configured):
        raise HTTPException(401, "Incorrect password")
    token = secrets.token_urlsafe(32)
    _officer_tokens.add(token)
    return {"token": token}


@app.get("/api/officer/applications")
def list_applications(authorization: Optional[str] = Header(None)):
    _require_officer(authorization)
    with _db() as con:
        rows = con.execute("""SELECT reference, name, phone, preliminary_result, preliminary_reason, status,
                                     officer_note, proposed_amount, proposed_instalment, created_at, updated_at
                            FROM applications ORDER BY id DESC""").fetchall()
    applications = [dict(row) for row in rows]
    return {"applications": applications, "new_count": sum(row["status"] == "new" for row in applications)}


@app.get("/api/officer/applications/{reference}")
def officer_application(reference: str, authorization: Optional[str] = Header(None)):
    _require_officer(authorization)
    with _db() as con:
        row = con.execute("SELECT * FROM applications WHERE reference = ?", (reference.upper(),)).fetchone()
    if row is None:
        raise HTTPException(404, "Application not found")
    out = dict(row)
    out["applicant"] = json.loads(out.pop("applicant_json"))
    out["analysis"] = json.loads(out.pop("analysis_json"))
    return out


@app.patch("/api/officer/applications/{reference}")
def update_application(reference: str, payload: ApplicationUpdate, authorization: Optional[str] = Header(None)):
    _require_officer(authorization)
    allowed = {"new": {"in_review"}, "in_review": {"approved", "rejected", "amount_proposed"},
               "amount_proposed": set(), "offer_accepted": set(), "offer_rejected": set(), "approved": set(), "rejected": set()}
    if payload.status not in allowed:
        raise HTTPException(422, "Unknown application status")
    with _db() as con:
        row = con.execute("SELECT status FROM applications WHERE reference = ?", (reference.upper(),)).fetchone()
        if row is None:
            raise HTTPException(404, "Application not found")
        if payload.status != row["status"] and payload.status not in allowed[row["status"]]:
            raise HTTPException(409, f"Cannot change status from {row['status']} to {payload.status}")
        if payload.status == "amount_proposed" and payload.proposed_amount is None:
            raise HTTPException(422, "A proposed amount is required")
        con.execute("""UPDATE applications SET status = ?, officer_note = ?, proposed_amount = ?,
                       proposed_instalment = ?, updated_at = ? WHERE reference = ?""",
                    (payload.status, payload.note.strip(), payload.proposed_amount, payload.proposed_instalment,
                     _now(), reference.upper()))
    return {"reference": reference.upper(), "status": payload.status, "officer_note": payload.note.strip(),
            "proposed_amount": payload.proposed_amount, "proposed_instalment": payload.proposed_instalment}


@app.post("/api/applications/{reference}/offer")
def respond_to_offer(reference: str, payload: OfferResponse):
    if payload.action not in {"accept", "reject"}:
        raise HTTPException(422, "Action must be accept or reject")
    with _db() as con:
        row = con.execute("SELECT status FROM applications WHERE reference = ?", (reference.upper(),)).fetchone()
        if row is None:
            raise HTTPException(404, "Application not found")
        if row["status"] != "amount_proposed":
            raise HTTPException(409, "This application has no pending offer")
        status = "offer_accepted" if payload.action == "accept" else "offer_rejected"
        con.execute("UPDATE applications SET status = ?, updated_at = ? WHERE reference = ?",
                    (status, _now(), reference.upper()))
    return {"reference": reference.upper(), "status": status}


@app.post("/api/officer/applications/{reference}/rescore")
def rescore_application(reference: str, payload: ExternalScoresUpdate, authorization: Optional[str] = Header(None)):
    _require_officer(authorization)
    with _db() as con:
        row = con.execute("SELECT applicant_json FROM applications WHERE reference = ?", (reference.upper(),)).fetchone()
        if row is None:
            raise HTTPException(404, "Application not found")
        inp = json.loads(row["applicant_json"])
        scores = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        inp.update(scores)
        analysis = assess(scorer(), build_row(inp), inp["AMT_INCOME_TOTAL"], inp["AMT_CREDIT"], inp["AMT_ANNUITY"],
                          inp["age_years"], inp.get("retired", False), inp.get("existing_monthly_obligations", 0.0))
        con.execute("UPDATE applications SET applicant_json = ?, analysis_json = ?, updated_at = ? WHERE reference = ?",
                    (json.dumps(inp), json.dumps(analysis), _now(), reference.upper()))
    return {"reference": reference.upper(), "applicant": inp, "analysis": analysis}


app.include_router(router)
app.include_router(router, prefix="/api", include_in_schema=False)

# the website last, so the API routes and /docs win; html=True serves /en/ as en/index.html and 404.html for unknown pages
if WEB_DIR.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
