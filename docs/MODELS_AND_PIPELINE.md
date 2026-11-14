# Models, pipeline and files

This document explains what was built, in what order, and what each file is for. Numbers come from `summary.csv` and from the training notebook outputs.

## 1. End-to-end flow

```
Raw CSV files (8 tables)
   -> Step 1  convert to Parquet
   -> Step 2  feature engineering (one row per client, only data before the application)
   -> Step 3  input plausibility + age-eligibility rules          (rules, no model)
   -> Step 4  SAMA affordability cap                              (rule, no model)
   -> Model 1  default risk            -> calibration -> lanes / explanations / confidence
   -> Model 2  fallback (no external scores)
   -> Model 3  monotone risk           -> loan-amount suggestion (with the SAMA cap)
   -> Model 4  early warning (monthly payments)
   -> Final training on 100% of the data + deployment bundle
   -> FastAPI service + web UI
```

At decision time the service does this for one application:

1. Build the model inputs from the entered fields (and, for demo applicants, the stored history).
2. If all three external scores are missing, use **Model 2**, otherwise **Model 1**.
3. Average the ensemble members, apply the **isotonic calibrator** to get a probability.
4. Assign the lane from two thresholds saved in `manifest.json`.
5. Compute SHAP contributions with the LightGBM member and show the top five factors.
6. Check the SAMA cap and the age-eligibility rule.

## 2. The four models

| # | Model | Question | Algorithms compared | Served | Status in the app |
|---|---|---|---|---|---|
| 1 | Default risk | How likely is this applicant to default? | Logistic regression, LightGBM, XGBoost, CatBoost, ensemble | Ensemble | Used |
| 2 | Fallback | Same, when external credit scores are missing | Same four + ensemble | Ensemble | Used (automatic) |
| 3 | Monotone risk | What smaller amount would pass the cap and the risk threshold? | LightGBM, XGBoost, ensemble | LightGBM | Saved, not connected yet |
| 4 | Early warning | Will a running contract fall into arrears in the next 3 months? | Same four + ensemble | LightGBM | Saved, not connected yet |

**Dependencies.** Models 1, 2, 3 and 4 are trained independently of each other. Calibration, lanes, explanations and confidence depend on Model 1. The amount suggestion depends on Model 3 and on the SAMA cap rule.

**Model 1 ensemble.** Three boosting models trained on 100% of the data; their probabilities are averaged and then calibrated. Chosen because it had the highest cross-validated AUC and PR-AUC; the gain over the best single model is small, so it trades simplicity for accuracy by team decision.

**Model 3 constraint.** Predicted risk can never fall when the credit amount, instalment or debt ratios increase. It prevents suggestions such as "borrow more to look safer".

## 3. Evaluation design

- Five-fold stratified cross-validation, fixed seed, identical folds for all algorithms.
- Every row is predicted by models that did not train on it.
- Early stopping uses a 15% slice of the training part only.
- Model 4 uses folds grouped by client, so no client appears in both the training and test parts.

| Metric | Why it is used |
|---|---|
| AUC | Ranking quality; lanes depend on ranking |
| PR-AUC | Capture of the rare defaulters |
| Brier score | Accuracy of the probabilities |
| ECE | Calibration: does a predicted 10% mean 10%? |

## 4. Training notebook

`home_credit_pipeline_colab.ipynb` runs on Google Colab and is organised in sections: configuration, data preparation, then one section per model (comparison, interpretation, final training and saving), and a closing section with the model-selection summary, decision log, conclusions, limitations and next steps. Experiments and models are saved to Google Drive as they finish, so an interrupted run resumes.

Output folder on Drive (`home_credit_runs`):

| Path | Content |
|---|---|
| `experiments/` | Metrics (`.json`) and out-of-fold predictions (`.npy`) of every experiment |
| `models/` | LightGBM fold models used for confidence and the amount-suggestion noise gate |
| `final/` | Final models, calibrators, manifest, serving code, demo applicants |
| `summary.csv` | All experiments in one table |
| `model_selection_summary.csv` | One row per delivered model |
| `step3_input_rules.csv`, `step7_segment_auc.csv`, `step9_lanes.csv` | Rule counts, performance by segment, lane statistics |

## 5. Files in this repository

| File | Purpose |
|---|---|
| `api/main.py` | FastAPI application. Endpoints: `/` (web UI), `/health` (status and model metrics), `/options` (drop-down values), `/score` (score an applicant from entered fields), `/demo/ids` and `/score/demo/{id}` (score a stored applicant with full history). Documentation at `/docs`. |
| `api/static/index.html` | Single-page web UI (manual entry and demo applicants), served by the API. |
| `src/hc_app/scoring.py` | `Scorer` loads the bundle and scores, explains and applies the SAMA and eligibility rules. `build_row` turns entered fields into model inputs and derives the affordability ratios. `assess` returns the full result. |
| `models/final/manifest.json` | Feature lists per model, categorical levels, lane thresholds, SAMA parameters, eligibility ages, amount-suggestion settings, Arabic labels, cross-validated metrics, library versions. |
| `models/final/*.pkl` | Pickled final models (`<task>__<algorithm>.pkl`) and the two probability calibrators. |
| `models/final/serving.py` | Standalone scoring code generated by the notebook (the repository uses `src/hc_app/scoring.py`). |
| `models/final/demo_applicants.parquet` | (Not committed: contains competition data.) 300 unlabeled applicants with their full history, for the demo tab. Generated by notebook step 19. |
| `models/final/application_test_scores.csv` | (Not committed.) Model 1 scores of the competition test file, generated by notebook step 11. |
| `tests/test_app.py` | Tests: score range, fallback switch, SAMA cap, API endpoints, UI, demo applicants. |
| `summary.csv` | Cross-validated results of every experiment. |
| `requirements.txt` | Dependencies. Model libraries must match `library_versions` in the manifest. |

## 6. Design decisions that matter

| Decision | Reason |
|---|---|
| Gender and age excluded from the models | Non-discrimination; age is an explicit eligibility rule |
| Only data before the application date | No leakage from later events |
| Calibrated probabilities | Lanes, the SAMA check and amount suggestions use the probability value |
| Separate fallback model | The main model relies on the external scores |
| Policy rules outside the models | SAMA cap and age limits should be explicit and auditable |
| Income treated as monthly | The dataset does not document the period; annual would make nearly every approved loan break the cap |
| Final models trained on 100% of the data | Uses all data; tree counts come from cross-validation |

## 7. Maintenance notes

- To retrain, run the notebook on Colab and replace `models/final/` with the new `final/` folder.
- Keep `lightgbm`, `xgboost` (2.1.4), `scikit-learn` and `catboost` aligned with the versions in `manifest.json`.
- The Model 4 ensemble row in `summary.csv` is a stale-cache artefact; the single algorithms are valid.
- Next work: connect Models 3 and 4 to the application, set the bank's age limits, re-validate and recalibrate on the bank's own portfolio, add monitoring.
