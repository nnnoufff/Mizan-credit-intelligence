// The Mizan landing page as React components. Markup and classes follow the taste-skill kit
// (assets/starter.html, sections-library.md); the page CSS lives in public/landing/landing.css.
import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/dict";
import { getLanding, LANDING_DATA, type LandingDict } from "@/i18n/landing";

const v = (o: Record<string, string | number>) => o as CSSProperties;

const Arrow = () => (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path className="m-arrow__stem" d="M1 6h8" /><path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
);
const Mark = () => <span className="mark" data-mark="arc" aria-hidden="true" />;

export function Landing({ locale }: { locale: Locale }) {
  const t = getLanding(locale);
  const app = (p: string) => `/${locale}${p}`;
  return (
    <>
      <Nav t={t} app={app} />
      <main id="top">
        <Hero t={t} app={app} />
        <Queue t={t} app={app} />
        <Lanes t={t} />
        <Rules t={t} />
        <Statement t={t} animated={locale === "en"} />
        <Portfolio t={t} app={app} />
        <Models t={t} />
      </main>
      <Closing t={t} app={app} />
    </>
  );
}

type P = { t: LandingDict; app: (p: string) => string };

function Nav({ t, app }: P) {
  return (
    <header className="nav">
      <div className="wrap nav__bar">
        <a className="skip-link" href="#top">{t.skip}</a>
        <a className="nav__logo" href="#top"><Mark />{t.name}</a>
        <nav className="nav__links" aria-label={t.navMain}>
          <div className="nav__item">
            <a className="nav__link" href="#queue">{t.nav.product} <svg className="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
            <div className="nav__menu">
              <div className="wrap grid">
                <div className="menu-col span-3">
                  <p className="t-label">{t.nav.groupAssess}</p>
                  {t.nav.items.map(([href, a, b]) => <a key={href} href={href}>{a}<span>{b}</span></a>)}
                </div>
                <div className="menu-col span-3">
                  <p className="t-label">{t.nav.groupMonitor}</p>
                  {t.nav.items2.map(([href, a, b]) => <a key={href} href={href}>{a}<span>{b}</span></a>)}
                </div>
              </div>
            </div>
          </div>
          <div className="nav__item"><a className="nav__link" href="#lanes">{t.nav.lanes}</a></div>
          <div className="nav__item"><a className="nav__link" href="#portfolio">{t.nav.portfolio}</a></div>
          <div className="nav__item"><a className="nav__link" href="#models">{t.nav.models}</a></div>
        </nav>
        <div className="nav__actions">
          <a className="nav__link" href={`/${t.nav.otherLang}`} lang={t.nav.otherLang} hrefLang={t.nav.otherLang}>{t.nav.other}</a>
          <a className="btn btn--primary" href={app("/assess")}>{t.main}</a>
        </div>
        <button className="nav__toggle" type="button" aria-expanded="false" aria-label={t.menu}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
    </header>
  );
}

function Factors({ t, count }: { t: LandingDict; count: number }) {
  return (
    <div className="mz__factors">
      {LANDING_DATA.FACTOR_W.slice(0, count).map((f) => (
        <div className="mz__f" key={f.key}>
          <span>{t.factor[f.key as keyof LandingDict["factor"]]}</span>
          <span className="mz__bar" data-dir={f.dir} style={v({ "--w": `${f.w}%` })}><s /></span>
        </div>
      ))}
    </div>
  );
}

