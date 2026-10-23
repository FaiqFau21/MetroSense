# Project brief: MetroSense (predictive and reactive maintenance for SDP townships)

Product name (user decision, 2026-10-19, renamed from "TownSense" the same day): **MetroSense: predict, report and fix township assets, built for Sime Darby Property townships.** The tagline appears on the login page and in docs, not in the dashboard header (user decision). Rejected names: "TownSense" (replaced), "SkySense" (echoes SkyWorld, a rival developer; name already used elsewhere; "Sky" implies drones) and "SimeSense" (borrows the Sime Darby trademark). Keep SDP in the subtitle only, as a description, never in the product name.

## 1. One-line pitch
A 3D view of Sime Darby Property's Ara Damansara development, covering the office buildings and the public realm around them (streetlights, drains, bin centres, playground). It predicts which assets are about to fail, takes in resident reports from the SDP app and other channels, and routes each case, with location, item, model and photo, to whoever is responsible for fixing it: SDP, the council, a contractor or a vendor. Closed cases feed back into the model.

## 0. Hackathon context (from the SDP University Hackathon 2026 briefing, "Township of Tomorrow")
- Theme: **PEOPLE** (choose one focus area). Problem it matches (briefing slide 15): "Getting help for public assets: residents waste time chasing updates because they do not know whom to contact or how to track an issue." Test: fewer follow-ups and faster resolution. Energy savings from replacement advice are a PLANET co-benefit, not the theme.
- Judging: Impact & sustainability 25%, Innovation 20%, Feasibility 20%, Strategic fit 15%, Commercial value 10%, Team/evidence/pitch 10%. Solve ONE problem well; validate it with residents.
- Deadlines: registration closes 21 Oct 2026; proposal due 23 Oct 2026, 11:59 PM: pitch deck (max 10 main slides), 5-minute video or demo link, prototype/code link (GitHub or hosted). Top 10 announced 28 Oct; mentoring 2–6 Nov; final submission 11 Nov; pitch 14 Nov (10 min + 5 min Q&A).
- Submissions become the organiser's IP (briefing slide 32). Complaint data and photos are personal data under PDPA: anonymise in the demo.

## 2. Scope (small scale on purpose)
- One campus: the Sime Darby group main offices in Ara Damansara, Petaling Jaya. Public sources confirm that Sime Darby Berhad and Sime Darby Property are headquartered there. They do not give building names or addresses.
- 3 to 5 buildings only. Use illustrative building masses (towers and a low podium or annex), not real architectural drawings. Do not claim the models match the real buildings.
- Each building has 8 to 25 floors. Each floor has 2 to 6 monitored pieces of equipment. Roughly 150 to 300 assets in total.
- All data is synthetic and must be labelled "Simulated data" in the UI. No real Sime Darby data, floor plans, security details or logos. The UI may name Ara Damansara as the demo setting but must say it is a concept demo.
- Public realm around the buildings (added for the hackathon): streetlights, drains, bin centres and a playground, with resident complaints, routing to responsible parties and case tracking. Complaints are simulated; the SDP app integration is described, not real.
- Out of scope: city-scale maps, real sensor integration, authentication beyond the demo, mobile app.

## 3. Core user flow (this is the demo)
1. Campus view (3D). Buildings are neutral-coloured. Each takes the colour of its worst predicted problem (healthy, watch, serious, critical) and shows a floating marker. Orbit, pan and zoom. A "Plan view" button flips to top-down.
2. Click a building. The camera flies to it and the building opens into a floor stack: each level is a slab, spaced out vertically ("exploded view"). Each slab is tinted by its worst equipment. A side panel lists the floors with a risk badge and a count of open problems.
3. Click a floor. The other floors fade out and the slab shows a simple 2D floor layout with equipment points (plant room, risers, AHUs, DB room, lift lobby, pump room). Each point is coloured by risk.
4. Click a piece of equipment or a problem. A detail panel shows the problem type, evidence, forecast and recommended action (section 4).
5. Time slider (today to +30 days). Colours and counts change with the forecast. This is the "predictive" moment.
6. Scenario toggles: Normal, Heavy rain, Heat wave.
7. "Simulate sensor spike" button. It faults a random healthy machine. The building and floor change colour, an alert appears and the camera flies to it. Keep this reliable; it is the demo's showpiece.

