software (fintech: credit decision support for consumer-loan officers)
deal: hero split · palette cool-white-slate (frost ground and a deep teal accent read as a bank's ledger and its approval stamp, plain and exact, nothing promotional) · type familjen (Familjen Grotesk + IBM Plex Mono; Arabic page adds IBM Plex Sans Arabic) · radius sharp (fintech) · nav nav-mega · footer footer-statement · close close-word · rhythm dark-band · buttons solid · mark arc · ground sky · effect silk-folds in the hero visual frame (band slot, quiet) · moment letters-assemble (statement section)

Voice: technical-dry (exact, not cold; sure, not loud). Person: "you" for the officer, the product is the subject in feature lines. Sentences 8 to 16 words. Humour: none. House words: file, lane, cap, officer, probability of default. Never: virtue words, a pun on the name, invented proof.

Fact sheet (README + manifest): calibrated probability of default; lanes fast (lowest-risk 30%, PD <= 2.6%), standard, strict (highest-risk 10%, PD >= 19.6%); SAMA cap 1/3 of gross salary employees, 25% retirees; top 5 factors; fallback model when external scores are missing; amount suggestion up to 30% less; early warning, arrears within 3 months; trained on 307,511 Home Credit applications; AUC main 0.791, fallback 0.766, monotone 0.788, early warning 0.678. Limit: non-Saudi public data, must be re-validated; decision support only. Enemy: reviewing every low-risk file by hand. Offer: no price. Main action: Assess an application (opens /en/assess).

Sections (1440x900):
1 hero (1) split: h1 + lead + 2 buttons + 3 facts (one count) | the assessment card UI on silk-folds, one float card (suggested amount) · object
2 #queue app-frame (1): applications ranked by risk beside the open assessment · object (app-frame)
3 #lanes (1) split-text-left: lanes diagram (application -> risk model -> fast / standard / strict), pulsing · diagram
4 #rules (1) dark-band, two open cards: SAMA cap bar fragment, amount before/after fragment · fragments
5 #statement (1) letters-assemble: "The officer decides" + one line · type moment
6 #portfolio (1) split: early-warning table fragment · object (third and last)
7 #models (1) calm: rows--spec of the four models + the one admission · specs table (no picture allowed)
8 footer.closing (1): close-word + footer-statement links
