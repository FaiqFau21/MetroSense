// Simulated resident and tenant reports for the demo. In a pilot these would
// arrive from the SDP resident app, WhatsApp, the hotline and email. They are
// anonymised (no names, phone numbers or unit numbers) as PDPA requires.
//
// Each report is already matched to an asset where possible (assetId); reports
// about things that aren't in the asset register carry a place and category
// instead and are routed on those.

export const CHANNELS = {
  app: 'SDP resident app',
  whatsapp: 'WhatsApp',
  hotline: 'Hotline',
  email: 'Email',
  web: 'MetroSense guest form',
};

// The demo's "now": 10:00 on DEMO_TODAY.
export const NOW_HOUR = 10;

export const COMPLAINTS = [
  {
    id: 'R-2041', channel: 'app', daysAgo: 2, time: '21:40', reporter: 'Resident',
    text: "The streetlight on the main boulevard near the cross walkway keeps flickering. It's very dark walking back from the bus stop.",
    photo: 'streetlight', assetId: 'P-L1-streetlight-4',
  },
  {
    id: 'R-2043', channel: 'whatsapp', daysAgo: 1, time: '07:15', reporter: 'Resident',
    text: 'Lampu jalan dekat simpang boulevard berkelip-kelip, gelap waktu malam.',
    translation: 'The streetlight near the boulevard junction keeps flickering; it is dark at night.',
    photo: null, assetId: 'P-L1-streetlight-4',
  },
  {
    id: 'R-2044', channel: 'app', daysAgo: 1, time: '08:30', reporter: 'Resident',
    text: 'The bin centre beside Tower B is overflowing again. It smells and crows are scattering the rubbish.',
    photo: 'bins', assetId: 'P-L1-waste_point-2',
  },
  {
    id: 'R-2045', channel: 'hotline', daysAgo: 0, time: '08:05', reporter: 'Resident',
    text: 'The drain along the south walkway is full of mud and leaves. Water pooled on the path after the last rain.',
    photo: 'drain', assetId: 'P-L1-drain-2',
  },
  {
    id: 'R-2046', channel: 'app', daysAgo: 3, time: '18:20', reporter: 'Resident (parent)',
    text: 'One of the swing chains at the pocket park is loose and the rubber mat is torn. My son nearly tripped.',
    photo: 'playground', assetId: 'P-L1-playground-1',
  },
  {
    id: 'R-2047', channel: 'email', daysAgo: 0, time: '09:10', reporter: 'Tenant, Tower A Level 14',
    text: "Level 14 has been very warm since this morning. The aircond doesn't seem to be cooling.",
    photo: null, assetId: 'A-L14-ahu-1',
  },
  {
    id: 'R-2048', channel: 'app', daysAgo: 0, time: '09:40', reporter: 'Tenant, Tower A Level 9',
    text: 'The water dispenser in the Level 9 pantry is leaking onto the floor.',
    photo: 'dispenser', assetId: null,
    place: 'Tower A, Level 9 pantry', category: 'Pantry appliance', item: 'Water dispenser (rental unit)',
    title: 'Water dispenser leaking',
  },
  {
    id: 'R-2049', channel: 'app', daysAgo: 4, time: '12:15', reporter: 'Tenant, Tower A',
    text: 'Lift 2 in Tower A: the doors keep reopening and we wait a long time for it.',
    photo: null, assetId: 'A-L22-lift-2',
  },
  {
    id: 'R-2038', channel: 'hotline', daysAgo: 6, time: '20:05', reporter: 'Resident',
    text: 'The streetlight on the west walkway near Tower A is completely out.',
    photo: null, assetId: 'P-L1-streetlight-9',
  },
];

// Cases already in progress or closed before today, keyed by asset id (or place).
export const CASE_HISTORY = {
  'P-L1-playground-1': [
    { daysAgo: 3, time: '19:00', status: 'Dispatched' },
    { daysAgo: 2, time: '10:30', status: 'In progress', note: 'Playground cordoned off; parts ordered' },
  ],
  'A-L22-lift-2': [{ daysAgo: 3, time: '09:00', status: 'Dispatched' }],
  'P-L1-streetlight-9': [
    { daysAgo: 6, time: '21:00', status: 'Dispatched' },
    { daysAgo: 4, time: '22:10', status: 'Resolved', note: 'LED module replaced' },
  ],
};
