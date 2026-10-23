import { RISK_COLORS, riskLevel, pct } from '../risk.js';
import { RiskIcon } from './RiskIcon.jsx';

// Alert stack for simulated sensor spikes, newest first. An alert with `info`
// is a plain message (for example, nothing left to spike).
export function Alerts({ alerts, theme, onView, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <div className="alerts" role="alert" aria-live="assertive">
      {alerts.map((a) => {
        if (a.info) {
          return (
            <div key={a.key} className="alert alert-info">
              <div className="alert-body"><span>{a.info}</span></div>
              <div className="alert-actions">
                <button className="icon-btn" onClick={() => onDismiss(a.key)} aria-label="Dismiss message">×</button>
              </div>
            </div>
          );
        }
        const l = riskLevel(a.risk);
        const color = RISK_COLORS[theme][l.key];
        return (
          <div key={a.key} className="alert" style={{ '--risk': color }}>
            <RiskIcon level={l} color={color} size={16} />
            <div className="alert-body">
              <strong>Sensor spike · {a.name}</strong>
              <span>{a.where}</span>
              <span className="alert-detail">
                {a.metric} jumped from {a.from} to {a.to} {a.unit} (alarm {a.threshold}). {l.label}, {pct(a.risk)}.
              </span>
              <span className="alert-detail">{a.action}</span>
              <span className="alert-time">{a.time} · simulated</span>
            </div>
            <div className="alert-actions">
              <button className="btn btn-small" onClick={() => onView(a)}>View</button>
              <button className="icon-btn" onClick={() => onDismiss(a.key)} aria-label="Dismiss alert">×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
