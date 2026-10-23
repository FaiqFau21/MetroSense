// Simulated 14-day weather forecast for the demo campus (Petaling Jaya area).
// Hand-written so the demo is the same every run: an inter-monsoon spell of
// afternoon storms with a few days of heavy rain, then a short hot spell.
// Not real forecast data. A live feed could replace WEATHER later without
// changing anything else.

import { DEMO_TODAY } from './seed.js';

export const WEATHER_LOCATION = 'Petaling Jaya';
export const HEAVY_RAIN_MM = 30; // daily rainfall treated as heavy rain (assumption)
export const HOT_DAY_C = 35; // daily maximum treated as heat stress (assumption)

// [max °C, min °C, rain mm, condition]
const DAYS = [
  [33, 25, 12, 'storm'],
  [32, 24, 18, 'storm'],
  [30, 24, 46, 'rain'],
  [29, 23, 62, 'rain'],
  [30, 24, 38, 'rain'],
  [32, 24, 8, 'cloud'],
  [33, 25, 4, 'cloud'],
  [34, 25, 0, 'sun'],
  [35, 26, 0, 'sun'],
  [36, 26, 0, 'sun'],
  [36, 27, 2, 'sun'],
  [35, 26, 6, 'cloud'],
  [33, 25, 22, 'storm'],
  [32, 24, 15, 'storm'],
];

export const CONDITIONS = {
  sun: 'Sunny',
  cloud: 'Cloudy',
  rain: 'Heavy rain',
  storm: 'Thunderstorms',
};

const start = new Date(`${DEMO_TODAY}T00:00:00`);
const dateLabel = (i) => {
  const d = new Date(start);
  d.setDate(d.getDate() + i);
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  };
};

export const WEATHER = DAYS.map(([maxC, minC, rainMm, condition], day) => ({
  day, maxC, minC, rainMm, condition, ...dateLabel(day),
  stress: rainMm >= HEAVY_RAIN_MM ? 'rain' : maxC >= HOT_DAY_C ? 'heat' : null,
}));

export const WEATHER_DAYS = WEATHER.length;

// Which kind of stress (if any) the forecast puts on day i from today.
export const weatherStressOn = (i) => WEATHER[i]?.stress ?? null;

// Consecutive runs of the same stress, for headlines like "Heavy rain Tue–Thu".
export function weatherEvents() {
  const events = [];
  for (const w of WEATHER) {
    const last = events.at(-1);
    if (w.stress && last && last.kind === w.stress && last.to === w.day - 1) last.to = w.day;
    else if (w.stress) events.push({ kind: w.stress, from: w.day, to: w.day });
  }
  // A run starting a week or more ahead says "next", so "Mon" never reads as
  // this week's Monday.
  return events.map((e) => {
    const days = e.from === e.to ? WEATHER[e.from].weekday : `${WEATHER[e.from].weekday}–${WEATHER[e.to].weekday}`;
    return { ...e, label: e.kind === 'rain' ? 'Heavy rain' : 'Hot spell', when: e.from >= 7 ? `next ${days}` : days };
  });
}
