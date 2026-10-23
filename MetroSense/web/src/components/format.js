// Small text helpers shared by the side panel, map popover and detail window.
import { durationText } from '../model/problem.js';
import { rangeLabel } from './ForecastBar.jsx';

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "1 day", "1 week", "6 months", "1 year"
export const intervalText = (days) => {
  if (days >= 360) return plural(Math.round(days / 365), 'year');
  if (days >= 28) return plural(Math.round(days / 30), 'month');
  if (days >= 7) return plural(Math.round(days / 7), 'week');
  return plural(days, 'day');
};

export const range = (lo, hi, fmt) => (fmt(lo) === fmt(hi) ? fmt(lo) : `${fmt(lo)} to ${fmt(hi)}`);

export const failureText = (d, horizon) => {
  if (d == null) return 'No worsening trend';
  if (d === 0) return 'Now';
  if (d > horizon) return `Beyond ${rangeLabel(horizon)}`;
  return `~${durationText(d)}`;
};

export const fmtNum = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100);

// Risk at the chosen forecast day. "≥" marks a problem held past its forecast
// range: without a fix it stays at least this bad.
export const riskText = (e) => (e.risk == null ? `max ${rangeLabel(e.horizonDays)}` : `${e.held ? '≥' : ''}${Math.round(e.risk * 100)}%`);

export const daysAgoText = (d) => (d === 0 ? 'today' : `${plural(d, 'day')} ago`);
