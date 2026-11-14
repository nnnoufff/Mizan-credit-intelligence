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
