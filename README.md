# Mizan – Credit Intelligence Platform

**Mizan** is a machine-learning platform that supports credit decisions: it helps a loan officer decide on consumer-loan applications. For each application it estimates the **probability of default**, routes the application to a **review lane**, checks the **SAMA salary-linked obligation cap** and an age-eligibility rule, and **explains** the main factors behind the estimate.

The product is **decision support only**: it never approves or rejects an application by itself.

## 1. The product in brief

| Question the officer has | What the product answers |
|---|---|
| How likely is this applicant to default? | A calibrated probability (a predicted 10% means about 10% of such applicants default) |
| How much attention does the file need? | Review lane: **fast** (lowest-risk 30%), **standard**, or **strict review** (highest-risk 10%) |
| Does the loan respect the regulation? | SAMA salary-linked obligation cap: 1/3 of gross salary for employees, 25% for retirees |
| Is the applicant eligible by age? | Age rule applied outside the model (example limits, to be set by the bank) |
| Why this result? | The five factors that moved the estimate most, with their direction |
| What if external credit scores are missing? | A fallback model without them is used automatically |

Phase 2 (connected in the API, not yet in the web UI): every `/score` response includes an `amount_suggestion` (Model 3: the largest amount, down to -30%, that satisfies the SAMA cap and the risk threshold), and `/early-warning` scores running contracts from their monthly payment history (Model 4). The amount-suggestion noise gate needs the five `3_monotone__lightgbm__fold*.txt` files from the notebook's `home_credit_runs/models/` folder; without them it is skipped and `noise_gate_applied` is `false`.

**Client applications (demo).** Clients apply at `/en/apply` and follow their applications at `/en/my-applications` (identified by mobile number, no password). Officers review them at `/en/inbox` (demo passcode from the `OFFICER_CODE` environment variable, `mizan-demo` if unset): each application shows Mizan's assessment, and the officer approves, sends an alternative offer (pre-filled with Model 3's suggestion) or rejects. The client then accepts or declines an offer. Applications are stored through SQLAlchemy: in Postgres when `DATABASE_URL` is set (the Render blueprint creates the database), otherwise in a local SQLite file `data/mizan.db`. The demo access is not secure enough for real customers.

**Two sites.** The same code deploys as two sites on Render (see `render.yaml`), sharing one database: the **client site** (`MIZAN_SITE=client`, home, apply, my applications) and the **officer site** (`MIZAN_SITE=officer`, landing, inbox, manual assessment, portfolio; behind one staff sign-in with OFFICER_CODE). Each serves only its own pages and API endpoints. Build both exports with `npm run build:sites` in `web/` (to `web/out-client` and `web/out-officer`). To run them locally: `env MIZAN_SITE=client MIZAN_WEB_DIR=web/out-client .venv/bin/python -m uvicorn api.main:app --port 8001` and the same with `officer`, `web/out-officer` and port 8002.

Gender and age are **not** model inputs. Age is only an eligibility rule; gender and age are used only to audit performance by group.

## 2. Problem and data

Loan officers review every application manually although most are low risk. The models are trained on the Home Credit Default Risk data: 307,511 historical applications with their repayment outcome, plus credit-bureau, previous-application, instalment, credit-card and monthly-payment tables. Only information available before the application date is used.

**Data.** The data is **not stored in this repository**. Download it from the Kaggle competition page: https://www.kaggle.com/c/home-credit-default-risk/data (8 CSV files). It is only needed to retrain the models with the notebook; running the app needs the trained models in `models/final/`, which are included.

## 3. Results

Five-fold stratified cross-validation, identical folds for all algorithms, every row predicted by models that did not train on it. Full table: [`summary.csv`](summary.csv).

| Model | Purpose | Algorithm served | AUC | PR-AUC |
|---|---|---|---|---|
| 1. Default risk | Main probability of default | Ensemble (LightGBM + XGBoost + CatBoost) | 0.7907 | 0.2864 |
| 2. Fallback | No external credit scores | Ensemble | 0.7664 | 0.2525 |
| 3. Monotone | Loan-amount suggestion (phase 2) | LightGBM | 0.7881 | 0.2817 |
| 4. Early warning | New arrears within 3 months (phase 2) | LightGBM | 0.6783 | 0.1451 |

Model 1, single algorithms: logistic regression 0.7752, LightGBM 0.7885, XGBoost 0.7867, CatBoost 0.7862. Boosting beats the linear baseline; the differences between boosting algorithms are small, and the ensemble adds about 0.002 AUC.

