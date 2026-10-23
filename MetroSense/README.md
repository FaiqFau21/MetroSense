# MetroSense

**Predict, report and fix township assets, built for Sime Darby Property townships.**

> **Concept demo.** All data is simulated, and MetroSense is not an official Sime Darby Property product. Built for the SDP University Hackathon 2026 ("Township of Tomorrow", PEOPLE theme).

## Contents

- [Project overview](#project-overview)
- [Tech stack](#tech-stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Features](#features)
- [90-second demo script](#90-second-demo-script)
- [Tests](#tests)
- [How the numbers work](#asset-groups-and-forecast-ranges)

## Project overview

**The problem (briefing slide 15):** residents waste time chasing updates because they don't know whom to contact or how to track an issue, and many faults are only found after someone complains.

**What MetroSense does:** it gives township and facilities staff one map-based view of every asset in a development, from the office buildings to the streets, drains, bin centres and parks around them.

- **Predict:** scores every asset's risk of failure from its age, readings (sensor, technician or inspection), servicing and reports, and forecasts it from today to 5 years ahead.
- **Report:** takes in reports from the SDP resident app, WhatsApp, the hotline, email and a guest web form, and merges them per asset.
- **Fix:** routes each case to whoever fixes it (SDP, the council, a contractor or a vendor) with the location, item, model and photo, tracks it to resolution, and feeds each repair back into the forecast.

**Who uses it:** SDP staff sign in. A township manager oversees and dispatches every case; a facilities engineer works their own team's cases. People without the SDP app (visitors, tenants, passers-by) can send a report through the guest form, but have no dashboard. Residents keep using the SDP app.

**Demo setting:** Ara Damansara, Petaling Jaya: four illustrative office buildings (58 floors) and the public realm around them, 481 assets in all. Building shapes, names and all figures are made up for the demo.

See [`CLAUDE.md`](CLAUDE.md) for the full brief and decision log.

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| UI | [React](https://react.dev) 18.3 | Single-page app; pages by URL hash (`#login`, `#report`, `#assumptions`) |
| Build and dev server | [Vite](https://vitejs.dev) 5.4 with `@vitejs/plugin-react` | Dev server on port 5173 |
| 3D map | [three.js](https://threejs.org) 0.169, [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) 8.17, [@react-three/drei](https://github.com/pmndrs/drei) 9.117 | Campus, exploded floor stack, floor layouts; loaded on demand |
| Charts | [Recharts](https://recharts.org) 2.13 | Evidence and forecast chart; loaded when the detail window opens |
| Model | Plain JavaScript (`web/src/model/`) | Transparent health-index risk score behind one function, `score(equipment, readings, day, scenario)` |
| Data | Deterministic generator (`web/src/data/`) | Fixed random seed, so the demo is identical on every run |
| Tests | Node's built-in test runner (`node --test`) | No test framework dependency |
| Styling | Plain CSS with light and dark themes | `web/src/styles.css` |

**Planned, not built yet** (Milestone 4 in `CLAUDE.md`): a FastAPI backend (Python, pandas, scikit-learn) for scoring and a trained model, and Supabase (Postgres plus Realtime) for assets, readings and cases. Optional hosting: Vercel for the frontend, Render or Railway for the API.

### Project structure

```
SIME DARBY/
├── CLAUDE.md                 project brief, rules and decision log
├── README.md
└── web/                      the app
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx           pages, state, routing between views
        ├── styles.css
        ├── components/       panels, KPI cards, login, guest form, detail window, map pop-up
        ├── scene/            3D campus, buildings, floors, street assets, scenery
        ├── model/            risk score, forecast, cases, routing, replacement, maintenance log (+ *.test.js)
        └── data/             seed generator, asset catalogue, readings, reports, weather, accounts, text
```

## Local setup

**You need:** [Node.js](https://nodejs.org) 18 or later (tested on Node 24) and npm, which comes with Node. A browser with WebGL (any recent Chrome, Edge, Firefox or Safari). No database, API key or account is needed.

1. Open a terminal in the project folder and install the app's dependencies:

   ```bash
   cd web
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 and sign in with a demo account (one click on the login page), or type a demo email with any password:

   | Account | Email | Role |
   |---|---|---|
   | Nurul Huda | `nurul.huda@metrosense.demo` | Township manager: sees and updates every case |
   | Daniel Lee | `daniel.lee@metrosense.demo` | Facilities engineer: updates his team's cases only |

   Passwords are not checked or stored. The guest report form is at http://localhost:5173/#report.

**Other commands** (run inside `web/`):

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm test` | Runs the unit tests |
| `npm run build` | Production build into `web/dist/` |
| `npm run preview` | Serves the production build locally |

**Troubleshooting:**
- *"Port 5173 is already in use":* another dev server is still running. Stop it, or close the terminal that started it, then run `npm run dev` again.
- *The 3D view says it is unavailable:* the browser has WebGL turned off. The side-panel lists still work.
- *A panel shows "Something went wrong" right after code changes:* the dev server may have kept an old copy of a file. Stop it and run `npm run dev` again.
- *Odd state during a demo:* press **Reset** in the header. Sign-in lasts for the browser tab; the theme and guest-form language are remembered in the browser.

## Environment variables

**None are needed.** The app runs entirely in the browser on simulated data and reads no environment variables, so there is no `.env` file to create.

When the planned backend is added, the frontend will read these from `web/.env.local` (git-ignored). Vite only exposes variables that start with `VITE_` to the browser:

| Variable | Status | Purpose |
|---|---|---|
| `VITE_API_URL` | Planned, not read yet | Base URL of the FastAPI scoring API, for example `http://localhost:8000` |
| `VITE_SUPABASE_URL` | Planned, not read yet | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Planned, not read yet | Supabase public (anon) key; access is limited by row-level security |

Never put the Supabase service-role key, or any other secret, in a `VITE_` variable: everything with that prefix is bundled into the public JavaScript. Secrets belong in the backend's own environment.

## Features

- **Campus and floors:** four illustrative buildings (58 floors) in Ara Damansara, coloured by worst risk from a fixed-seed generator (`web/src/data/seed.js`). Click a building to open its floor stack, a floor for its layout, and an asset for its detail: problem, lifecycle facts, model/spec, a history and forecast chart, impact, recommended action, and planned vs emergency cost.
- **Lights on every floor:** each office floor (not the roof-plant level) has a "Lights" asset covering its light fittings and emergency lights. A technician checks it monthly (failed fittings and the emergency-light test switch) and it gets a full 3-hour emergency duration test every year. Faults: failing fittings (dark patches) or emergency-light batteries failing their test; routed to SDP Building Facilities.
- **Public realm:** 12 streetlights, 3 bin centres, 4 drains and a playground around the buildings, drawn at street level. 481 assets in all.
- **Cases (reactive + proactive):** the **Cases** tab is a work queue.
  - Resident reports (simulated: SDP app, WhatsApp, hotline, email; one in Malay; some with photos) are merged per asset and matched to it.
  - Assets the model expects to be high risk within 7 days, using the weather forecast, open a case with no report needed.
  - Each case is routed by a per-township rule table (`web/src/model/routing.js`) with a priority and a response time.
  - Dispatch → work started → resolved; reporters get an update at each step (simulated).
  - **Who can update a case:** the township manager can act on every case, including recording progress for outside parties (contractors, the council, vendors) that don't use MetroSense. A facilities engineer can accept, start and resolve their own team's cases; other cases are view-only. The timeline records who made each change.
  - While a repair is dispatched or in progress, the asset shows an "In progress" or "Dispatched" badge on the map, in the lists and on the High risk card. Its risk colour stays until the case is resolved, because the asset isn't fixed yet.
  - Resolving a case resets the asset's condition and service date, so it turns healthy and the fix feeds back into the forecast.
- **Reports as evidence:** each open report adds 10% to its asset's risk (max 20%), because residents often notice a fault before the next scheduled reading.
- **Forecast and scenarios:** slider stops Today, 7 days, 30 days, 90 days, 1 year, 5 years; scenarios Normal / Weather / Heavy rain / Heat wave. Each asset is forecast only as far ahead as its warning time. Past that, an unfixed problem keeps at least the risk it had at the end of its range (shown as "≥ 57%"), so moving the slider later never makes a problem look better. An asset that is still healthy at the end of its range shows as "Beyond range".
- **Repair or replace:** each asset gets a rule-based verdict (`web/src/model/replacement.js`): replace (near end of life, or an ageing unit whose repair is a big share of a new one), upgrade early (the energy saving pays back within 5 years), or repair now and plan the replacement. The detail window shows the replacement, installed cost, energy saved (RM and kWh a year), carbon avoided and payback. The campus overview totals the candidates. All figures are stated assumptions.
- **Weather:** a simulated 14-day forecast for Petaling Jaya (`web/src/data/weather.js`): heavy rain Tue–Thu, then a hot spell next Mon–Thu. Shown as a phone-style widget: the card takes the colour of today's sky, with colour icons, highs and lows, a rain bar per day and alert chips; "Use in forecast" switches the scenario to it.
- **Live demo:** "Simulate sensor spike" pushes a healthy sensor asset's reading past its alarm. It turns red, an alert appears, the camera flies to it, and a case opens. First press: Lift 1 on Office Block C.
- **Map pop-up and detail window:** click any asset on the map (or a row in the side panel) for a pop-up with its risk, problem, time to failure, action and case. **See details** opens a window with a plain description of the asset, the evidence chart, why the risk is what it is, impact, cost, lifecycle with the next service date, and a **maintenance log**. The log lists installation, routine services or inspections (with their readings), technician readings, past repairs, reports and case updates, including any made in this session. It is filterable and newest first (`web/src/model/maintenanceLog.js`; past repairs are simulated from a fixed seed). The side panel keeps a short drop-down per asset.
- **Guided tour:** after each sign-in a 10-step tour spotlights each part of the dashboard in turn: key figures, the map, legend, forecast slider, asset list, case queue, the spike button and where to find help. Each step has a short explanation, Back / Next and Skip, and the case step is worded for the user's role. A "Show this tour every time I sign in" box turns it off (remembered per account in the browser), and the **Tutorial** button in the header replays it any time. Keyboard: arrow keys and Esc.
- **Staff sign-in:** MetroSense is an admin tool. The login page (`#login`) takes a demo work email (`nurul.huda@metrosense.demo` or `daniel.lee@metrosense.demo`) with any password (passwords are not checked or stored), or one-click demo accounts: Nurul Huda, township manager, or Daniel Lee, facilities engineer. The header shows who is signed in, with a menu to switch theme, open the guest form or sign out. The Cases tab has a **My team** filter; Daniel's sign-in opens on it.
- **Guest reports (`#report`):** a report-only form for people without the SDP app, such as visitors, tenants and passers-by. There is no account and no dashboard. Pick what is wrong, tap the map (or pick a place), describe it and optionally add a photo. The report is matched to the nearest asset of that kind (`web/src/model/guest.js`), shows who it goes to, and lands in the staff case queue like any other report. Property owners are pointed to the SDP app. The form has an **EN / BM** switch (English or Bahasa Malaysia, remembered in the browser); staff see that a report was sent in Bahasa Malaysia.
- **Dashboard:** KPI cards for open cases, high risk, next predicted failure, open problems, overdue checks and weather. The cards are tinted by status (red when anything is high risk, amber for open problems and overdue checks) and always pair the colour with an icon and words.
- **Critical items beam:** anything critical on the map (a building, a floor in the exploded stack, an equipment point or a street asset) pulses its red glow, with a ring that pings outward on the ground. Buildings and street assets also send up a soft light beam, and their labels pulse. Other risk levels stay still. The pulse is slow (0.8 a second, well under the 3-flashes-a-second accessibility limit); with "reduce motion" switched on, the glow and ring are held steady instead.
- **Map:** a collapsible legend explains the risk colours, the shapes (round cylinder = live sensor, square block = checked by hand or inspected) and the report chips. Roads, trees, a car park and grey neighbouring buildings are decoration only (`web/src/scene/Scenery.jsx`); they are not the real Ara Damansara layout.
- **Look:** SDP-inspired colours (navy controls and headings, a red-to-orange brand stripe); no SDP logo. Light and dark themes; works at phone width.
- **Not built:** backend (FastAPI + Supabase, Milestone 4), a real SDP app connection, machine-learning model.

## 90-second demo script

**Before you start:** open the app full screen (about 1440 px wide), sign in as **Nurul Huda**, press **Reset** if it shows, check the slider says **Today** and the scenario is **Normal**, and set **Light** theme (it's remembered).

| Time | Do | Say |
|---|---|---|
| 0:00 | Campus view, no clicks | "This is Ara Damansara: four office buildings and the streets around them, 481 assets, all simulated. Colour shows the worst predicted problem; the blue chips are resident reports." |
| 0:10 | Point at the **Open cases** card | "12 open cases: 7 from residents and tenants, 5 the model raised on its own." |
| 0:15 | Click **Tower A** → **L14** → **AHU-14**; the pop-up shows the summary (press **See details** for the chart if there's time) | "Air handler 14 is blocking up. The model already had it at 78%; a tenant just emailed that Level 14 is warm, which takes it to 88%. Recommended: replace the filters within 3 days, off-hours." |
| 0:35 | Click the **Cases** tab → **Streetlight LED driver failing** | "Residents reported this streetlight twice, on the app and on WhatsApp in Malay, and it has sat unassigned for over a day. That's exactly the problem SDP described. We merge the reports, match them to the streetlight, and route it to SDP Township Management." |
| 0:50 | Click **Dispatch to SDP Township Management** | "The work order goes out with location, item, model and photo, and both residents get an update automatically. No chasing." |
| 0:58 | Open the **Silt build-up** (Drain DR-2) case | "This drain had one report, but heavy rain is forecast for Tuesday, so the model expects it to be serious within a week. It goes to the council now, before it floods." |
| 1:08 | Press **Simulate sensor spike** | "Where there are sensors, problems arrive on their own: a lift door sensor just jumped, and a case is already open for the lift contractor." |
| 1:18 | Click **Assumptions** | "When a case is closed, the repair feeds back into the forecast. Every number traces back to a reading or a stated assumption. The data is simulated; the model is a transparent health index, ready for machine learning once real BMS and work-order history exists." |

**Clicking tips (from rehearsal):**
- Click the floating labels ("Tower A", "L14", "AHU-14"), not the 3D shapes. The side-panel rows do the same thing and are the biggest targets.
- In a case card, the action button sits under the work order; scroll the panel if needed.
- Slider: click its handle once, then use → to step and **Home** to jump back to Today.
- Start each sentence as you click; camera moves take about 1.5 seconds.

**If something goes wrong:** press **Reset**, or Esc to step back a level. If the 3D view can't start (no WebGL), the lists in the side panel still work.

**Likely questions:**
- *Is this real Sime Darby data, or connected to the SDP app?* No. Everything is simulated from a fixed seed. The app shows how reports from the SDP app would be handled; it isn't connected.
- *Who fixes what?* A routing table per township (`routing.js`): SDP for building systems and common areas, the lift contractor for lifts, the council for public drains, the council's contractor for waste, and the vendor for rental appliances. It differs by state, for example for waste collection; confirm with SDP township management before a pilot.
- *Is it AI or machine learning?* Not yet. It's an explainable health-index formula with straight-line trends, plus rule-based routing. A trained model needs real sensor history and work orders recording actual failures; it would plug in behind the same `score()` function.
- *Do we need sensors?* No. Big plant usually already logs data. Floor-level and street items work from technician readings and resident reports; structure, pipes and wiring from inspections. The app flags where checks are too far apart for the warning time: the first places a sensor would pay off.
- *What about privacy?* Reports are anonymised (no names, phone numbers or unit numbers); photos would have faces and number plates blurred, in line with PDPA.

## Tests

```
cd web
npm test
```

Uses Node's built-in test runner (no extra dependency); 59 tests. Covers the health index (all five terms), trend fits, scenarios and weather, forecast ranges (including that a problem never disappears as the forecast moves later), `score()`, spikes, routing, case building and permissions, the repair feedback loop, work-status badges, repair-or-replace advice, the maintenance log, guest-report matching, the English and Bahasa Malaysia form text, public-realm layout, and the demo figures.

## Asset groups and forecast ranges

Each asset type has three lifecycle numbers (`web/src/data/catalogue.js`), all typical industry rules of thumb used as assumptions:

- **Design life**: years until replacement. Drives the age term of the risk.
- **Service interval**: how often it is serviced or inspected. Drives the overdue-service term.
- **Warning time** (P–F interval): typical time from the first detectable sign to failure. Sets the **forecast range**: the first slider stop that covers it.

| Group | Types | Data | Forecast up to |
|---|---|---|---|
| Structure & envelope | floor slab, roof waterproofing | inspection | 1–5 years |
| Piping & wiring | water pipework, floor wiring | inspection | 1–5 years |
| Major plant | chiller, lift, fire pump, generator | daily sensor | 30–90 days |
| Building services | AHU, UPS | daily sensor | 30–90 days |
| Building services | FCU, booster and sump pumps, DB, lighting panel, lights and emergency lights (every office floor) | technician reading | 30–90 days |
| Sensors & controls | BMS sensors | daily sensor | 7 days |
| Public realm | streetlight, bin centre | technician reading (monthly / weekly) | 7–90 days |
| Public realm | drain, playground | inspection (monthly) | 30–90 days |

## Where numbers come from

Risk (`web/src/model/healthIndex.js`), clamped to 0 to 0.99:

```
risk = 0.03                                   base rate
     + 0.20 × (age / design life)^1.5         age
     + 0.75 × drift²                          condition
     + 0.15 × overdue fraction                service or inspection overdue
     + 0.10 × open resident reports           reports about this asset (max +0.20)
```

- Drift: how far the metric has moved from its normal level towards its alarm level (0 = normal, 1 = alarm).
- Overdue fraction: days past the service interval ÷ the interval, capped at 1. The forecast assumes "no action".
- Readings (`web/src/data/readings.js`): 30 daily values for sensor assets, the last 6 rounds for technician-read assets, and inspections over the last 3 years. All generated from the asset id.
- Trend (`web/src/model/forecast.js`): a straight line fitted to recent readings, carried forward to today and extended. Time to failure is when it reaches the alarm level.
- Scenarios and weather mark some days as heavy-rain or hot days, when affected asset types degrade faster (`STRESS` in `forecast.js`).
- Cases (`web/src/model/cases.js`): reports merged per asset; model cases for assets at 50% risk or more today or within 7 days with the weather forecast. Priority P1–P3 from risk, reports and safety, with response times of 8, 48 and 120 hours.
- Impact, action and cost: rules in `web/src/model/problem.js`. Occupancy, public-realm usage and RM costs are assumptions listed there.
- The full list is on the in-app **Assumptions** page.

## Demo assets

These assets are planted so the demo script holds. Their drift and trend are set so the same formulas give these figures:

- Tower A Level 14 AHU: 78% from readings (88% with the tenant's report), about 6 days to failure.
- Tower B Chiller 1: 61%.
- Five "watch" assets that fail in 10–13 days: Tower A Lift 2 and AHU-9, Tower B fire pump, Office Block C AHU-7, Annex D UPS.
- Public realm: Streetlight SL-04, Bin centre BC-2, Drain DR-2 (worsened by the forecast heavy rain), Playground PG-1, each with resident reports.
- Long range: Tower A Level 6 slab, Tower B roof waterproofing, Annex D Level 2 wiring, Office Block C Level 3 pipework.
