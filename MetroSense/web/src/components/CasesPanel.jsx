// Case queue: every reported or predicted problem, who it is routed to, and its
// status. Dispatching and resolving are simulated: nothing leaves the app.

import { useState } from 'react';
import { RISK_COLORS, riskLevel, pct } from '../risk.js';
import { RiskBadge } from './RiskIcon.jsx';
import { CHANNELS } from '../data/complaints.js';
import { dispatchMessage, canAct } from '../model/cases.js';

const fmtHours = (h) => (Math.abs(h) < 48 ? `${Math.max(1, Math.round(Math.abs(h)))} h` : `${Math.round(Math.abs(h) / 24)} days`);
const agoText = (h) => (h < 0.5 ? 'just now' : `${fmtHours(h)} ago`);

// Response deadline: only counts until the case is dispatched.
export function dueText(c) {
  if (c.status === 'Resolved') return 'Closed';
  if (c.status !== 'New') return `With ${c.party.name}`;
  return c.dueInHours < 0 ? `Unassigned, ${fmtHours(c.dueInHours)} past due` : `Assign within ${fmtHours(c.dueInHours)}`;
}
export const isOverdue = (c) => c.status === 'New' && c.dueInHours < 0;

function SourceChips({ c }) {
  return (
    <span className="chips">
      {c.sources.reports > 0 && <span className="chip">{c.sources.reports} report{c.sources.reports > 1 ? 's' : ''}</span>}
      {c.sources.sensor && <span className="chip">Sensor alert</span>}
      {c.sources.predicted && !c.sources.sensor && <span className="chip">Predicted</span>}
      {c.sources.weather && <span className="chip">Heavy rain ahead</span>}
    </span>
  );
}

// Photo from a report: a real upload from the guest form (kept in this browser
// only), or an illustration standing in for a resident's photo.
function ReportPhoto({ kind, url, reportId }) {
  if (url) {
    return (
      <figure className="report-photo">
        <img src={url} alt={`Photo attached to ${reportId}`} />
        <figcaption>Photo from {reportId} · uploaded on the guest form</figcaption>
      </figure>
    );
  }
  const sky = kind === 'streetlight' ? '#1d2742' : '#dfe6ee';
  return (
    <figure className="report-photo">
      <svg viewBox="0 0 160 100" role="img" aria-label={`Photo attached to ${reportId} (simulated illustration)`}>
        <rect width="160" height="100" fill={sky} />
        {kind === 'streetlight' && (
          <g>
            <rect x="0" y="82" width="160" height="18" fill="#3a4150" />
            <rect x="74" y="20" width="4" height="64" fill="#9aa1ad" />
            <rect x="76" y="18" width="30" height="7" rx="2" fill="#c9ced6" />
            <path d="M84 26 L76 60 L112 60 L104 26 Z" fill="#f5e7a8" opacity="0.35" />
            <path d="M118 16 l6 -4 M120 24 l8 0 M118 32 l6 4" stroke="#f5e7a8" strokeWidth="2" />
          </g>
        )}
        {kind === 'bins' && (
          <g>
            <rect x="0" y="80" width="160" height="20" fill="#b9c0c9" />
            {[20, 62, 104].map((x) => <rect key={x} x={x} y="46" width="34" height="38" rx="3" fill="#4f7a5a" />)}
            {[30, 46, 72, 90, 112, 126, 58].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 42 : 38} r="9" fill="#2d2f33" />)}
            <circle cx="140" cy="88" r="6" fill="#2d2f33" />
          </g>
        )}
        {kind === 'drain' && (
          <g>
            <rect x="0" y="0" width="160" height="100" fill="#cfd5dc" />
            <rect x="0" y="40" width="160" height="26" fill="#6b5a45" />
            {[16, 44, 70, 98, 128].map((x) => <ellipse key={x} cx={x} cy="50" rx="9" ry="4" fill="#7d8b4a" />)}
            <rect x="0" y="66" width="160" height="34" fill="#9aa3ad" />
            <ellipse cx="96" cy="80" rx="34" ry="6" fill="#7e93a8" opacity="0.8" />
          </g>
        )}
        {kind === 'playground' && (
          <g>
            <rect x="0" y="78" width="160" height="22" fill="#8a6f5a" />
            <path d="M30 80 L50 20 L70 80 M90 80 L110 20 L130 80 M50 20 L110 20" stroke="#4a6fa1" strokeWidth="5" fill="none" />
            <path d="M70 20 L70 56 M84 20 L84 40" stroke="#555" strokeWidth="2" />
            <rect x="64" y="56" width="22" height="5" fill="#d0533a" transform="rotate(-18 75 58)" />
            <path d="M100 82 l12 -6 l10 8" stroke="#3b2e25" strokeWidth="3" fill="none" />
          </g>
        )}
        {kind === 'dispenser' && (
          <g>
            <rect x="0" y="84" width="160" height="16" fill="#c4c9d0" />
            <rect x="62" y="18" width="36" height="66" rx="4" fill="#eef1f5" stroke="#9aa3ad" />
            <rect x="70" y="40" width="20" height="10" fill="#9aa3ad" />
            <ellipse cx="96" cy="90" rx="40" ry="6" fill="#7e93a8" opacity="0.8" />
          </g>
        )}
      </svg>
      <figcaption>Photo from {reportId} · simulated</figcaption>
    </figure>
  );
}

