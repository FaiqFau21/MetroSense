import { SCENARIOS } from '../model/forecast.js';
import { FORECAST_STOPS } from '../data/catalogue.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "7 days", "1 year", "5 years"
export const rangeLabel = (d) => (d % 365 === 0 ? plural(d / 365, 'year') : plural(d, 'day'));
// "Today", "+30 days", "+5 years"
export const dayLabel = (d) => (d === 0 ? 'Today' : `+${rangeLabel(d)}`);

const TICKS = ['Today', '7d', '30d', '90d', '1y', '5y'];

// Forecast controls: the day slider and the scenario. The figures they drive are
// in the KPI strip.
export function ForecastBar({ day, scenario, totals, suggestion, onDay, onScenario }) {
  const index = FORECAST_STOPS.indexOf(day);
  return (
    <section className="forecast-bar" aria-label="Forecast controls">
      <div className="fb-row">
        <label className="fb-slider">
          <span className="fb-label">Forecast <strong>{dayLabel(day)}</strong></span>
          <input
            type="range" min={0} max={FORECAST_STOPS.length - 1} step={1} value={index}
            onChange={(e) => onDay(FORECAST_STOPS[Number(e.target.value)])}
            aria-valuetext={dayLabel(day)}
          />
          <span className="fb-ticks" aria-hidden="true">{TICKS.map((t) => <span key={t}>{t}</span>)}</span>
        </label>
        <div className="segmented" role="radiogroup" aria-label="Scenario">
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button
              key={key} role="radio" aria-checked={scenario === key}
              className={scenario === key ? 'is-on' : ''}
              onClick={() => onScenario(key)} title={s.note}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="fb-note">
        {totals.inRange < totals.total &&
          `${totals.total - totals.inRange} of ${totals.total} assets are still healthy at the end of their forecast range, so they are not forecast as far as ${rangeLabel(day)}. Problems past their range stay at least as bad unless fixed (≥). `}
        {scenario !== 'normal' && `${SCENARIOS[scenario].note} Assumed stress, simulated. `}
        {suggestion && suggestion.day !== day && (
          <>
            Suggested for {suggestion.label}: {dayLabel(suggestion.day)}.{' '}
            <button className="link-btn" onClick={() => onDay(suggestion.day)}>Use it</button>
          </>
        )}
      </p>
    </section>
  );
}
