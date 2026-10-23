// Guest reporting channel: for people without the SDP app (visitors, tenants,
// passers-by). Report only: no account, no dashboard. The report joins the staff
// case queue like any other report. Nothing leaves the browser in this demo.
// English or Bahasa Malaysia (remembered in this browser).

import { useEffect, useState } from 'react';
import { GUEST_CATEGORIES, GUEST_ROLES } from '../data/accounts.js';
import { GUEST_LANGS, GUEST_TEXT } from '../data/guestText.js';
import { matchGuestReport } from '../model/guest.js';
import { routeCase } from '../model/routing.js';
import { PlanMap } from './PlanMap.jsx';
import { BrandMark } from './LoginPage.jsx';

const MIN_TEXT = 10;
const LANG_KEY = 'metrosense-guest-lang';

const loadLang = () => {
  try { return localStorage.getItem(LANG_KEY) === 'ms' ? 'ms' : 'en'; } catch { return 'en'; }
};

export function GuestReportPage({ campus, onSubmit, onStaff }) {
  const [lang, setLang] = useState(loadLang);
  const t = GUEST_TEXT[lang];
  const [categoryKey, setCategoryKey] = useState('');
  const [point, setPoint] = useState(null);
  const [placeId, setPlaceId] = useState('');
  const [reporter, setReporter] = useState('');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null); // { url, name }
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked: fine */ }
  }, [lang]);

  const site = campus.buildings.find((b) => b.kind === 'site');
  const buildings = campus.buildings.filter((b) => b.kind !== 'site');
  const places = [
    ...buildings.map((b) => ({ id: `b:${b.id}`, label: b.name, point: { x: b.x, z: b.z } })),
    ...site.equipment.map((e) => ({ id: `a:${e.id}`, label: `${e.name}, ${e.zone}`, point: { x: e.wx, z: e.wz } })),
  ];
  // Place names are data (English); only the generated "Near the" is translated.
  const placeText = (p) => (p?.startsWith('Near the ') ? `${t.near} ${p.slice(9)}` : p);

  const match = categoryKey && point ? matchGuestReport({ categoryKey, point }, campus) : null;
  const route = match ? routeCase({ type: match.asset?.type, category: match.asset ? null : match.category }) : null;
  const problems = [
    !categoryKey && t.errWhat,
    !point && t.errWhere,
    text.trim().length < MIN_TEXT && t.errText(MIN_TEXT),
    !consent && t.errConsent,
  ].filter(Boolean);

  // Replacing or removing a photo frees the old preview. A sent photo is kept:
  // the staff case shows it.
  const changePhoto = (next) => {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(next);
  };

  const submit = (ev) => {
    ev.preventDefault();
    setTried(true);
    if (problems.length) return;
    const report = onSubmit({ categoryKey, point, reporter, text: text.trim(), photoUrl: photo?.url ?? null, lang });
    setDone({ report, route });
  };

  const reset = () => {
    setCategoryKey(''); setPoint(null); setPlaceId(''); setReporter(''); setText('');
    setPhoto(null); setConsent(false); setDone(null); setTried(false);
  };

  return (
    <div className="guest" lang={lang}>
      <header className="topbar guest-bar">
        <div className="brand">
          <BrandMark size={30} />
          <h1>MetroSense</h1>
          <span className="subtitle tagline">{t.title}</span>
          <span className="sim-badge" title={t.simTitle}>{t.simBadge}</span>
        </div>
        <div className="controls">
          <div className="segmented lang-toggle" role="radiogroup" aria-label={t.language}>
            {GUEST_LANGS.map((l) => (
              <button
                key={l.key} type="button" role="radio" lang={l.key} aria-checked={lang === l.key} title={l.name}
                className={lang === l.key ? 'is-on' : ''} onClick={() => setLang(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button className="btn btn-quiet" onClick={onStaff}>{t.staff}</button>
        </div>
      </header>

      <main className="guest-main">
        {done ? (
          <section className="card guest-done" aria-live="polite">
            <p className="eyebrow">{t.received}</p>
            <h2>{t.thanks(done.report.id)}</h2>
            <dl className="lifecycle case-facts">
              <div><dt>{t.where}</dt><dd>{done.report.matchedName ? `${done.report.matchedName}, ` : ''}{placeText(done.report.matchedPlace)}</dd></div>
              <div>
                <dt>{t.sentTo}</dt>
                <dd><strong>{done.route.party.name}</strong>{lang === 'en' && <><br /><span className="meta">{done.route.why}.</span></>}</dd>
              </div>
            </dl>
            <p>{t.followUp(!!done.report.photo)}</p>
            <p className="meta">{t.demoNote}</p>
            <div className="guest-actions">
              <button className="btn" onClick={reset}>{t.another}</button>
              <button className="btn btn-quiet" onClick={onStaff}>{t.staff}</button>
            </div>
          </section>
        ) : (
          <form className="guest-form" onSubmit={submit} noValidate>
            <section className="card guest-intro">
              <h2>{t.introTitle}</h2>
              <p className="meta">{t.introText}</p>
            </section>

            <section className="card">
              <h3 className="step"><span>1</span> {t.step1}</h3>
              <div className="choice-grid" role="radiogroup" aria-label={t.step1}>
                {GUEST_CATEGORIES.map((c) => (
                  <label key={c.key} className={`choice ${categoryKey === c.key ? 'is-on' : ''}`}>
                    <input type="radio" name="category" value={c.key} checked={categoryKey === c.key} onChange={() => setCategoryKey(c.key)} />
                    {t.categories[c.key]}
                  </label>
                ))}
              </div>
            </section>

            <section className="card">
              <h3 className="step"><span>2</span> {t.step2}</h3>
              <p className="meta">{t.mapHint}</p>
              <PlanMap campus={campus} point={point} highlightId={match?.assetId} onPick={(p) => { setPoint(p); setPlaceId(''); }} />
              <label className="field">
                <span>{t.choosePlace}</span>
                <select
                  value={placeId}
                  onChange={(ev) => {
                    setPlaceId(ev.target.value);
                    const p = places.find((x) => x.id === ev.target.value);
                    if (p) setPoint(p.point);
                  }}
                >
                  <option value="">{t.placePlaceholder}</option>
                  {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              {match && (
                <p className="match-note" role="status">
                  {match.asset
                    ? <>{t.matched} <strong>{match.asset.name}</strong> ({match.asset.zone}). </>
                    : <>{t.location} <strong>{placeText(match.place)}</strong>. </>}
                  {t.goesTo} <strong>{route.party.name}</strong>.
                </p>
              )}
            </section>

            <section className="card">
              <h3 className="step"><span>3</span> {t.step3}</h3>
              <label className="field">
                <span>{t.whatSeen}</span>
                <textarea rows={3} value={text} onChange={(ev) => setText(ev.target.value)} placeholder={t.textPlaceholder} />
              </label>
              <label className="field">
                <span>{t.photo}</span>
                <input
                  type="file" accept="image/*" capture="environment"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (f) changePhoto({ url: URL.createObjectURL(f), name: f.name });
                  }}
                />
                <span className="meta">{t.photoNote}</span>
              </label>
              {photo && (
                <div className="photo-preview">
                  <img src={photo.url} alt={t.yourPhoto} />
                  <button type="button" className="link-btn" onClick={() => changePhoto(null)}>{t.removePhoto}</button>
                </div>
              )}
              <label className="field">
                <span>{t.youAre}</span>
                <select value={reporter} onChange={(ev) => setReporter(ev.target.value)}>
                  <option value="">{t.preferNot}</option>
                  {GUEST_ROLES.map((r, i) => <option key={r} value={r}>{t.roles[i]}</option>)}
                </select>
              </label>
            </section>

            <section className="card">
              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
                <span>{t.consent}</span>
              </label>
              {tried && problems.length > 0 && (
                <ul className="form-errors" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              )}
              <button type="submit" className="btn btn-block">{t.send}</button>
            </section>
          </form>
        )}
      </main>
    </div>
  );
}
