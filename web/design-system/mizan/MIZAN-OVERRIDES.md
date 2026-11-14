# Mizan design decisions (override MASTER.md)

> Read order: **this file → `pages/<page>.md` (if any) → MASTER.md**. Where this file and MASTER.md disagree, this file wins.
> Sources: ui-ux-pro-max searches (design system, `color`, `typography`, `google-fonts`, `chart`, `ux`, `--stack nextjs`, `--rtl`), Nov 2026.

## 1. Direction

| Decision | Choice | Why |
|---|---|---|
| Product type | Banking / Traditional Finance + Financial Dashboard | Loan-officer decision tool, not a crypto/consumer app |
| Style | **Minimalism & Swiss Style** | Enterprise dashboards; accessibility risk low; **rtl_level: full** (mirrors to Arabic with no rework) |
| Landing pattern | Trust & Authority | Hero (mission) → proof (model results) → how it works → CTA |
| Avoid | Glassmorphism, neon/OLED crypto look, purple/pink AI gradients, playful styles | Rejected by the skill for banking; first palette result (gold + purple on dark) dropped for this reason |

## 2. Colour tokens (overrides MASTER palette)

Navy for trust, **gold accent** (fits *Mizan* = balance/scale), used sparingly (primary CTA + highlights only). All pairs checked ≥ 4.5:1.

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F8FAFC` | `#0B1220` |
| `--foreground` | `#020617` | `#F1F5F9` |
| `--card` | `#FFFFFF` | `#111A2E` |
| `--muted` | `#E8ECF1` | `#1A2440` |
| `--muted-foreground` | `#475569` | `#94A3B8` |
| `--border` | `#E2E8F0` | `#24304A` |
| `--primary` (navy) | `#0F172A` | `#E2E8F0` |
| `--primary-foreground` | `#FFFFFF` | `#0B1220` |
| `--secondary` (trust blue) | `#1E3A8A` | `#8FB4FF` |
| `--accent` (gold, CTA) | `#A16207` | `#E0B04A` |
| `--accent-foreground` | `#FFFFFF` | `#0B1220` |
| `--destructive` | `#DC2626` | `#FDA29B` |
| `--ring` | `#1E3A8A` | `#E0B04A` |

**Semantic risk tokens** (lanes, always paired with a text label and icon, never colour alone):

| Meaning | Text light / tint light | Text dark / tint dark |
|---|---|---|
| Fast lane (low risk) | `#067647` / `#ECFDF3` | `#6CE9A6` / `#0C2A1C` |
| Standard review | `#1D4ED8` / `#EFF4FF` | `#8FB4FF` / `#13203D` |
| Strict review (high risk) | `#B42318` / `#FEF3F2` | `#FDA29B` / `#321512` |

## 3. Typography (overrides MASTER fonts, which have no Arabic)

- **English:** IBM Plex Sans (skill pairing "Financial Trust": banks, fintech, data).
- **Arabic:** IBM Plex Sans Arabic (same family, same metrics, 100–700 weights).
- Numbers: tabular figures (`font-variant-numeric: tabular-nums`) in tables, KPIs and money.
- Base 16px, line-height 1.5 (Arabic 1.7), no body text below 12px.
- Load with `next/font/google` (no layout shift).

## 4. Bilingual and RTL

- Locales `en` and `ar`, route prefix `/en/...`, `/ar/...`; `<html lang dir>` set per locale.
- Tailwind **logical utilities only** (`ms-/me-/ps-/pe-/start-/end-/text-start`), never `ml-/mr-/left-/right-`.
- Mirror directional icons (arrows, chevrons) in RTL; do **not** mirror the risk gauge, charts' numeric axes, or numbers.
- Digits: Western digits (0–9) in both languages for financial figures (configurable later).
- Model factor names: use `arabic_labels` from `manifest.json` (API already returns `label_ar`).
- Fallback note: the skill's RTL `ux` search returned no direct match; these rules are standard practice, not a skill result.

## 5. Data visualisation (skill `chart` domain)

| Need | Chart | Rules |
|---|---|---|
| Probability of default | **Gauge / bullet chart** with the two lane cut-offs as markers (fast ≤ 2.6%, strict ≥ 19.6%) | Show the % and lane name as text beside it; zones labelled; one-row text fallback |
| Top 5 factors | **Horizontal bar**, diverging (raises / lowers risk), sorted by impact | Direct labels; direction shown by label + arrow, not only colour |
| Amount suggestion | Before → after comparison (requested vs suggested amount, instalment vs SAMA cap) | Plain numbers with thousand separators |
| SAMA cap | Bullet bar: obligations ratio vs cap (33% / 25%) | Ratio text always visible |
| Early warning (portfolio) | Sortable **table**, riskiest first, with a probability bar per row | Status badge with text; no tiers until thresholds are agreed |

## 6. Stack

- **Next.js (App Router)** + TypeScript + Tailwind CSS + shadcn/ui primitives.
- Talks to the existing FastAPI service (`/score`, `/options`, `/health`, `/early-warning`, `/early-warning/batch`); Python stays the single source of model logic.
- Icons: Lucide (SVG). No emoji icons.

## 7. Components shortlist (21st.dev → restyle with the tokens above)

| Use | Candidate |
|---|---|
| App shell | Dashboard Shell (isaiahbjork) or Sidebar (wensity): collapsible sidebar → drawer on mobile |
| Risk gauge | Gauge (designali-in) or HeroUI Meter (threshold colours, accessible label) |
| Application form | Stepper (corr / shadcnspace stepper-01) for grouped sections |
| Portfolio table | Data Table (ephraimduncan table-05) or Sortable Data Table (kuratlielia) |
| Landing hero | Financial Hero Section (uilayout.contact), toned down to Swiss minimal |

## 8. Pages

| Page | Content |
|---|---|
| `/` Landing | What Mizan does, decision-support disclaimer, 4 models + accuracy, how it works, CTA to the app |
| `/assess` New application | Grouped form (Applicant · Income & obligations · Loan · Credit scores) → results: gauge, lane, SAMA check, eligibility, factors, amount suggestion |
| `/portfolio` Early warning | Add/upload running contracts → ranked table |
| `/models` About the models | Model cards, AUC/PR-AUC, limitations (from README) |
