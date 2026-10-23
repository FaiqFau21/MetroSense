// Guided tour of the staff dashboard. Each step highlights one part of the
// screen (a CSS selector); steps without a target are centred cards. `tab`
// switches the side panel before the step so its target is on screen.
// Shown after every sign-in unless the user turns it off; the Tutorial button
// replays it any time.

export function tourSteps(user) {
  const first = user?.name?.split(' ')[0] ?? 'there';
  const engineer = user?.access === 'team';
  return [
    {
      id: 'welcome',
      title: `Welcome to MetroSense, ${first}`,
      body: 'A one-minute tour of the dashboard. You can skip it now and replay it any time from the Tutorial button.',
    },
    {
      id: 'kpis', target: '.kpi-strip', tab: 'assets',
      title: 'Key figures at a glance',
      body: 'Open cases, high-risk assets, the next predicted failure, open problems, overdue checks and the weather ahead. Click a highlighted name to jump to it.',
    },
    {
      id: 'map', target: '.viewport', tab: 'assets',
      title: 'The live map',
      body: 'Every building and street asset, coloured by its worst predicted problem. Critical items pulse red. Drag to turn the view, scroll to zoom, and click a building, floor or asset to drill down.',
    },
    {
      id: 'legend', target: '.map-legend', tab: 'assets',
      title: 'What the colours and shapes mean',
      body: 'Open the legend for the risk colours, live-sensor cylinders, hand-checked blocks, report chips and repair badges.',
    },
    {
      id: 'forecast', target: '.forecast-bar', tab: 'assets',
      title: 'Look ahead',
      body: 'Slide from today to 5 years to see how risk grows if nothing is done. Try the weather, heavy rain and heat-wave scenarios.',
    },
    {
      id: 'assets', target: '.panel-wrap', tab: 'assets',
      title: 'Buildings, floors and assets',
      body: 'The same campus as a list, highest risk first. Open any row for a short summary; "See details" shows the evidence, maintenance log and costs.',
    },
    {
      id: 'cases', target: '.panel-wrap', tab: 'cases',
      title: 'The case queue',
      body: engineer
        ? 'Reports and predicted problems become cases, routed to whoever fixes them. You see your team\'s cases first and can accept, start and resolve them; other teams\' cases are view-only.'
        : 'Reports and predicted problems become cases, routed to whoever fixes them. Dispatch, record progress and resolve; every reporter is updated at each step.',
    },
    {
      id: 'spike', target: '.tour-spike', tab: 'assets',
      title: 'Demo: simulate a sensor alarm',
      body: 'For demonstrations only. Pushes a healthy sensor past its alarm so you can watch an alert, the camera fly-in and a new case. Reset puts everything back.',
    },
    {
      id: 'help', target: '.tour-help', tab: 'assets',
      title: 'Help is always here',
      body: 'Replay this tour from the Tutorial button. "Assumptions" explains how every number is calculated, and your name opens the menu to switch theme or sign out.',
    },
    {
      id: 'done',
      title: 'You are ready',
      body: 'Start with the red items on the map or the case queue. All data in this demo is simulated.',
    },
  ];
}

// Per account: does the tour open after sign-in? (default yes)
export const tourPrefKey = (user) => `metrosense-tour-at-login-${user?.id ?? 'guest'}`;
