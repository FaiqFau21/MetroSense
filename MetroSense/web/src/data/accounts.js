// Demo sign-in and guest reporting setup. MetroSense is a staff tool; residents
// keep using the SDP app. Guests (people without the SDP app) can only submit a
// report: no dashboard, no tracking.

// Fictional demo staff accounts. Passwords are not checked or stored: in a pilot,
// staff would sign in with their SDP staff account (single sign-on).
export const STAFF_ACCOUNTS = [
  {
    id: 'tm', name: 'Nurul Huda', initials: 'NH', role: 'Township manager', team: 'sdp_township',
    email: 'nurul.huda@metrosense.demo', access: 'all',
    note: 'Sees every case, dispatches it, and can record progress for any party',
  },
  {
    id: 'fe', name: 'Daniel Lee', initials: 'DL', role: 'Facilities engineer', team: 'sdp_facilities',
    email: 'daniel.lee@metrosense.demo', access: 'team',
    note: 'Accepts, starts and resolves the facilities team’s cases; other cases are view-only',
    caseFilter: 'mine',
  },
];

// What a guest can report. Street categories are matched to the nearest asset
// of that type around where they tap on the map.
export const GUEST_CATEGORIES = [
  { key: 'streetlight', label: 'Streetlight out or flickering', types: ['streetlight'] },
  { key: 'drain', label: 'Blocked drain or flooding', types: ['drain'] },
  { key: 'rubbish', label: 'Rubbish or overflowing bins', types: ['waste_point'] },
  { key: 'playground', label: 'Damaged playground equipment', types: ['playground'] },
  { key: 'building', label: 'Problem inside a building (aircond, lift, leak)', types: [], category: 'Building problem' },
  { key: 'other', label: 'Something else', types: [], category: 'Other' },
];

export const GUEST_ROLES = ['Visitor', 'Tenant or office worker', 'Resident without the SDP app', 'Contractor on site', 'Other'];
