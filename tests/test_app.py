import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
MODEL_DIR = Path(os.environ.get("HC_MODEL_DIR", ROOT / "models" / "final"))
pytestmark = pytest.mark.skipif(not (MODEL_DIR / "manifest.json").exists(), reason="model bundle not found")

APPLICANT = dict(age_years=35, AMT_INCOME_TOTAL=15000, AMT_CREDIT=300000, AMT_ANNUITY=9000, AMT_GOODS_PRICE=300000, EXT_SOURCE_2=0.6)


def test_score_range_and_lane():
    from hc_app.scoring import Scorer, build_row
    s = Scorer(MODEL_DIR)
    out = s.score(build_row({**APPLICANT, "CNT_FAM_MEMBERS": 2}))
    assert 0 <= out["pd"].iloc[0] <= 1 and out["lane"].iloc[0] in {"fast", "normal", "high_risk"}


def test_fallback_used_without_external_scores():
    from hc_app.scoring import Scorer, build_row
    a = {**APPLICANT}; a.pop("EXT_SOURCE_2")
    assert Scorer(MODEL_DIR).score(build_row(a))["model_used"].iloc[0] == "2_fallback"


def test_sama_cap():
    from hc_app.scoring import Scorer
    s = Scorer(MODEL_DIR)
    assert s.sama_check(15000, 4000, False)["within_cap"] and not s.sama_check(15000, 6000, False)["within_cap"]
    assert not s.sama_check(15000, 4000, True)["within_cap"]          # retirees: 25% cap


def test_api():
    os.environ["HC_MODEL_DIR"] = str(MODEL_DIR)
    from fastapi.testclient import TestClient
    from api.main import app
    c = TestClient(app)
    assert c.get("/health").json()["status"] == "ok"
    r = c.post("/score", json=APPLICANT).json()
    assert 0 <= r["probability_of_default"] <= 1 and len(r["top_factors"]) == 5 and r["decision_support_only"]
    assert c.post("/score", json={**APPLICANT, "AMT_INCOME_TOTAL": -1}).status_code == 422


def test_amount_suggestion():
    from hc_app.scoring import Scorer, build_row
    s = Scorer(MODEL_DIR)
    base = dict(AMT_INCOME_TOTAL=15000, AMT_CREDIT=300000, AMT_GOODS_PRICE=300000, EXT_SOURCE_2=0.6, CNT_FAM_MEMBERS=2)
    assert s.suggest_amount(build_row({**base, "AMT_ANNUITY": 4000}), False)["status"] == "not_needed"
    r = s.suggest_amount(build_row({**base, "AMT_ANNUITY": 5500}), False)   # 36.7% > 1/3 cap -> a ~10% cut fixes it
    assert r["status"] == "suggested" and 0 < r["reduction"] <= 0.3
    assert r["suggested_instalment"] <= r["max_instalment_sama"] + 1e-6 and r["monotone_risk_suggested"] <= r["risk_threshold"]
    assert 0 <= r["probability_of_default_suggested"] <= 1
    assert s.suggest_amount(build_row({**base, "AMT_ANNUITY": 9000}), False)["status"] == "not_reachable"   # needs > 30% cut


def test_shrink_keeps_term_and_updates_ratios():
    from hc_app.scoring import build_row, shrink
    row = build_row(dict(AMT_INCOME_TOTAL=10000, AMT_CREDIT=200000, AMT_ANNUITY=3000, AMT_GOODS_PRICE=200000, CNT_FAM_MEMBERS=2))
    d = shrink(row, 0.8)
    assert d["AMT_CREDIT"].iloc[0] == 160000 and d["AMT_ANNUITY"].iloc[0] == 2400
    assert abs(d["aff_annuity_to_income"].iloc[0] - 0.24) < 1e-9 and abs(d["aff_dti_total_est"].iloc[0] - 0.24) < 1e-9
    assert d["aff_credit_to_annuity_term"].iloc[0] == row["aff_credit_to_annuity_term"].iloc[0]


def test_early_warning_features_and_score():
    from hc_app.scoring import Scorer, early_warning_features
    hist = [dict(dpd=d, inst_total=12, inst_left=12 - i) for i, d in enumerate([0, 0, 5, 30, 10, 0])]
    f = early_warning_features(hist)
    assert f["dpd_max_l3"] == 30 and f["dpd_max_all"] == 30 and f["dpd_share_l6"] == 0.5 and f["months_on_book"] == 6
    assert f["paid_down_l3"] == 3 and abs(f["share_left"] - 7 / 12) < 1e-9
    s = Scorer(MODEL_DIR)
    clean = s.early_warning([dict(dpd=0, inst_total=24, inst_left=24 - i) for i in range(8)])
    late = s.early_warning(hist)
    assert clean["status"] == late["status"] == "scored" and clean["probability_of_arrears_3m"] < late["probability_of_arrears_3m"]
    assert s.early_warning(hist + [dict(dpd=12, inst_total=12, inst_left=6)])["status"] == "already_in_arrears"


def test_api_phase2():
    os.environ["HC_MODEL_DIR"] = str(MODEL_DIR)
    from fastapi.testclient import TestClient
    from api.main import app
    c = TestClient(app)
    assert c.get("/health").json()["phase2"]["early_warning"]
    assert c.post("/score", json=APPLICANT).json()["amount_suggestion"]["available"]
    hist = [{"dpd": 0, "inst_total": 24, "inst_left": 24 - i} for i in range(8)]
    r = c.post("/early-warning", json={"contract_id": "A1", "history": hist}).json()
    assert r["contract_id"] == "A1" and 0 <= r["probability_of_arrears_3m"] <= 1
    late = [{"dpd": d, "inst_total": 12, "inst_left": 12 - i} for i, d in enumerate([0, 0, 5, 30, 10, 0])]
    b = c.post("/early-warning/batch", json={"contracts": [{"contract_id": "A1", "history": hist}, {"contract_id": "B2", "history": late}]}).json()
    assert [x["contract_id"] for x in b["results"]] == ["B2", "A1"]
    assert c.post("/early-warning", json={"history": []}).status_code == 422


def test_ui_and_demo_applicants():
    os.environ["HC_MODEL_DIR"] = str(MODEL_DIR)
    from fastapi.testclient import TestClient
    from api.main import app
    c = TestClient(app)
    assert "Mizan" in c.get("/").text
    assert "NAME_INCOME_TYPE" in c.get("/options").json()
    if (MODEL_DIR / "demo_applicants.parquet").exists():
        ids = c.get("/demo/ids").json()
        r = c.post(f"/score/demo/{ids[0]}").json()
        assert 0 <= r["probability_of_default"] <= 1 and r["applicant"]["id"] == ids[0]
        assert c.post("/score/demo/1").status_code == 404


def test_one_service_serves_website_and_api():
    os.environ["HC_MODEL_DIR"] = str(MODEL_DIR)
    from fastapi.testclient import TestClient
    from api.main import app, WEB_DIR
    c = TestClient(app)
    assert c.get("/api/health").json()["status"] == "ok"
    assert 0 <= c.post("/api/score", json=APPLICANT).json()["probability_of_default"] <= 1
    assert c.post("/score", json=APPLICANT).status_code == 200          # the original paths still answer
    if (WEB_DIR / "en" / "index.html").exists():
        r = c.get("/", follow_redirects=False)
        assert r.status_code in (302, 307) and r.headers["location"] == "/en/"
        assert "Credit risk scoring" in c.get("/en/").text
        assert c.get("/ar/assess/").status_code == 200
