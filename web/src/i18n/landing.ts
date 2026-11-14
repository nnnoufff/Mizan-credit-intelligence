// Landing page text, English and Arabic. Every figure is real model output (see .taste-skill/plan.md).
import type { Locale } from "./dict";

type Lane = "strict" | "standard" | "fast";
const QUEUE: { id: string; amount: string; above: boolean; lane: Lane; pd: string }[] = [
  { id: "A-2046", amount: "320,000", above: true, lane: "strict", pd: "22.9%" },
  { id: "A-2043", amount: "450,000", above: true, lane: "strict", pd: "19.8%" },
  { id: "A-2049", amount: "260,000", above: true, lane: "standard", pd: "15.8%" },
  { id: "A-2045", amount: "90,000", above: false, lane: "standard", pd: "14.8%" },
  { id: "A-2041", amount: "300,000", above: true, lane: "standard", pd: "13.0%" },
  { id: "A-2047", amount: "400,000", above: false, lane: "standard", pd: "9.3%" },
  { id: "A-2048", amount: "120,000", above: false, lane: "standard", pd: "5.7%" },
  { id: "A-2050", amount: "600,000", above: false, lane: "standard", pd: "5.7%" },
  { id: "A-2042", amount: "180,000", above: false, lane: "standard", pd: "4.9%" },
  { id: "A-2044", amount: "250,000", above: false, lane: "standard", pd: "4.4%" },
];
// contract, chance of arrears in 3 months (null = not scored), last-3-months status key, bar colour
const CONTRACTS: { id: string; p: number | null; st: "late30" | "late2" | "late3" | "late12" | "ontime" | "arrears" }[] = [
  { id: "C-1042", p: 69.3, st: "late30" }, { id: "C-0932", p: 29.2, st: "late2" }, { id: "C-0877", p: 14.7, st: "late3" },
  { id: "C-1188", p: 11.8, st: "late12" }, { id: "C-2210", p: 9.7, st: "ontime" }, { id: "C-2754", p: 4.8, st: "ontime" },
  { id: "C-0415", p: 3.1, st: "ontime" }, { id: "C-3391", p: 1.4, st: "ontime" }, { id: "C-0560", p: null, st: "arrears" },
];
// factor label, direction, relative width (largest = 100)
const FACTOR_W: { key: string; dir: "up" | "down"; w: number }[] = [
  { key: "term", dir: "down", w: 100 }, { key: "registration", dir: "up", w: 52 }, { key: "education", dir: "down", w: 36 },
  { key: "idDoc", dir: "up", w: 28 }, { key: "instalment", dir: "down", w: 23 },
];
const AUC = [
  { key: "risk", base: 0.775, model: 0.791 },
  { key: "fallback", base: 0.745, model: 0.766 },
  { key: "ew", base: 0.638, model: 0.678 },
] as const;