function Hero({ t, app }: P) {
  const h = t.hero;
  return (
    <section className="hero hero--split" data-enter="" aria-labelledby="hero-h">
      <div className="wrap"><div className="hero-text grid hero__grid">
        <div className="hero__text span-5">
          <h1 id="hero-h">{h.h1}</h1>
          <p className="hero__lead">{h.lead}</p>
          <div className="btn-row">
            <a className="btn btn--primary" href={app("/assess")}>{t.main}<Arrow /></a>
            <a className="btn btn--secondary" href="#lanes">{h.second}</a>
          </div>
          <dl className="hero-facts">
            {h.facts.map(([dt, dd], i) => <div key={dt}><dt>{dt}</dt>{i === 0 ? <dd data-m-count="">{dd}</dd> : <dd>{dd}</dd>}</div>)}
          </dl>
        </div>
        <div className="hero__media mz-stage span-6 start-7" data-fx="silk-folds" data-fx-seed="2042" data-fx-params='{"calmX":0.5,"calmY":0.5}'>
          <div className="ui ui-panel mz-card mz-c" role="img" aria-label={h.cardLabel}>
            <div className="mz">
              <div className="mz__head"><span>{h.app}</span><span className="mz__chip">{t.lane.standard}</span></div>
              <div className="mz__pd"><b>13.0%</b><span>{h.pd}</span></div>
              <div className="mz__scale"><i /><i /><i /><span className="mz__needle" style={{ left: "43.3%" }} /></div>
              <div className="mz__ticks"><span>0%</span><span>2.6%</span><span>19.6%</span><span>30%</span></div>
              <div className="mz__rows">
                <div className="mz__row"><span>{h.samaRow[0]}</span><b className="mz__bad">{h.samaRow[1]}</b></div>
                <div className="mz__row"><span>{h.ageRow[0]}</span><b className="mz__ok">{h.ageRow[1]}</b></div>
              </div>
              <p className="mz__label">{h.factors}</p>
              <Factors t={t} count={3} />
            </div>
          </div>
          <div className="ly-float">
            <div className="ly-float__row"><span className="ly-live">{h.floatLabel}</span><span>−10%</span></div>
            <div className="ly-float__title">{h.floatTitle}</div>
          </div>
        </div>
      </div></div>
    </section>
  );
}