Note: the ensemble row of Model 4 in `summary.csv` (AUC 0.5007) is a known reporting error caused by stale cached predictions and is not a result. Model 4 is evaluated by its single algorithms. The served Model 4 is not affected.

Probability calibration, segment audit, lane statistics and the interpretation of every result are in the training notebook.

## 4. Run the platform

Requires Python 3.9 or newer.

```bash
git clone https://github.com/nnnoufff/Mizan-credit-intelligence.git
cd Mizan-credit-intelligence
```

Run all commands below from the project folder (the folder containing this README).

**Windows (PowerShell)**
```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn api.main:app --reload
```

**macOS / Linux**
```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn api.main:app --reload
```

Then open:
- Web UI: http://127.0.0.1:8000/
- API documentation: http://127.0.0.1:8000/docs

The commands call the virtual environment's Python directly, so no activation step is needed.

**New web app (Next.js, English + Arabic)**

The redesigned site lives in `web/` and talks to the API above (keep it running on port 8000). Requires Node.js 20 or newer.
```bash
cd web
npm install
npm run dev
```
Then open http://localhost:3000 (English) or http://localhost:3000/ar (Arabic, right-to-left). Pages: landing, `/assess` (new application), `/portfolio` (early warning), `/models`. Set `MIZAN_API_URL` if the API runs elsewhere. Design decisions: `web/design-system/mizan/MIZAN-OVERRIDES.md`.

**Deploy (one service on Render)**

FastAPI serves both the API and the website: the website is the static export in `web/out` (committed), so Render only needs Python.

- Render: New, Web Service (or Blueprint with `render.yaml`), this repository and branch. Build `pip install -r requirements.txt`, start `uvicorn api.main:app --host 0.0.0.0 --port $PORT`, environment variable `PYTHON_VERSION=3.13.2`.
- Open the service URL: `/` goes to the website (`/en/`, `/ar/`), the API answers at `/api/...` (and at the original paths such as `/score`), the docs at `/docs`.
- After changing the website, rebuild the export and commit it: `cd web && npm run build` (optionally `SITE_URL=https://your-service.onrender.com npm run build` so share images use the real address).
- On the free plan the service sleeps after 15 minutes idle; the first visit then takes about a minute.

**Example API request**
```bash
curl -X POST http://127.0.0.1:8000/score -H "Content-Type: application/json" -d "{\"age_years\":35,\"AMT_INCOME_TOTAL\":15000,\"AMT_CREDIT\":300000,\"AMT_ANNUITY\":9000,\"EXT_SOURCE_2\":0.6}"
```

**Tests**
```bash
.\.venv\Scripts\python -m pytest
```

### If the page does not open
1. The server prints `Uvicorn running on http://127.0.0.1:8000`. If it does not, read the error above that line.
2. `No module named uvicorn` or `fastapi`: the packages were not installed in the environment that runs the command; use the commands above exactly.
3. `address already in use`: another program uses port 8000. Start with `--port 8010` and open http://127.0.0.1:8010/.
4. Library-version warning in `/health`: install the versions listed under `library_versions` in `models/final/manifest.json`.

## 5. Repository structure

```
api/main.py              FastAPI service: /, /health, /options, /score, /score/demo/{id}, /early-warning, /early-warning/batch
api/static/index.html    Web UI served by the API
src/hc_app/scoring.py    Scoring, explanation, SAMA and eligibility logic
models/final/            Trained models, calibrators, manifest.json (data files are not committed)
notebooks/               Training notebook (see below)
docs/                    Explanation of the models, the pipeline and the files
tests/                   Automated tests
summary.csv              Cross-validated results of every experiment
requirements.txt         Python dependencies
```

Detailed explanation of the models, the pipeline and every file: [docs/MODELS_AND_PIPELINE.md](docs/MODELS_AND_PIPELINE.md).

The training notebook (`home_credit_pipeline_colab.ipynb`) rebuilds everything from the raw CSV files on Google Colab. Put it in `notebooks/`.

## 6. Limitations

- The data is not Saudi data and the income period is undocumented; income is treated as monthly. Results must be re-validated on the bank's own portfolio.
- Manual entry has no bureau or previous-loan history, so those inputs are missing; the demo applicants carry the full history.
- Age limits are example values, not SAMA figures.
- Explanations show the model's contributions, not causes.
- Models are pickles: library versions must match `manifest.json`.
- The demo-applicants tab needs `models/final/demo_applicants.parquet`, which is not committed because it contains rows of the competition data. Without it the app still works with manual entry; the notebook (step 19) regenerates the file.

## Team members

- Nouf
- Mohammed
- Razan
- Nouf