const en = {
  title: "Mizan: credit risk scoring for loan officers",
  description: "Mizan estimates each applicant’s probability of default, routes the file to a review lane and checks the SAMA obligation cap before an officer decides.",
  ogDescription: "Probability of default, review lanes and the SAMA cap for every consumer-loan file.",
  name: "Mizan",
  skip: "Skip to content",
  navMain: "Main",
  menu: "Menu",
  nav: {
    product: "Product", lanes: "Lanes", portfolio: "Portfolio", models: "Models",
    groupAssess: "Assessment", groupMonitor: "Monitoring",
    items: [
      ["#queue", "Application queue", "Files ranked by risk"],
      ["#lanes", "Review lanes", "Fast, standard or strict"],
      ["#rules", "SAMA cap", "Obligations against salary"],
    ],
    items2: [
      ["#portfolio", "Early warning", "Arrears in three months"],
      ["#models", "The models", "Accuracy and limits"],
    ],
    other: "العربية", otherLang: "ar",
  },
  main: "Assess an application",
  hero: {
    h1: "Credit risk scoring for loan officers",
    lead: "Mizan estimates each applicant’s probability of default, sends the file to a review lane and checks the SAMA obligation cap, with the five factors behind every estimate.",
    second: "See the review lanes",
    facts: [["Past loans in training", "307,511"], ["Main model AUC", "0.79"], ["Strict review", "Top 10% risk"]],
    cardLabel: "An assessment in Mizan: 13.0% probability of default, standard review, above the SAMA cap, with the five factors behind it",
    app: "Application A-2041 · Cash loan",
    pd: "probability of default",
    samaRow: ["SAMA cap 33.3%", "36.7% of salary"],
    ageRow: ["Age at end of loan", "39.5, eligible"],
    factors: "Main factors",
    floatLabel: "Suggested amount",
    floatTitle: "270,000 SAR at 4,950 a month",
  },
  lane: { standard: "Standard review", chip: { strict: "Strict", standard: "Standard", fast: "Fast" } },
  factor: { term: "Approximate loan term", registration: "Time since registration change", education: "Education", idDoc: "Time since ID document change", instalment: "Monthly instalment" },
  queue: {
    h2: "Every file in the queue, ranked by risk",
    p: "Open an application and the estimate, its lane, the cap check and the factors sit beside the list. The officer reads the reasons, then decides.",
    link: "Open the assessment screen",
    label: "The Mizan queue: ten applications ranked by probability of default beside the open assessment of A-2041",
    crumb: ["Mizan", "Queue"], search: "Search",
    side: { queue: "Queue", strict: "Strict", standard: "Standard", decided: "Decided", checks: "Checks", above: "Above cap" },
    cols: ["File", "Loan", "Lane", "PD"],
    sar: "SAR", above: "above cap", within: "within cap",
    open: {
      head: "Application A-2041 · Cash loan · 300,000 SAR",
      pd: "probability of default · main model",
      ticks: ["0%", "Fast 2.6%", "Strict 19.6%", "30%"],
      rows: [["SAMA cap, employee 33.3%", "36.7% of salary, above", "bad"], ["Largest instalment within the cap", "5,000 SAR a month", ""], ["Suggested amount", "270,000 SAR, 4,950 a month", ""], ["Age at end of loan", "39.5, eligible", "ok"]],
      factors: "What drove this estimate",
    },
  },
  lanes: {
    h2: "Three review lanes for every file",
    p: "The calibrated estimate sends the lowest-risk 30% of files to a fast lane and the highest-risk 10% to strict review; the rest get a standard review. Without external credit scores, a fallback model scores the file.",
    diagram: { alt: "An application goes to the risk model, which sends it to the fast lane, standard review or strict review.", input: "File", core: "Model", lanes: [["Fast", "up to 2.6%"], ["Standard", "2.6 to 19.6%"], ["Strict", "19.6% up"]] },
  },
  rules: {
    h2: "Mizan checks the SAMA cap on every file",
    cap: { h3: "Cap check against gross salary", p: "The new instalment plus existing obligations, against one third of gross salary, or 25% for retirees.", label: "Obligations at 36.7% of salary against a 33.3% cap", head: ["A-2041 · employee", "cap 33.3%"], fig: "of salary, above the cap", keys: ["0%", "cap", "50%"] },
    amt: { h3: "Amount suggestion up to 30% lower", p: "When a file fails the cap or the risk threshold, Mizan finds the largest amount up to 30% lower that passes both.", label: "Requested 300,000 SAR at 5,500 a month; suggested 270,000 SAR at 4,950 a month", req: ["Requested", "300,000 SAR", "5,500 a month"], sug: ["Suggested, −10%", "270,000 SAR", "4,950 a month"] },
  },
  statement: { h2: "The officer decides", p: "Mizan scores, routes and explains each file. It never approves or rejects a loan, and gender and age are never model inputs." },
  portfolio: {
    h2: "Early warning for running loans",
    p: "Monthly payment history gives each contract a chance of new arrears in the next three months, so collections can call the riskiest first.",
    link: "Open portfolio monitoring",
    label: "Nine running contracts ranked by the chance of arrears in three months, from 69.3% down to 1.4%",
    cols: ["Contract", "Arrears in 3 months", "Last 3 months"],
    st: { late30: "30 days late", late2: "2 days late", late3: "3 days late", late12: "12 days late", ontime: "On time", arrears: "In arrears now" },
  },
  models: {
    h2: "Four models, each tested on held-out loans",
    p: "Five-fold cross-validation on 307,511 Home Credit applications. The data is not Saudi, so the bank re-validates every model on its own portfolio first.",
    rows: [["Default risk", "Main probability of default, a calibrated ensemble", "AUC 0.791"], ["Fallback", "Used when every external credit score is missing", "AUC 0.766"], ["Amount suggestion", "Risk that never falls as the amount rises", "AUC 0.788"], ["Early warning", "New arrears within three months on a running loan", "AUC 0.678"]],
    chart: { label: "AUC of each model beside a logistic regression baseline: default risk 0.791 against 0.775, fallback 0.766 against 0.745, early warning 0.678 against 0.638", head: "AUC, five-fold cross-validation", base: "Logistic baseline", ours: "Mizan", names: { risk: "Default risk", fallback: "Fallback", ew: "Early warning" } },
  },
  close: { h2: "Assess your next application", p: "Enter income, loan and instalment; the estimate comes back with its lane and its reasons.", word: "Mizan" },
  footer: {
    lede: "Credit decision support for consumer-loan officers.",
    cols: [
      ["Product", [["#queue", "Queue"], ["#lanes", "Lanes"], ["#rules", "SAMA cap"]]],
      ["Monitoring", [["#portfolio", "Early warning"], ["#models", "Models"]]],
      ["App", [["/portfolio", "Portfolio"], ["/models", "Model details"]]],
    ] as [string, [string, string][]][],
    language: "Language",
    legal: "© 2026 Mizan · Nouf, Mohammed, Razan, Nouf",
  },
};

