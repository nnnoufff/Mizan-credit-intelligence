"""Client applications: a client files a request, a credit officer decides, and the client answers an alternative offer.

Status flow:  submitted -> approved | rejected | offered -> offer_accepted | offer_declined

Storage: SQLAlchemy Core, so the same code runs on Render Postgres (DATABASE_URL) and on a local SQLite file
(data/mizan.db) in development and tests.
Access (demo only, no passwords): a client sees the applications filed with their phone number; the officer endpoints
need the passcode in the X-Officer-Code header (OFFICER_CODE, default "mizan-demo"). Not secure for real customers.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (JSON, Column, DateTime, Float, Integer, MetaData, String, Table, Text, create_engine, insert,
                        select, update)
from sqlalchemy.engine import Engine

ROOT = Path(__file__).resolve().parent.parent
# Example policy values, set by the bank (the client gives an amount and a term; the bank prices the instalment).
PROFIT_RATE = float(os.environ.get("MIZAN_PROFIT_RATE", "0.05"))   # flat annual profit rate
OFFICER_CODE = os.environ.get("OFFICER_CODE", "mizan-demo")

metadata = MetaData()
applications = Table(
    "applications", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("client_name", String(120), nullable=False),
    Column("client_phone", String(20), nullable=False, index=True),
    Column("status", String(20), nullable=False, index=True),
    Column("requested_credit", Float, nullable=False),
    Column("term_months", Integer, nullable=False),
    Column("requested_instalment", Float, nullable=False),
    Column("applicant", JSON, nullable=False),      # the model input, as sent to /score
    Column("assessment", JSON, nullable=False),     # the /score result at filing time
    Column("offer_credit", Float),
    Column("offer_instalment", Float),
    Column("officer_note", Text),
    Column("decided_at", DateTime(timezone=True)),
    Column("responded_at", DateTime(timezone=True)),
)

_engine: Optional[Engine] = None


def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        (ROOT / "data").mkdir(exist_ok=True)
        return f"sqlite:///{ROOT / 'data' / 'mizan.db'}"
    # Render gives postgres:// or postgresql://; SQLAlchemy needs the driver named
    return re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", url)


def engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(database_url(), pool_pre_ping=True)
        metadata.create_all(_engine)
    return _engine


def reset_engine() -> None:
    """For tests: drop the cached engine so a new DATABASE_URL is picked up."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = None


def now() -> datetime:
    return datetime.now(timezone.utc)


def norm_phone(p: str) -> str:
    digits = re.sub(r"\D", "", p or "")
    if not 7 <= len(digits) <= 15:
        raise HTTPException(422, "Write a phone number of 7 to 15 digits.")
    return digits


def instalment(credit: float, term_months: int) -> float:
    return credit * (1 + PROFIT_RATE * term_months / 12) / term_months


# ---------------------------------------------------------------- request bodies
class ClientApplication(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=120)
    client_phone: str = Field(..., min_length=7, max_length=20)
    age_years: float = Field(..., ge=18, le=100)
    retired: bool = False
    employed_years: Optional[float] = Field(None, ge=0, le=60)
    CNT_FAM_MEMBERS: Optional[float] = Field(None, ge=1, le=20)
    CNT_CHILDREN: Optional[float] = Field(None, ge=0, le=20)
    NAME_EDUCATION_TYPE: Optional[str] = None
    OCCUPATION_TYPE: Optional[str] = None
    NAME_INCOME_TYPE: Optional[str] = None
    AMT_INCOME_TOTAL: float = Field(..., gt=0, description="Gross monthly income")
    existing_monthly_obligations: float = Field(0.0, ge=0)
    AMT_CREDIT: float = Field(..., gt=0, le=10_000_000, description="Requested amount")
    term_months: int = Field(..., ge=6, le=480)


class Respond(BaseModel):
    client_phone: str
    accept: bool


class Decision(BaseModel):
    decision: Literal["approve", "offer", "reject"]
    offer_credit: Optional[float] = Field(None, gt=0)
    note: Optional[str] = Field(None, max_length=1000)


# ---------------------------------------------------------------- views
def _row(r) -> dict:
    d = dict(r._mapping)
    for k in ("applicant", "assessment"):          # SQLite may hand JSON back as text
        if isinstance(d.get(k), str):
            d[k] = json.loads(d[k])
    for k in ("created_at", "updated_at", "decided_at", "responded_at"):
        if d.get(k) is not None:
            v = d[k]
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            d[k] = v.isoformat()
    return d


def client_view(d: dict) -> dict:
    """What the client may see: no risk estimate, no officer note."""
    keys = ("id", "created_at", "updated_at", "client_name", "status", "requested_credit", "term_months",
            "requested_instalment", "offer_credit", "offer_instalment", "decided_at", "responded_at")
    return {k: d.get(k) for k in keys}


def officer_summary(d: dict) -> dict:
    a = d["assessment"]
    sug = a.get("amount_suggestion") or {}
    return {**client_view(d), "client_phone": d["client_phone"],
            "probability_of_default": a.get("probability_of_default"), "lane": a.get("lane"), "model_used": a.get("model_used"),
            "within_cap": (a.get("sama_check") or {}).get("within_cap"), "eligible": (a.get("eligibility") or {}).get("eligible"),
            "suggested_credit": sug.get("suggested_credit") if sug.get("status") == "suggested" else None}