function Queue({ t, app }: P) {
  const q = t.queue;
  const icon = (d: string) => <svg className="ui-icon" viewBox="0 0 16 16">{d.split("|").map((p) => <path key={p} d={p} />)}</svg>;
  return (
    <section className="section ground-inverse" id="queue" aria-labelledby="queue-h">
      <div className="wrap">
        <div className="grid">
          <h2 id="queue-h" className="span-5">{q.h2}</h2>
          <div className="span-6 start-7 stack-4"><p>{q.p}</p><p><a className="link" href={app("/assess")}>{q.link}</a></p></div>
        </div>
        <div className="ui app fill mz-c" role="img" aria-label={q.label} data-ui-pause-host="">
          <div className="app__pane app__pane--list">
            <div className="ui ui-panel ui-win" data-ui="window" data-open={t.lane.chip.standard} data-work={t.lane.chip.strict} data-done={t.lane.chip.fast}>
              <div className="ui-win__bar">
                <span className="ui-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="ui-win__crumb">{q.crumb[0]} <i>/</i> <b>{q.crumb[1]}</b></span>
                <span className="ui-spacer" />
                <span className="ui-win__search" aria-hidden="true"><svg className="ui-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg><span className="ui-win__ph">{q.search}</span><span className="ui-kbd">/</span></span>
              </div>
              <div className="ui-win__body">
                <nav className="ui-win__side" aria-hidden="true">
                  <span className="ui-win__nav is-on">{icon("M2.5 9h3l1 1.5h3l1-1.5h3|M2.5 9 4 3.5h8L13.5 9v3.5h-11z")}{q.side.queue}<em>10</em></span>
                  <span className="ui-win__nav">{icon("M8 2.5 13.5 12h-11z")}{q.side.strict}<em>2</em></span>
                  <span className="ui-win__nav"><svg className="ui-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></svg>{q.side.standard}<em>8</em></span>
                  <span className="ui-win__nav">{icon("m3.5 8.4 2.8 2.8 6.2-6.4")}{q.side.decided}</span>
                  <span className="ui-win__label">{q.side.checks}</span>
                  <span className="ui-win__nav"><span className="ui-win__hash">#</span>{q.side.above}</span>
                </nav>
                <div className="ui-win__main">
                  <div className="ui-win__cols" aria-hidden="true">{q.cols.map((c) => <span key={c}>{c}</span>)}</div>
                  <ul className="ui-win__rows">
                    {LANDING_DATA.QUEUE.map((r, i) => (
                      <li className="ui-win__row" data-row="" key={r.id}>
                        <span className="ui-avatar" data-tone={String((i % 5) + 1)}>{r.id.slice(-2)}</span>
                        <span className="ui-win__who">{r.id}</span>
                        <span className="ui-win__sub">{r.amount} {q.sar} · {r.above ? q.above : q.within}</span>
                        <span className="ui-win__st" data-lane={r.lane}>{t.lane.chip[r.lane]}</span>
                        <span className="ui-win__pd">{r.pd}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="app__pane app__pane--open">
            <div className="ui ui-panel">
              <div className="mz">
                <div className="mz__head"><span>{q.open.head}</span><span className="mz__chip">{t.lane.standard}</span></div>
                <div className="mz__pd"><b>13.0%</b><span>{q.open.pd}</span></div>
                <div className="mz__scale"><i /><i /><i /><span className="mz__needle" style={{ left: "43.3%" }} /></div>
                <div className="mz__ticks">{q.open.ticks.map((x) => <span key={x}>{x}</span>)}</div>
                <div className="mz__rows">
                  {q.open.rows.map(([a, b, tone]) => <div className="mz__row" key={a}><span>{a}</span><b className={tone === "bad" ? "mz__bad" : tone === "ok" ? "mz__ok" : undefined}>{b}</b></div>)}
                </div>
                <p className="mz__label">{q.open.factors}</p>
                <Factors t={t} count={5} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Lanes({ t }: { t: LandingDict }) {
  const L = t.lanes, dg = L.diagram;
  const icons = ["ui:zap", "ui:clock", "ui:shield-alert"];
  const spec = JSON.stringify({
    layout: "lanes", alt: dg.alt,
    input: { label: dg.input, icon: "ui:file-text", sub: "A-2041" },
    core: { label: dg.core, icon: "ui:cpu" },
    lanes: dg.lanes.map(([label, sub], i) => ({ label, icon: icons[i], done: true, sub })),
  });
  return (
    <section className="section" id="lanes" aria-labelledby="lanes-h">
      <div className="wrap">
        <div className="grid">
          <h2 id="lanes-h" className="span-5">{L.h2}</h2>
          <p className="span-6 start-7">{L.p}</p>
        </div>
        <div className="panel fill mz-lanes">
          <div className="dg" data-diagram={spec} />
        </div>
      </div>
    </section>
  );
}

function Rules({ t }: { t: LandingDict }) {
  const R = t.rules;
  return (
    <section className="section" id="rules" style={v({ "--hm": 2 })} aria-labelledby="rules-h">
      <div className="wrap">
        <div className="section-head"><h2 id="rules-h">{R.h2}</h2></div>
        <div className="grid">
          <article className="card card--open span-6">
            <h3>{R.cap.h3}</h3>
            <p>{R.cap.p}</p>
            <div className="panel">
              <div className="ui ui-panel mz-cap mz-c" role="img" aria-label={R.cap.label}>
                <div className="mz__head"><span>{R.cap.head[0]}</span><span>{R.cap.head[1]}</span></div>
                <div className="mz-cap__fig"><b>36.7%</b><span className="mz__bad">{R.cap.fig}</span></div>
                <div className="mz-cap__track"><div className="mz-cap__fill" /><span className="mz-cap__line" /></div>
                <div className="mz-cap__keys">{R.cap.keys.map((k) => <span key={k}>{k}</span>)}</div>
              </div>
            </div>
          </article>
          <article className="card card--open span-6">
            <h3>{R.amt.h3}</h3>
            <p>{R.amt.p}</p>
            <div className="panel">
              <div className="ui ui-panel mz-amt mz-c" role="img" aria-label={R.amt.label}>
                <div className="mz-amt__box"><small>{R.amt.req[0]}</small><b>{R.amt.req[1]}</b><span>{R.amt.req[2]}</span></div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                <div className="mz-amt__box mz-amt__box--on"><small>{R.amt.sug[0]}</small><b>{R.amt.sug[1]}</b><span>{R.amt.sug[2]}</span></div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

// English: the dealt letters-assemble moment. Arabic: the same statement standing whole, since the moment splits letters.
function Statement({ t, animated }: { t: LandingDict; animated: boolean }) {
  return animated ? (
    <section className="section" id="statement" data-moment="letters-assemble" aria-labelledby="statement-h">
      <div className="wrap">
        <h2 id="statement-h" className="mo-la__type" suppressHydrationWarning>{t.statement.h2}</h2>
        <p className="mo-la__sub">{t.statement.p}</p>
      </div>
    </section>
  ) : (
    <section className="section" id="statement" aria-labelledby="statement-h">
      <div className="wrap">
        <h2 id="statement-h" className="mz-statement">{t.statement.h2}</h2>
        <p className="mz-statement__sub">{t.statement.p}</p>
      </div>
    </section>
  );
}

function Portfolio({ t, app }: P) {
  const p = t.portfolio;
  return (
    <section className="section" id="portfolio" aria-labelledby="portfolio-h">
      <div className="wrap">
        <div className="grid grid--top fill">
          <div className="span-5 stack-4">
            <h2 id="portfolio-h">{p.h2}</h2>
            <p>{p.p}</p>
            <p><a className="link" href={app("/portfolio")}>{p.link}</a></p>
          </div>
          <div className="panel span-6 start-7">
            <div className="ui ui-panel mz-ew" role="img" aria-label={p.label}>
              <div className="mz-ew__row mz-ew__row--head"><span>{p.cols[0]}</span><span>{p.cols[1]}</span><span /><span>{p.cols[2]}</span></div>
              {LANDING_DATA.CONTRACTS.map((c) => (
                <div className="mz-ew__row" key={c.id}>
                  <span className="mz-ew__id">{c.id}</span>
                  <span className="mz-ew__track"><i style={v({ "--w": `${c.p ?? 0}%`, ...(c.p && c.p >= 25 ? { "--c": "#d9534f" } : {}) })} /></span>
                  <span className="mz-ew__pct">{c.p == null ? "—" : `${c.p}%`}</span>
                  <span className="mz-ew__st">{p.st[c.st]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Models({ t }: { t: LandingDict }) {
  const m = t.models, c = m.chart;
  return (
    <section className="section" id="models" style={v({ "--hm": 2 })} aria-labelledby="models-h">
      <div className="wrap">
        <div className="section-head"><h2 id="models-h">{m.h2}</h2><p>{m.p}</p></div>
        <div className="grid grid--top fill">
          <ul className="rows rows--spec span-6">
            {m.rows.map(([name, desc, val]) => <li key={name}><span className="rows__name">{name}</span><p>{desc}</p><span className="rows__value">{val}</span></li>)}
          </ul>
          <div className="panel span-6 start-7">
            <div className="ui ui-panel mz-auc" role="img" aria-label={c.label}>
              <div className="mz__head"><span>{c.head}</span><span><i className="mz-auc__key mz-auc__key--base" />{c.base} <i className="mz-auc__key" />{c.ours}</span></div>
              {LANDING_DATA.AUC.map((a) => (
                <div className="mz-auc__group" key={a.key}>
                  <span>{c.names[a.key]}</span>
                  <div className="mz-auc__bar mz-auc__bar--base" style={v({ "--v": a.base })}><b>{a.base.toFixed(3)}</b></div>
                  <div className="mz-auc__bar" style={v({ "--v": a.model })}><b>{a.model.toFixed(3)}</b></div>
                </div>
              ))}
              <div className="mz__ticks"><span>0.5</span><span>0.6</span><span>0.7</span><span>0.8</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Closing({ t, app }: P) {
  return (
    <footer className="footer closing footer--statement g2m" id="contact" aria-labelledby="close-h">
      <div className="wrap">
        <div className="closing__cta close--word">
          <div className="section-head--split">
            <div><h2 id="close-h">{t.close.h2}</h2><p className="t-lead">{t.close.p}</p></div>
            <a className="btn btn--primary" href={app("/assess")}>{t.main}<Arrow /></a>
          </div>
          <p className="close__word" aria-hidden="true">{t.close.word}</p>
        </div>
        <div className="closing__links">
          <div className="grid">
            <div className="span-4 stack-4">
              <a className="nav__logo" href="#top"><Mark />{t.name}</a>
              <p className="footer__lede">{t.footer.lede}</p>
            </div>
            {t.footer.cols.map(([head, links]) => (
              <div className="span-2 footer__col" key={head}>
                <h3>{head}</h3>
                <ul>{links.map(([href, label]) => <li key={href}><a href={href.startsWith("/") ? app(href) : href}>{label}</a></li>)}</ul>
              </div>
            ))}
            <div className="span-2 footer__col"><h3>{t.footer.language}</h3><ul><li><a href={`/${t.nav.otherLang}`} lang={t.nav.otherLang} hrefLang={t.nav.otherLang}>{t.nav.other}</a></li></ul></div>
          </div>
          <div className="footer__legal"><span>{t.footer.legal}</span><div className="socials" /></div>
        </div>
      </div>
    </footer>
  );
}
