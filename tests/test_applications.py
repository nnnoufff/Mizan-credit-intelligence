"""Client applications: file -> officer decision -> client answer, on a temporary SQLite database."""
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
MODEL_DIR = Path(os.environ.get("HC_MODEL_DIR", ROOT / "models" / "final"))
pytestmark = pytest.mark.skipif(not (MODEL_DIR / "manifest.json").exists(), reason="model bundle not found")

CODE = {"X-Officer-Code": "mizan-demo"}
AHMED = dict(client_name="Ahmed", client_phone="+966 50 123 4567", age_years=34, employed_years=6, AMT_INCOME_TOTAL=15000,
             existing_monthly_obligations=2000, AMT_CREDIT=150000, term_months=48, NAME_INCOME_TYPE="Working")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    from api import applications
    applications.reset_engine()
    from fastapi.testclient import TestClient
    from api.main import app
    yield TestClient(app)
    applications.reset_engine()


def test_file_offer_accept(client):
    r = client.post("/api/applications", json=AHMED)
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["status"] == "submitted" and a["requested_instalment"] == pytest.approx(3750)
    assert "probability_of_default" not in a            # the client never sees the risk estimate

    mine = client.get("/api/applications", params={"phone": "0501234567966"}).json()["applications"]
    assert mine == []                                    # another phone sees nothing
    mine = client.get("/api/applications", params={"phone": "966501234567"}).json()["applications"]
    assert [x["id"] for x in mine] == [a["id"]]

    assert client.get("/api/officer/applications").status_code == 401
    inbox = client.get("/api/officer/applications", headers=CODE).json()["applications"]
    assert inbox[0]["id"] == a["id"] and 0 <= inbox[0]["probability_of_default"] <= 1
    assert inbox[0]["within_cap"] is False               # (3,750 + 2,000) / 15,000 = 38.3% > one third

    detail = client.get(f"/api/officer/applications/{a['id']}", headers=CODE).json()
    assert detail["assessment"]["model_used"] == "2_fallback"   # clients do not enter bureau scores

    bad = client.post(f"/api/officer/applications/{a['id']}/decision", headers=CODE, json={"decision": "offer", "offer_credit": 200000})
    assert bad.status_code == 422
    d = client.post(f"/api/officer/applications/{a['id']}/decision", headers=CODE,
                    json={"decision": "offer", "offer_credit": 120000, "note": "Fits the salary cap"}).json()
    assert d["status"] == "offered" and d["offer_instalment"] == pytest.approx(3000)
    again = client.post(f"/api/officer/applications/{a['id']}/decision", headers=CODE, json={"decision": "approve"})
    assert again.status_code == 409

    wrong = client.post(f"/api/applications/{a['id']}/respond", json={"client_phone": "0555555555", "accept": True})
    assert wrong.status_code == 404
    ok = client.post(f"/api/applications/{a['id']}/respond", json={"client_phone": "966501234567", "accept": True}).json()
    assert ok["status"] == "offer_accepted" and "officer_note" not in ok
    assert client.post(f"/api/applications/{a['id']}/respond", json={"client_phone": "966501234567", "accept": False}).status_code == 409


def test_approve_and_reject(client):
    ids = [client.post("/api/applications", json={**AHMED, "AMT_CREDIT": 60000}).json()["id"] for _ in range(2)]
    assert client.post(f"/api/officer/applications/{ids[0]}/decision", headers=CODE, json={"decision": "approve"}).json()["status"] == "approved"
    assert client.post(f"/api/officer/applications/{ids[1]}/decision", headers=CODE, json={"decision": "reject"}).json()["status"] == "rejected"
    # no offer to answer on an approved application
    assert client.post(f"/api/applications/{ids[0]}/respond", json={"client_phone": "966501234567", "accept": True}).status_code == 409


@pytest.mark.parametrize("site", ["client", "officer"])
def test_site_split(site, tmp_path, monkeypatch):
    """Each site serves only its own half of the API, on the same database."""
    import importlib
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'split.db'}")
    monkeypatch.setenv("MIZAN_SITE", site)
    from api import applications
    applications.reset_engine()
    import api.main
    m = importlib.reload(api.main)
    from fastapi.testclient import TestClient
    c = TestClient(m.app)
    assert c.get("/api/health").status_code == 200
    filing = c.post("/api/applications", json=AHMED).status_code
    inbox = c.get("/api/officer/applications", headers=CODE).status_code
    score = c.post("/api/score", headers=CODE, json=dict(age_years=35, AMT_INCOME_TOTAL=15000, AMT_CREDIT=300000, AMT_ANNUITY=9000)).status_code
    if site == "client":
        assert filing == 200 and inbox in (404, 405) and score in (404, 405)
    else:
        assert filing in (404, 405) and inbox == 200 and score == 200
    monkeypatch.delenv("MIZAN_SITE")
    applications.reset_engine()
    importlib.reload(api.main)


def test_officer_tools_need_the_passcode(client):
    """Scoring and early warning are officer tools: no passcode, no answer; the sign-in check says which."""
    body = dict(age_years=35, AMT_INCOME_TOTAL=15000, AMT_CREDIT=300000, AMT_ANNUITY=9000)
    assert client.post("/api/score", json=body).status_code == 401
    assert client.post("/api/score", headers=CODE, json=body).status_code == 200
    assert client.post("/api/early-warning/batch", json={"contracts": [{"history": [{"dpd": 0}]}]}).status_code == 401
    assert client.get("/api/officer/check").status_code == 401
    assert client.get("/api/officer/check", headers={"X-Officer-Code": "wrong"}).status_code == 401
    assert client.get("/api/officer/check", headers=CODE).json() == {"ok": True}
    assert client.get("/api/options").status_code == 200          # the client form still loads its options