def build_router(score: Callable[[dict], dict], client: bool = True, officer_routes: bool = True) -> APIRouter:
    """score: takes the applicant dict (the /score body) and returns the assessment.
    client / officer_routes: which half to serve (the client site has no officer endpoints, and the other way round)."""
    r = APIRouter()

    def get(app_id: int) -> dict:
        with engine().connect() as c:
            row = c.execute(select(applications).where(applications.c.id == app_id)).first()
        if row is None:
            raise HTTPException(404, "Application not found.")
        return _row(row)

    def officer(code: Optional[str]) -> None:
        if (code or "") != OFFICER_CODE:
            raise HTTPException(401, "Wrong officer passcode.")

    # ---------------- client
    @r.post("/applications", tags=["client"])
    def file_application(body: ClientApplication):
        phone = norm_phone(body.client_phone)
        inst = instalment(body.AMT_CREDIT, body.term_months)
        applicant = {
            "age_years": body.age_years, "retired": body.retired, "AMT_INCOME_TOTAL": body.AMT_INCOME_TOTAL,
            "AMT_CREDIT": body.AMT_CREDIT, "AMT_ANNUITY": round(inst, 2), "AMT_GOODS_PRICE": body.AMT_CREDIT,
            "existing_monthly_obligations": body.existing_monthly_obligations, "CNT_FAM_MEMBERS": body.CNT_FAM_MEMBERS,
            "CNT_CHILDREN": body.CNT_CHILDREN, "employed_years": body.employed_years, "NAME_CONTRACT_TYPE": "Cash loans",
            "NAME_INCOME_TYPE": body.NAME_INCOME_TYPE, "NAME_EDUCATION_TYPE": body.NAME_EDUCATION_TYPE,
            "OCCUPATION_TYPE": body.OCCUPATION_TYPE,
            # clients do not know their bureau scores: the bank adds them; without them the fallback model is used
            "EXT_SOURCE_1": None, "EXT_SOURCE_2": None, "EXT_SOURCE_3": None,
        }
        assessment = score(applicant)
        t = now()
        with engine().begin() as c:
            res = c.execute(insert(applications).values(
                created_at=t, updated_at=t, client_name=body.client_name.strip(), client_phone=phone, status="submitted",
                requested_credit=body.AMT_CREDIT, term_months=body.term_months, requested_instalment=inst,
                applicant=applicant, assessment=assessment))
            new_id = res.inserted_primary_key[0]
        return client_view(get(new_id))

    @r.get("/applications", tags=["client"])
    def my_applications(phone: str):
        p = norm_phone(phone)
        with engine().connect() as c:
            rows = c.execute(select(applications).where(applications.c.client_phone == p).order_by(applications.c.id.desc())).all()
        return {"applications": [client_view(_row(x)) for x in rows]}

    @r.post("/applications/{app_id}/respond", tags=["client"])
    def respond(app_id: int, body: Respond):
        d = get(app_id)
        if d["client_phone"] != norm_phone(body.client_phone):
            raise HTTPException(404, "Application not found.")
        if d["status"] != "offered":
            raise HTTPException(409, "There is no open offer on this application.")
        t = now()
        with engine().begin() as c:
            c.execute(update(applications).where(applications.c.id == app_id).values(
                status="offer_accepted" if body.accept else "offer_declined", responded_at=t, updated_at=t))
        return client_view(get(app_id))

    # ---------------- officer
    @r.get("/officer/applications", tags=["officer"])
    def officer_list(x_officer_code: Optional[str] = Header(None)):
        officer(x_officer_code)
        with engine().connect() as c:
            rows = c.execute(select(applications).order_by(applications.c.id.desc())).all()
        return {"applications": [officer_summary(_row(x)) for x in rows]}

    @r.get("/officer/applications/{app_id}", tags=["officer"])
    def officer_get(app_id: int, x_officer_code: Optional[str] = Header(None)):
        officer(x_officer_code)
        d = get(app_id)
        return {**officer_summary(d), "officer_note": d["officer_note"], "applicant": d["applicant"], "assessment": d["assessment"]}

    @r.post("/officer/applications/{app_id}/decision", tags=["officer"])
    def decide(app_id: int, body: Decision, x_officer_code: Optional[str] = Header(None)):
        officer(x_officer_code)
        d = get(app_id)
        if d["status"] != "submitted":
            raise HTTPException(409, "This application already has a decision.")
        values: dict = {"officer_note": (body.note or "").strip() or None}
        if body.decision == "offer":
            if body.offer_credit is None or body.offer_credit >= d["requested_credit"]:
                raise HTTPException(422, "The offer must be an amount below the requested amount.")
            values.update(status="offered", offer_credit=body.offer_credit,
                          offer_instalment=instalment(body.offer_credit, d["term_months"]))
        else:
            values["status"] = "approved" if body.decision == "approve" else "rejected"
        t = now()
        with engine().begin() as c:
            c.execute(update(applications).where(applications.c.id == app_id).values(**values, decided_at=t, updated_at=t))
        return officer_get(app_id, x_officer_code)

    keep = {t for t, on in (("client", client), ("officer", officer_routes)) if on}
    r.routes = [x for x in r.routes if keep & set(getattr(x, "tags", None) or [])]
    return r
