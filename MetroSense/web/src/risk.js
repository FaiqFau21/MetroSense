// Risk bands. Colour is always paired with a label and a shape (CLAUDE.md section 8).
export const LEVELS = [
  { key: 'healthy', label: 'Healthy', min: 0, shape: 'circle' },
  { key: 'watch', label: 'Watch', min: 0.3, shape: 'triangle' },
  { key: 'serious', label: 'Serious', min: 0.5, shape: 'diamond' },
  { key: 'critical', label: 'Critical', min: 0.7, shape: 'octagon' },
];

// Shown when the chosen forecast day is past an asset's forecast range.
export const BEYOND_RANGE = { key: 'none', label: 'Beyond range', min: null, shape: 'ring' };

export const OPEN_PROBLEM_MIN = 0.3;

export function riskLevel(risk) {
  if (risk == null) return BEYOND_RANGE;
  let level = LEVELS[0];
  for (const l of LEVELS) if (risk >= l.min) level = l;
  return level;
}

export const RISK_COLORS = {
  light: { healthy: '#2e9a57', watch: '#d99a00', serious: '#e0620f', critical: '#cc2b2b', none: '#9a9187' },
  dark: { healthy: '#4cc27a', watch: '#f2b929', serious: '#fb8a3c', critical: '#f05252', none: '#7a7268' },
};

export const pct = (r) => (r == null ? '–' : `${Math.round(r * 100)}%`);

// Worst asset and per-band counts for any list of assets. Assets beyond their
// forecast range (risk null) are counted separately and never set the colour.
export function summarize(assets) {
  const counts = Object.fromEntries([...LEVELS, BEYOND_RANGE].map((l) => [l.key, 0]));
  let worst = null;
  for (const a of assets) {
    counts[riskLevel(a.risk).key] += 1;
    if (a.risk != null && (!worst || a.risk > worst.risk)) worst = a;
  }
  const openProblems = assets.filter((a) => a.risk != null && a.risk >= OPEN_PROBLEM_MIN).length;
  return { counts, worst, level: riskLevel(worst ? worst.risk : null), openProblems, total: assets.length };
}
