// The client site's home page. Same design kit and layout as the officer landing (public/landing/landing.css),
// written for customers: what they can apply for, how the answer comes back, and where to follow it.
import type { Locale } from "@/i18n/dict";

const Arrow = () => (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path className="m-arrow__stem" d="M1 6h8" /><path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
);
const Mark = () => <span className="mark" data-mark="arc" aria-hidden="true" />;

const T = {
  en: {
    name: "Mizan", skip: "Skip to content", navMain: "Main", menu: "Menu", other: "العربية", otherLang: "ar",
    mine: "My applications", apply: "Apply for financing",
    h1: "Personal financing, with a clear answer",
    lead: "Tell us your salary, your current instalments and the amount you need. A credit officer reviews your application, and if the full amount does not fit, you get an amount that does.",
    second: "Follow my applications",
    facts: [["5 minutes", "to apply"], ["1/3 of salary", "instalment limit for employees"], ["Your choice", "accept or decline any offer"]],
    cardLabel: "Example of an application with an offer",
    card: { title: "Application #1024", status: "Offer waiting for you", req: "You asked for", off: "Offered", monthly: "3,000 SAR a month · 48 months", accept: "Accept offer", decline: "Decline" },
    howH: "How it works",
    howLead: "Three steps, and you can see where your application is at any time.",
    steps: [
      ["Apply", "Fill in one short form: your income, your current instalments, the amount and the period. You see the estimated instalment before you send."],
      ["A credit officer reviews it", "The officer checks your application against the bank's rules, including the limit on monthly instalments of one third of your salary."],
      ["You get an answer", "Approved, not approved, or an offer for a smaller amount you can afford. You decide whether to accept it."],
    ],
    closeH: "Ready to apply?",
    closeP: "Applications are reviewed by a person, never decided by a machine alone.",
    legal: "Demo service. Your mobile number identifies your applications; there is no password.",
  },
  ar: {
    name: "ميزان", skip: "الانتقال إلى المحتوى", navMain: "القائمة الرئيسية", menu: "القائمة", other: "English", otherLang: "en",
    mine: "طلباتي", apply: "طلب تمويل",
    h1: "تمويل شخصي بإجابة واضحة",
    lead: "زوّدنا براتبك وأقساطك الحالية والمبلغ الذي تحتاجه، وسيراجع موظف الائتمان طلبك. وإذا تعذّرت الموافقة على المبلغ كاملًا، نعرض عليك مبلغًا يناسب قدرتك على السداد.",
    second: "متابعة طلباتي",
    facts: [["5 دقائق", "لتقديم الطلب"], ["ثلث الراتب", "الحد الأعلى للأقساط الشهرية للموظفين"], ["القرار لك", "قبول العرض أو رفضه"]],
    cardLabel: "مثال لطلب عليه عرض بديل",
    card: { title: "الطلب رقم 1024", status: "عرض بانتظار ردك", req: "المبلغ المطلوب", off: "المبلغ المعروض", monthly: "3,000 ر.س شهريًا · 48 شهرًا", accept: "قبول العرض", decline: "رفض العرض" },
    howH: "آلية العمل",
    howLead: "ثلاث خطوات، وتستطيع معرفة حالة طلبك في أي وقت.",
    steps: [
      ["تقديم الطلب", "نموذج واحد مختصر يشمل دخلك وأقساطك الحالية والمبلغ المطلوب ومدة السداد، مع عرض القسط التقديري قبل الإرسال."],
      ["مراجعة موظف الائتمان", "يراجع الموظف طلبك وفق ضوابط البنك، ومنها ألا تتجاوز أقساطك الشهرية ثلث راتبك."],
      ["استلام الرد", "الموافقة، أو الاعتذار، أو عرض بمبلغ أقل يناسب قدرتك على السداد، ولك حرية قبوله أو رفضه."],
    ],
    closeH: "هل أنت مستعد لتقديم طلبك؟",
    closeP: "يراجع موظف الائتمان كل طلب، ولا يُتخذ القرار آليًا.",
    legal: "خدمة تجريبية: رقم جوالك هو وسيلة التعرف على طلباتك، ولا توجد كلمة مرور.",
  },};