## 4. What "type of problem" means
Every at-risk asset shows a problem record with these fields:
- Category: HVAC, Electrical, Vertical transport, Plumbing and water, Fire and life safety, Controls and network, Lighting and power quality.
- Specific fault: a short human label, for example "Chiller compressor bearing wear", "Lift door operator fault trend", "Switchboard terminal overheating", "Booster pump seal leak", "UPS battery capacity fade", "AHU filter blockage", "Fire pump low pressure trend", "BMS sensor drifting or offline".
- Evidence: the metric, current value, alarm threshold and a 30-day history plus forecast chart.
- Severity and forecast: risk percent today and at the chosen day, plus estimated days to failure.
- Impact: what happens if it fails (for example "no cooling on floors 12 to 18", "lift 3 out of service", "data room power at risk") and roughly how many occupants are affected.
- AI Recommended action and timing: for example "replace within 7 days, off-hours".
- Cost: planned repair versus emergency failure in RM (assumed unit costs, shown as assumptions).

Starter catalogue (asset type, metric, example fault modes): chiller (compressor vibration; bearing wear, low refrigerant), AHU/FCU (differential pressure; filter blockage, belt wear, coil fouling), lift (door faults per 1,000 trips; door operator, rope wear), booster/fire/sump pump (vibration; seal leak, bearing wear, low pressure), generator (start-up voltage drop; battery or starter fault), UPS (battery capacity; cell degradation), distribution board (hotspot above ambient; loose terminal), BMS sensors (packet loss; offline or drift).

## 5. Tech stack
- Frontend: React + Vite, `@react-three/fiber` and `@react-three/drei` for the 3D scene, Recharts for charts.
- Backend: FastAPI (Python) with pandas, NumPy and scikit-learn.
- Database and realtime: Supabase (Postgres, Realtime for live risk updates).
- Hosting (optional): Vercel for the frontend, Render or Railway for the API.

## 6. Data model (Postgres)
`campus` (id, name) → `building` (id, campus_id, name, floors, footprint_w, footprint_d, floor_height) → `floor` (id, building_id, level, label) → `equipment` (id, floor_id, type, name, x, y, installed_at, design_life_years) → `reading` (equipment_id, ts, metric, value) → `risk_score` (equipment_id, ts, risk_0_1, days_to_failure, model_version) → `problem` (id, equipment_id, category, fault, severity, impact, action, planned_cost, emergency_cost, status).

Seed with a deterministic script (fixed random seed) so the demo looks the same every run.

## 7. Model
- Start with a transparent health-index trend per asset: risk rises with age and with recent drift in its metric.
- Then replace it with a scikit-learn model: gradient boosting for failure probability within 30 days, and a simple regression for remaining useful life. Train on the synthetic readings, and optionally on public degradation data (NASA C-MAPSS) for the pitch.
- FastAPI endpoints: `GET /risk?day=N&scenario=normal|rain|heat`, `POST /simulate/spike`, `POST /reset`.
- Keep the model swappable behind one function, `score(equipment, readings, day, scenario)`. Be upfront in the UI and pitch that the data is simulated.