export type LandingDict = typeof en;

const ar: LandingDict = {
  title: "ميزان: تقييم مخاطر الائتمان لموظفي التمويل",
  description: "يقدّر ميزان احتمال تعثر كل متقدم، ويوجّه الملف إلى مسار مراجعة، ويتحقق من حد الالتزامات لدى ساما قبل أن يقرر الموظف.",
  ogDescription: "احتمال التعثر ومسارات المراجعة وحد ساما لكل ملف تمويل استهلاكي.",
  name: "ميزان",
  skip: "انتقل إلى المحتوى",
  navMain: "الرئيسية",
  menu: "القائمة",
  nav: {
    product: "المنتج", lanes: "المسارات", portfolio: "المحفظة", models: "النماذج",
    groupAssess: "التقييم", groupMonitor: "المتابعة",
    items: [
      ["#queue", "قائمة الطلبات", "الملفات مرتبة حسب المخاطر"],
      ["#lanes", "مسارات المراجعة", "سريع أو عادي أو مشدد"],
      ["#rules", "حد ساما", "الالتزامات مقابل الراتب"],
    ],
    items2: [
      ["#portfolio", "الإنذار المبكر", "التأخر خلال ثلاثة أشهر"],
      ["#models", "النماذج", "الدقة والقيود"],
    ],
    other: "English", otherLang: "en",
  },
  main: "قيّم طلبًا",
  hero: {
    h1: "تقييم مخاطر الائتمان لموظفي التمويل",
    lead: "يقدّر ميزان احتمال تعثر كل متقدم، ويوجّه الملف إلى مسار مراجعة، ويتحقق من حد الالتزامات لدى ساما، مع أهم خمسة عوامل وراء كل تقدير.",
    second: "اطّلع على مسارات المراجعة",
    facts: [["قروض سابقة في التدريب", "307,511"], ["دقة النموذج الرئيسي AUC", "0.79"], ["المراجعة المشددة", "أعلى 10% مخاطرة"]],
    cardLabel: "تقييم في ميزان: احتمال تعثر 13.0%، مراجعة عادية، فوق حد ساما، مع العوامل الخمسة وراءه",
    app: "الطلب A-2041 · تمويل نقدي",
    pd: "احتمال التعثر",
    samaRow: ["حد ساما 33.3%", "36.7% من الراتب"],
    ageRow: ["العمر عند نهاية التمويل", "39.5، مؤهل"],
    factors: "أهم العوامل",
    floatLabel: "المبلغ المقترح",
    floatTitle: "270,000 ر.س بقسط 4,950 شهريًا",
  },
  lane: { standard: "مراجعة عادية", chip: { strict: "مشدد", standard: "عادي", fast: "سريع" } },
  factor: { term: "مدة السداد التقريبية", registration: "المدة منذ تغيير التسجيل", education: "التعليم", idDoc: "المدة منذ تغيير وثيقة الهوية", instalment: "القسط الشهري" },
  queue: {
    h2: "كل ملفات القائمة، مرتبة حسب المخاطر",
    p: "افتح طلبًا ليظهر بجانب القائمة التقدير ومساره وفحص الحد والعوامل. يقرأ الموظف الأسباب ثم يقرر.",
    link: "افتح شاشة التقييم",
    label: "قائمة ميزان: عشرة طلبات مرتبة حسب احتمال التعثر بجانب تقييم الطلب A-2041",
    crumb: ["ميزان", "القائمة"], search: "بحث",
    side: { queue: "القائمة", strict: "مشدد", standard: "عادي", decided: "تم القرار", checks: "الفحوص", above: "فوق الحد" },
    cols: ["الملف", "التمويل", "المسار", "الاحتمال"],
    sar: "ر.س", above: "فوق الحد", within: "ضمن الحد",
    open: {
      head: "الطلب A-2041 · تمويل نقدي · 300,000 ر.س",
      pd: "احتمال التعثر · النموذج الرئيسي",
      ticks: ["0%", "سريع 2.6%", "مشدد 19.6%", "30%"],
      rows: [["حد ساما للموظف 33.3%", "36.7% من الراتب، فوق الحد", "bad"], ["أعلى قسط ضمن الحد", "5,000 ر.س شهريًا", ""], ["المبلغ المقترح", "270,000 ر.س، 4,950 شهريًا", ""], ["العمر عند نهاية التمويل", "39.5، مؤهل", "ok"]],
      factors: "ما الذي أثّر في التقدير",
    },
  },
  lanes: {
    h2: "ثلاثة مسارات مراجعة لكل ملف",
    p: "يرسل التقدير المعايَر أقل 30% من الملفات مخاطرةً إلى المسار السريع، وأعلى 10% إلى المراجعة المشددة، وتخضع البقية لمراجعة عادية. وعند غياب درجات الائتمان الخارجية يقيّم الملف نموذج بديل.",
    diagram: { alt: "يدخل الطلب إلى نموذج المخاطر الذي يرسله إلى المسار السريع أو المراجعة العادية أو المشددة.", input: "الملف", core: "النموذج", lanes: [["سريع", "حتى 2.6%"], ["عادي", "2.6 إلى 19.6%"], ["مشدد", "19.6% فأعلى"]] },
  },
  rules: {
    h2: "ميزان يتحقق من حد ساما في كل ملف",
    cap: { h3: "فحص الحد مقابل إجمالي الراتب", p: "القسط الجديد مع الالتزامات القائمة، مقابل ثلث إجمالي الراتب، أو 25% للمتقاعدين.", label: "الالتزامات 36.7% من الراتب مقابل حد 33.3%", head: ["A-2041 · موظف", "الحد 33.3%"], fig: "من الراتب، فوق الحد", keys: ["0%", "الحد", "50%"] },
    amt: { h3: "اقتراح مبلغ أقل بحد أقصى 30%", p: "إذا تجاوز الملف الحد أو عتبة المخاطر، يجد ميزان أكبر مبلغ أقل بنسبة تصل إلى 30% يحقق الشرطين.", label: "المطلوب 300,000 ر.س بقسط 5,500 شهريًا، والمقترح 270,000 ر.س بقسط 4,950 شهريًا", req: ["المطلوب", "300,000 ر.س", "5,500 شهريًا"], sug: ["المقترح، −10%", "270,000 ر.س", "4,950 شهريًا"] },
  },
  statement: { h2: "القرار للموظف", p: "يقيّم ميزان كل ملف ويوجّهه ويفسّره، ولا يوافق على أي تمويل ولا يرفضه، والجنس والعمر ليسا من مدخلات النموذج." },
  portfolio: {
    h2: "إنذار مبكر للتمويلات القائمة",
    p: "يعطي سجل السداد الشهري كل عقد احتمال تأخر جديد خلال الأشهر الثلاثة القادمة، ليتواصل فريق التحصيل مع الأعلى مخاطرة أولًا.",
    link: "افتح متابعة المحفظة",
    label: "تسعة عقود قائمة مرتبة حسب احتمال التأخر خلال ثلاثة أشهر، من 69.3% إلى 1.4%",
    cols: ["العقد", "التأخر خلال 3 أشهر", "آخر 3 أشهر"],
    st: { late30: "تأخر 30 يومًا", late2: "تأخر يومين", late3: "تأخر 3 أيام", late12: "تأخر 12 يومًا", ontime: "منتظم", arrears: "متأخر حاليًا" },
  },
  models: {
    h2: "أربعة نماذج، كل منها مختبر على قروض محجوبة",
    p: "تحقق تقاطعي خماسي على 307,511 طلبًا من بيانات Home Credit. البيانات ليست سعودية، لذا يتحقق البنك من كل نموذج على محفظته أولًا.",
    rows: [["مخاطر التعثر", "الاحتمال الرئيسي للتعثر، نموذج مجمّع معايَر", "AUC 0.791"], ["النموذج البديل", "يُستخدم عند غياب جميع درجات الائتمان الخارجية", "AUC 0.766"], ["اقتراح المبلغ", "مخاطرة لا تنخفض أبدًا مع ارتفاع المبلغ", "AUC 0.788"], ["الإنذار المبكر", "تأخر جديد خلال ثلاثة أشهر في تمويل قائم", "AUC 0.678"]],
    chart: { label: "قيمة AUC لكل نموذج مقابل الانحدار اللوجستي: مخاطر التعثر 0.791 مقابل 0.775، البديل 0.766 مقابل 0.745، الإنذار المبكر 0.678 مقابل 0.638", head: "AUC، تحقق تقاطعي خماسي", base: "الانحدار اللوجستي", ours: "ميزان", names: { risk: "مخاطر التعثر", fallback: "النموذج البديل", ew: "الإنذار المبكر" } },
  },
  close: { h2: "قيّم طلبك التالي", p: "أدخل الدخل والتمويل والقسط، فيعود التقدير مع مساره وأسبابه.", word: "ميزان" },
  footer: {
    lede: "دعم قرار الائتمان لموظفي التمويل الاستهلاكي.",
    cols: [
      ["المنتج", [["#queue", "القائمة"], ["#lanes", "المسارات"], ["#rules", "حد ساما"]]],
      ["المتابعة", [["#portfolio", "الإنذار المبكر"], ["#models", "النماذج"]]],
      ["التطبيق", [["/portfolio", "المحفظة"], ["/models", "تفاصيل النماذج"]]],
    ],
    language: "اللغة",
    legal: "© 2026 ميزان · نوف، محمد، رزان، نوف",
  },
};

export const getLanding = (l: Locale): LandingDict => (l === "ar" ? ar : en);
export const LANDING_DATA = { QUEUE, CONTRACTS, FACTOR_W, AUC };