export function ClientHome({ locale }: { locale: Locale }) {
  const t = T[locale];
  const app = (p: string) => `/${locale}${p}`;
  return (
    <>
      <header className="nav">
        <div className="wrap nav__bar">
          <a className="skip-link" href="#top">{t.skip}</a>
          <a className="nav__logo" href="#top"><Mark />{t.name}</a>
          <nav className="nav__links" aria-label={t.navMain}>
            <div className="nav__item"><a className="nav__link" href="#how">{t.howH}</a></div>
          </nav>
          <div className="nav__actions">
            <a className="nav__link" href={`/${t.otherLang}`} lang={t.otherLang} hrefLang={t.otherLang}>{t.other}</a>
            <a className="nav__link" href={app("/my-applications")}>{t.mine}</a>
            <a className="btn btn--primary" href={app("/apply")}>{t.apply}</a>
          </div>
          {/* phones: the kit's menu button (assets/system.js) opens the links and actions */}
          <button className="nav__toggle" type="button" aria-expanded="false" aria-label={t.menu}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>
      <main id="top">
        <section className="hero hero--split" data-enter="" aria-labelledby="hero-h">
          <div className="wrap"><div className="hero-text grid hero__grid">
            <div className="hero__text span-5">
              <h1 id="hero-h">{t.h1}</h1>
              <p className="hero__lead">{t.lead}</p>
              <div className="btn-row">
                <a className="btn btn--primary" href={app("/apply")}>{t.apply}<Arrow /></a>
                <a className="btn btn--secondary" href={app("/my-applications")}>{t.second}</a>
              </div>
              <dl className="hero-facts">
                {t.facts.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}
              </dl>
            </div>
            <div className="hero__media mz-stage mz-stage--fit span-6 start-7">
              <div className="ui ui-panel mz-card mz-c" role="img" aria-label={t.cardLabel}>
                <div className="mz">
                  <div className="mz__head"><span>{t.card.title}</span><span className="mz__chip">{t.card.status}</span></div>
                  <div className="mz__rows">
                    <div className="mz__row"><span>{t.card.req}</span><b className="mz__bad"><s>150,000</s></b></div>
                    <div className="mz__row"><span>{t.card.off}</span><b className="mz__ok">120,000</b></div>
                  </div>
                  <p className="mz__label">{t.card.monthly}</p>
                  <div className="btn-row">
                    <span className="btn btn--primary" aria-hidden="true">{t.card.accept}</span>
                    <span className="btn btn--secondary" aria-hidden="true">{t.card.decline}</span>
                  </div>
                </div>
              </div>
            </div>
          </div></div>
        </section>

        <section className="section section--fit" id="how" aria-labelledby="how-h">
          <div className="wrap stack-8">
            <div className="section-head">
              <h2 id="how-h">{t.howH}</h2>
              <p className="t-lead">{t.howLead}</p>
            </div>
            <ol className="grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {t.steps.map(([h, p], i) => (
                <li className="span-4 stack-4" key={h}>
                  <span className="t-label">0{i + 1}</span>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <footer className="footer closing footer--statement g2m" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--word">
            <div className="section-head--split">
              <div><h2 id="close-h">{t.closeH}</h2><p className="t-lead">{t.closeP}</p></div>
              <a className="btn btn--primary" href={app("/apply")}>{t.apply}<Arrow /></a>
            </div>
          </div>
          <div className="closing__links">
            <div className="footer__legal"><span>{t.legal}</span></div>
          </div>
        </div>
      </footer>
    </>
  );
}

export const CLIENT_HOME_META = {
  en: { title: "Mizan · Personal financing", description: "Apply for personal financing and follow your application." },
  ar: { title: "ميزان · التمويل الشخصي", description: "اطلب تمويلًا شخصيًا وتابع طلبك." },
};