## 8. UI and design requirements
- Light and dark themes. Risk colours are reserved for status: healthy green, watch amber, serious orange, critical red. Always pair colour with a label and shape so it works for colour-blind users.
- SDP-inspired look: navy for controls and headings, a navy gradient header with a thin red-to-orange brand stripe, white cards on tinted grey bands. The brand red/orange is only used in the stripe (and MetroSense's own pin mark), never in a way that could be mistaken for a risk status.
- Works at 1440 px and at phone width (3D area plus stacked panels). Respect `prefers-reduced-motion`.
- Every number on screen should trace back to a reading or a stated assumption.

## 9. Milestones (build in this order, verify each)
1. Static campus. 3D scene with 3 to 5 buildings, orbit and plan view, buildings coloured from seeded data. Done when: clicking a building selects it and shows its name.
2. Floor stack. Click a building to see the exploded floor view with a per-floor risk badge and problem count. Done when: every floor shows the right worst-risk colour.
3. Floor layout and equipment. Click a floor to see the 2D layout with equipment points. Done when: clicking equipment opens the problem detail with evidence and a forecast chart.
4. Backend and database. Supabase schema, seed script, FastAPI scoring endpoint. Done when: the frontend reads risk from the API, not from hard-coded data.
5. Forecast and scenarios. Time slider and Normal, Heavy rain, Heat wave. Done when: moving the slider changes colours, counts and the cost-avoided figure.
6. Live demo mode. Sensor simulator and the spike button with alerts. Done when: a spike turns a building, floor and equipment red within 2 seconds and the camera flies to it.
7. Polish and pitch. Empty and error states, mobile layout, a 90-second demo script in the README, and a data-assumptions page.

## 10. Demo script (90 seconds)
1. "This is the campus. Two buildings show risk." (campus view)
2. Click the red building. "Floor 14 is the problem." (floor stack)
3. Click the floor, then the AHU. "Filter blockage trend, 78% risk, about 6 days." (detail)
4. Move the slider to +14 days. "Without action, five more assets go high-risk." (forecast)
5. Press the spike button. "A lift door sensor just jumped. The system flags it and tells us what to do." (live)
6. "Fixing early avoids roughly RM X versus emergency failure." (cost)

## 11. Rules for Claude Code
- Ask before adding new dependencies beyond section 5.
- Keep the scoring function pure and unit-tested.
- Seed data must be deterministic.
- Never present simulated figures as real; keep the "Simulated data" badge.
- SDP-inspired colours are allowed (navy controls, red-orange brand stripe) because this is an entry to Sime Darby Property's own hackathon (user decision, 2026-10-19). Never use the SDP logo, and never present the app as an official SDP product. Do not use any other company's logo or branding.
- Commit after each milestone.

## 12. Open questions to answer before starting
1. Which exact buildings or offices should the campus include? Confirm names and addresses from an official source. The model will use them as labels only.
2. Is the focus occupant comfort and uptime (HVAC, lifts, power) or also energy cost? This decides which problem types get the most detail.
3. Is the demo for judges only, or will a facilities team use it afterwards? That decides how much to invest in the backend.

## Status log
- Milestone 1 (static campus): built. Building names are generic placeholders ("Tower A" etc.) until question 12.1 is answered.
- Milestone 2 (floor stack): built.
- Milestone 3 (floor layout and equipment): built on dummy readings, with the forecast chart, impact, action and cost. `score(equipment, readings, day, scenario)` lives in `web/src/model/forecast.js`; tests use `node --test` (`npm test`).
- Milestone 5 (forecast and scenarios): built client-side. `projectCampus()` in `web/src/model/project.js` re-scores the whole campus for the chosen day and scenario.
- Lifecycle forecasting (2026-10-18, user request): asset types carry design life, service interval and warning time (`web/src/data/catalogue.js`); risk gained an overdue-service term; the slider has stops Today/7d/30d/90d/1y/5y and each asset is forecast only up to its own range; slab/roof, pipework and wiring added on every floor (407 assets, above the brief's 150–300 on purpose). Demo step 4 now happens at +7 days.
- Data sources (2026-10-18, user request; the user's office has few sensors): daily sensor only for chillers, lifts, generators, UPS, fire pumps, AHUs and BMS sensors; FCUs, booster/sump pumps, DBs and lighting panels use technician readings (`dataSource: 'manual'`, weekly to quarterly); structure, pipes and wiring use inspections. Spikes only hit sensor assets. The app flags assets read less often than half their warning time.
- Dashboard and weather (2026-10-18, user request): KPI card strip above the 3D view (`KpiStrip.jsx`); simulated 14-day weather forecast (`web/src/data/weather.js`) with a "Weather" scenario that stresses assets on its heavy-rain and hot days. Scenarios are now per-day stress calendars (`SCENARIOS[..].kindOn`, `STRESS` in `forecast.js`).
- Township loop (2026-10-19, user request, for the hackathon): public realm around the buildings as a one-level "site" (`kind: 'site'`, building id `P`; streetlights, bin centres, drains, playground); simulated resident reports (`web/src/data/complaints.js`); per-township routing table (`web/src/model/routing.js`); case builder with dispatch → in progress → resolved (`web/src/model/cases.js`, Cases tab). Open reports add up to +0.2 risk; resolved cases reset the asset (`ctx.repairs`). Every asset has a `model` spec. SDP-inspired theme. 427 assets. Not built yet: replacement recommendations, real SDP app connection.
- Web app shell (2026-10-19, user request): MetroSense is an admin tool, not a resident app (residents already have the SDP app). Staff login page (`#login`, demo accounts in `web/src/data/accounts.js`, no passwords, session in sessionStorage), user menu, "My team" case filter. Guest channel `#report`: report-only form for people without the SDP app, no dashboard; reports match the nearest asset (`web/src/model/guest.js`) and join the case queue. KPI cards tinted by status, map legend, decorative scenery (`web/src/scene/Scenery.jsx`: roads, trees, car park, grey context buildings; not the real layout, not clickable). 44 tests.
- Dashboard UX pass (2026-10-19, user request): clicking an asset shows a map pop-up (`MapPopover.jsx`) with the key facts and "See details", which opens a full detail window (`Modal.jsx` + `AssetDetail.jsx`). Building/floor pop-ups hide when the map is narrower than 720 px. Side panel slimmed: equipment rows expand into a short drop-down; risk bands and asset groups are collapsed. Commercial-style login (email + password field, demo emails `*@metrosense.demo`, passwords never checked or stored, SSO and one-click demo accounts). Navy gradient header, tinted sections, risk-coloured row edges, priority-coloured case rows.
- Renamed MetroSense; forecast hold; roles; replacement; BM (2026-10-19, user request):
  - Past an asset's forecast range, a problem (≥30% at its horizon) keeps that risk (`held`, shown "≥"), so the slider never makes problems vanish; healthy ones stay "Beyond range". Tested: open and high-risk counts never fall as the slider moves out.
  - Case permissions (`canAct` in `cases.js`, `access` on accounts): manager acts on every case, including on behalf of outside parties; team staff accept/start/resolve their own team's cases only. Dispatched/in-progress repairs show a teal work badge (`withWork` in `project.js`); risk colour stays until resolved.
  - Repair-or-replace advisor (`model/replacement.js`) with energy, carbon and payback (assumed tariff RM 0.50/kWh, 0.585 kg CO₂e/kWh); on the detail window, pop-up, campus overview and Assumptions page.
  - Guest form EN/BM toggle (`data/guestText.js`). Tagline removed from the dashboard header. 55 tests.
- Maintenance log and descriptions (2026-10-19, user request): every asset's detail window has a description (`data/descriptions.js`) and a maintenance log (`model/maintenanceLog.js`) built from the same seed fields as the risk model (latest service = `lastServiceDaysAgo`, inspections = readings), plus simulated past repairs (fixed seed), reports, case history and session case updates. 59 tests.
- Critical beam (2026-10-20, user request): critical buildings, exploded floor slabs, equipment points and street assets pulse their emissive glow (`useBeam`, `PingRing`, `Beacon` in `CampusScene.jsx`); their HTML labels pulse (`.is-critical`). Other bands are unchanged. 0.8 Hz; steady glow under `prefers-reduced-motion`.
- Lights and emergency lights (2026-10-20, user request): new type `lights` (manual, monthly check, annual 3-hour test, zone "Open office") on every office floor except the roof-plant level, seeded on per-asset random streams so existing assets and demo figures are unchanged (12 open cases, 6 high risk, +4 at 7 days). 481 assets; open problems today 24. Hand-checked/inspected points are now tall square blocks. 60 tests.
- Weather widget (2026-10-21, user request): the KPI weather card is a phone-style widget (gradient by today's condition, colour icons, H/L, per-day rain bars, alert chips, "Use in forecast" pill); its own sky palette, kept out of the risk colours. Events a week or more ahead read "next Mon–Thu". Pitch deck at `pitch/MetroSense_Pitch_Deck.pptx`, following the official template's order (Title, Team information, 1 Problem … 10 Why our team should win, Thank you) plus appendix A–C; MetroSense design, no SDP logo (user decision 2026-10-21). Team details and links are placeholders.
- Guided tour (2026-10-21, user request): `Tour.jsx` (no dependency: spotlight via getBoundingClientRect, card placed beside the target, re-measured every 200 ms) with steps in `data/tourSteps.js` (role-aware case step). Opens after every sign-in unless turned off (localStorage per account); "Tutorial" header button replays it. Checked in headless Edge at 1600 px and 390 px. 62 tests.
- Milestone 7 (polish): built. Loading/fallback/empty/error states, phone layout pass, 90-second demo script in README (figures checked against the app), Data assumptions page at `#assumptions` generated from the model's constants. Not exercised in a browser: the no-WebGL fallback and the spike-exhausted message.
- Milestone 6 (live demo mode): built client-side. Spikes replace today's reading and go through the same `score()`; picks are deterministic (first press = Office Block C Lift 1). No continuous sensor simulator yet.
- Not committed: git is not installed on this machine.
- Decision (2026-10-18): stay frontend-only on dummy data for now. Milestone 4 (FastAPI + Supabase) is deferred; build forecast, scenarios and the spike button client-side, with scoring kept behind one `score(equipment, readings, day, scenario)` function so it can move to the API later.
