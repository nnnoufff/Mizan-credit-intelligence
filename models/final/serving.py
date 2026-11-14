"""Scoring code for the website. Put this file next to manifest.json and the *.pkl files.
    from serving import Scorer
    s = Scorer("path/to/final"); out = s.score(df)
df = one row per applicant with ALL model feature columns already built (same engineered features as the notebook).
Returns a DataFrame: pd (calibrated probability of default), model_used, lane."""
import json, pickle
from pathlib import Path
import numpy as np, pandas as pd


class Scorer:
    def __init__(self, folder):
        self.f = Path(folder); self.man = json.loads((self.f / "manifest.json").read_text(encoding="utf-8"))
        self.models = {t: [(a, pickle.load(open(self.f / f"{t}__{a}.pkl", "rb"))) for a in algos] for t, algos in self.man["final_models"].items()}
        self.cal = {k: pickle.load(open(self.f / v, "rb")) for k, v in self.man["calibrators"].items()}

    def _prep(self, df, feats):
        X = df.reindex(columns=feats).copy(); lv = self.man["categorical_levels"]
        for c in feats:
            X[c] = pd.Categorical(X[c].astype(object).where(X[c].notna()), categories=lv[c]) if c in lv else X[c].astype("float32")
        return X

    def _predict(self, task, X):
        cat = [c for c in X.columns if c in self.man["categorical_levels"]]; ps = []
        for a, m in self.models[task]:
            if a == "lightgbm":
                ps.append(m.predict(X))
            elif a == "xgboost":
                ps.append(m.predict_proba(X.replace([np.inf, -np.inf], np.nan))[:, 1])
            else:
                Xc = X.copy()
                for c in cat:
                    Xc[c] = Xc[c].astype(object).where(Xc[c].notna(), "NA").astype(str)
                ps.append(m.predict_proba(Xc.replace([np.inf, -np.inf], np.nan))[:, 1])
        return np.mean(ps, axis=0)

    def score(self, df):
        feats = self.man["features"]
        ext_missing = df[["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]].isna().all(axis=1).values
        p_main = self.cal["main"].predict(self._predict("1_main", self._prep(df, feats["main"])))
        p_fb = self.cal["fallback"].predict(self._predict("2_fallback", self._prep(df, feats["fallback"])))
        pdv = np.where(ext_missing, p_fb, p_main); L = self.man["lanes"]
        lane = np.where(pdv <= L["fast_max_pd"], "fast", np.where(pdv >= L["high_risk_min_pd"], "high_risk", "normal"))
        return pd.DataFrame({"pd": pdv, "model_used": np.where(ext_missing, "2_fallback", "1_main"), "lane": lane}, index=df.index)
