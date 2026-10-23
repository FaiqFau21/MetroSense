// Staff sign-in. Demo: the email must be one of the demo accounts and the
// password is neither checked nor kept; a pilot would use SDP staff single
// sign-on. Guests get a separate report-only form.

import { useId, useState } from 'react';
import { STAFF_ACCOUNTS } from '../data/accounts.js';
import { PARTIES } from '../model/routing.js';

// MetroSense's own mark: a map pin with signal arcs. Not an SDP logo.
export function BrandMark({ size = 36 }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b4a8a" />
          <stop offset="1" stopColor="#14234a" />
        </linearGradient>
        <linearGradient id={`${id}pin`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6a01a" />
          <stop offset="1" stopColor="#e2401f" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${id}bg)`} />
      <path d="M20 9c-4.4 0-8 3.4-8 7.7 0 5.6 8 13.3 8 13.3s8-7.7 8-13.3C28 12.4 24.4 9 20 9z" fill={`url(#${id}pin)`} />
      <circle cx="20" cy="16.8" r="3" fill="#fff" />
      <path d="M9 31.5h22" stroke="#8fa9e6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const FEATURES = [
  ['predict', 'Predict failures', 'Health scores and forecasts for every asset, from towers to streetlights.'],
  ['report', 'One report queue', 'SDP app, hotline, WhatsApp, email and guest reports in one place.'],
  ['route', 'Route and track', 'Each case goes to whoever fixes it, with location, model and photo.'],
];

function FeatureIcon({ kind }) {
  const paths = {
    predict: <path d="M3 17l5-6 4 3 6-8M14 6h4v4" />,
    report: <path d="M4 5h16v11H9l-5 4V5zM8 9h8M8 12h5" />,
    route: <path d="M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h6M18 9v6a4 4 0 01-4 4H8" />,
  };
  return (
    <svg className="feature-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

// Faint street-grid illustration behind the brand panel.
function StreetGrid() {
  return (
    <svg className="auth-grid" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        {[80, 190, 300, 410, 520].map((v) => <path key={`h${v}`} d={`M0 ${v}H600`} />)}
        {[60, 170, 280, 390, 500].map((v) => <path key={`v${v}`} d={`M${v} 0V600`} />)}
        <path d="M0 470C150 430 260 330 600 120" strokeWidth="3" />
      </g>
      <g fill="currentColor">
        {[[96, 110, 60, 50], [206, 216, 58, 64], [316, 104, 56, 66], [426, 330, 60, 52], [96, 330, 60, 60], [316, 436, 60, 50]].map(([x, y, w, h]) => (
          <rect key={`${x},${y}`} x={x} y={y} width={w} height={h} rx="4" opacity="0.5" />
        ))}
      </g>
    </svg>
  );
}

export function LoginPage({ onSignIn, onGuest, onAssumptions }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  const submit = (ev) => {
    ev.preventDefault();
    const account = STAFF_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
    if (!email.trim() || !password) { setError('Enter your work email and password.'); return; }
    if (!account) { setError('No staff account with that email. Use one of the demo accounts below.'); return; }
    setPassword('');
    onSignIn(account);
  };

  return (
    <main className="auth">
      <aside className="auth-side">
        <div className="auth-stripe" aria-hidden="true" />
        <StreetGrid />
        <div className="auth-side-inner">
          <div className="auth-logo">
            <BrandMark size={44} />
            <span>MetroSense</span>
          </div>
          <h1 className="auth-title">Keep every township asset working, before anyone has to complain.</h1>
          <p className="auth-tagline">Predict, report and fix township assets, built for Sime Darby Property townships.</p>
          <ul className="auth-features">
            {FEATURES.map(([kind, title, text]) => (
              <li key={kind}>
                <span className="feature-badge"><FeatureIcon kind={kind} /></span>
                <span><strong>{title}</strong><span>{text}</span></span>
              </li>
            ))}
          </ul>
          <p className="auth-foot">Concept demo for the SDP University Hackathon 2026 · simulated data · not an official SDP product</p>
        </div>
      </aside>

      <section className="auth-main">
        <div className="auth-card" aria-labelledby="signin-title">
          <div className="auth-card-logo"><BrandMark size={32} /><span>MetroSense</span></div>
          <h2 id="signin-title">Sign in to your console</h2>
          <p className="meta">For township and facilities staff.</p>

          <form className="auth-form" onSubmit={submit} noValidate>
            <label className="input-field">
              <span>Work email</span>
              <input
                type="email" autoComplete="username" placeholder="name@metrosense.demo"
                value={email} onChange={(ev) => { setEmail(ev.target.value); setError(''); }}
                aria-invalid={!!error}
              />
            </label>
            <label className="input-field">
              <span>Password</span>
              <span className="input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(ev) => { setPassword(ev.target.value); setError(''); }}
                  aria-invalid={!!error}
                />
                <button type="button" className="input-toggle" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            <div className="auth-row">
              <button type="button" className="link-btn" onClick={() => setForgot((v) => !v)}>Forgot password?</button>
            </div>
            {forgot && <p className="auth-note" role="status">In a pilot, password resets go through SDP's staff single sign-on. Not available in this demo.</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-block">Sign in</button>
          </form>

          <div className="auth-divider"><span>or</span></div>
          <button className="btn btn-quiet btn-block btn-sso" onClick={() => onSignIn(STAFF_ACCOUNTS[0])}>
            <BrandMark size={18} /> Continue with SDP single sign-on
          </button>

          <details className="auth-demo" open>
            <summary>Demo accounts (one-click sign-in)</summary>
            <ul className="account-list">
              {STAFF_ACCOUNTS.map((a) => (
                <li key={a.id}>
                  <button className="account" onClick={() => onSignIn(a)}>
                    <span className="avatar" aria-hidden="true">{a.initials}</span>
                    <span className="account-text">
                      <strong>{a.name}</strong>
                      <span className="meta">{a.role} · {PARTIES[a.team].name}</span>
                    </span>
                    <span className="account-go" aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="meta">Or type a demo email above with any password. Passwords are not checked or stored.</p>
          </details>
        </div>

        <div className="auth-guest">
          <div>
            <strong>Not SDP staff?</strong>
            <p className="meta">Report a broken streetlight, blocked drain or other problem without an account. Residents can keep using the SDP app.</p>
          </div>
          <button className="btn btn-quiet" onClick={onGuest}>Report a problem</button>
        </div>
        <button className="link-btn auth-link" onClick={onAssumptions}>How the demo data works</button>
      </section>
    </main>
  );
}