function CaseCard({ c, theme, user, onClose, onAction, onViewAsset }) {
  const colors = RISK_COLORS[theme];
  const lNow = riskLevel(c.risk);
  const lWeek = riskLevel(c.riskWeek);
  const own = c.partyKey === user?.team;
  const accept = own && user.access === 'team';
  const allowed = canAct(user, c);
  // Team staff accept their own jobs; a manager dispatches, and records progress
  // for parties outside MetroSense.
  const next = {
    New: ['dispatch', accept ? 'Accept job' : `Dispatch to ${c.party.name}`],
    Dispatched: ['start', own ? 'Mark work started' : `Record work started (for ${c.party.name})`],
    'In progress': ['resolve', own ? 'Mark resolved' : `Record resolved (for ${c.party.name})`],
  }[c.status];

  return (
    <section className="card selected-card case-card" aria-live="polite">
      <div className="card-head">
        <div>
          <p className="eyebrow">{c.id} · {c.category}</p>
          <h2>{c.title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close case">×</button>
      </div>
      <div className="case-badges">
        <span className={`priority priority-${c.priority}`}>{c.priority}</span>
        <span className={`status status-${c.status.replace(' ', '-').toLowerCase()}`}>{c.status}</span>
        <SourceChips c={c} />
      </div>

      <dl className="lifecycle case-facts">
        <div><dt>Location</dt><dd>{c.location}</dd></div>
        <div><dt>Item</dt><dd>{c.item}</dd></div>
        <div><dt>Model</dt><dd>{c.model}</dd></div>
        <div><dt>Responsible</dt><dd><strong>{c.party.name}</strong> · {c.party.kind}<br /><span className="meta">Why: {c.why}.</span></dd></div>
        <div><dt>Response</dt><dd className={isOverdue(c) ? 'overdue' : ''}>{dueText(c)}</dd></div>
        {c.risk != null && (
          <div>
            <dt>Predicted risk</dt>
            <dd className="case-risk">
              <RiskBadge level={lNow} color={colors[lNow.key]} value={`${pct(c.risk)} today`} />
              {c.riskWeek != null && <RiskBadge level={lWeek} color={colors[lWeek.key]} value={`${pct(c.riskWeek)} in 7 days`} />}
            </dd>
          </div>
        )}
      </dl>
      {c.assetId && <button className="btn btn-quiet btn-small case-view" onClick={() => onViewAsset(c)}>View asset and evidence</button>}

      {c.reports.length > 0 && (
        <>
          <h3>Reports</h3>
          <ul className="reports">
            {c.reports.map((r) => (
              <li key={r.id}>
                <div className="meta">
                  {r.id} · {CHANNELS[r.channel]} · {r.reporter} · {r.daysAgo === 0 ? 'today' : `${r.daysAgo} day${r.daysAgo > 1 ? 's' : ''} ago`} {r.time}
                  {r.lang === 'ms' && ' · sent in Bahasa Malaysia'}
                </div>
                <p className="report-text" lang={r.translation || r.lang === 'ms' ? 'ms' : undefined}>“{r.text}”</p>
                {r.translation && <p className="meta">Translation: {r.translation}</p>}
                {r.photo && <ReportPhoto kind={r.photo} url={r.photoUrl} reportId={r.id} />}
              </li>
            ))}
          </ul>
          <p className="meta">Reports are anonymised. Reporters get every status update in the SDP app, so they don't have to chase.</p>
        </>
      )}

      {next && (
        <>
          <h3>{c.status === 'New' && !accept ? 'Work order to send' : 'Next step'}</h3>
          {c.status === 'New' && !accept && <pre className="dispatch">{dispatchMessage(c)}</pre>}
          {allowed ? (
            <>
              <button className="btn" onClick={() => onAction(c, next[0])}>{next[1]}</button>
              <p className="meta">
                {own
                  ? 'Your team is responsible for this case.'
                  : c.party.kind === 'SDP'
                    ? `Recorded on behalf of ${c.party.name}; their staff can also update it.`
                    : `${c.party.name} works outside MetroSense, so progress they report by phone or email is recorded here.`}{' '}
                Simulated: nothing is sent outside this demo.
              </p>
            </>
          ) : (
            <p className="note note-neutral">
              View only. This case is routed to {c.party.name}; only that team or the township manager can update it.
            </p>
          )}
        </>
      )}

      <h3>Timeline</h3>
      <ol className="timeline">
        {c.events.map((ev, i) => (
          <li key={i}><span className="meta">{agoText(ev.hoursAgo)}</span> {ev.text}</li>
        ))}
      </ol>
    </section>
  );
}

export function CasesPanel({ cases, theme, user, team, teamName, defaultFilter = 'open', selectedCaseId, onSelectCase, onAction, onViewAsset }) {
  const [filter, setFilter] = useState(defaultFilter);
  const open = cases.filter((c) => c.status !== 'Resolved');
  const mine = open.filter((c) => c.partyKey === team);
  const shown = filter === 'open' ? open : filter === 'mine' ? mine : cases;
  const selected = cases.find((c) => c.id === selectedCaseId);
  const unassigned = open.filter((c) => c.status === 'New').length;
  const overdue = open.filter(isOverdue).length;

  return (
    <aside className="panel">
      {selected && (
        <CaseCard
          key={selected.id} c={selected} theme={theme} user={user}
          onClose={() => onSelectCase(null)} onAction={onAction} onViewAsset={onViewAsset}
        />
      )}
      <section className="card card-overview">
        <p className="eyebrow">Maintenance cases</p>
        <h2>{open.length} open cases</h2>
        <p className="meta">
          {unassigned} waiting to be assigned{overdue ? `, ${overdue} past the response time` : ''}. Resident reports and
          model predictions land here, routed to whoever is responsible.
        </p>
        <div className="segmented case-filter" role="radiogroup" aria-label="Show cases">
          {[['open', `Open (${open.length})`], ...(team ? [['mine', `My team (${mine.length})`]] : []), ['all', 'All']].map(([k, label]) => (
            <button key={k} role="radio" aria-checked={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        {filter === 'mine' && teamName && <p className="meta">Cases routed to {teamName}.</p>}
        {shown.length === 0 && (
          <p className="empty">{filter === 'mine' ? 'Nothing open for your team.' : 'No open cases. Everything reported has been fixed.'}</p>
        )}
        <ul className="row-list">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                className={`row case-row p-${c.priority} ${c.id === selectedCaseId ? 'is-selected' : ''}`}
                aria-pressed={c.id === selectedCaseId}
                onClick={() => onSelectCase(c.id)}
              >
                <span className={`priority priority-${c.priority}`}>{c.priority}</span>
                <span className="row-main">
                  <strong>{c.title}</strong>
                  <span className="meta">{c.item} · {c.location}</span>
                  <span className="meta">→ {c.party.name}</span>
                  <SourceChips c={c} />
                </span>
                <span className="case-side">
                  <span className={`status status-${c.status.replace(' ', '-').toLowerCase()}`}>{c.status}</span>
                  <span className={`case-due ${isOverdue(c) ? 'overdue' : ''}`}>{dueText(c)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
