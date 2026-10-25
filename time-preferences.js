export const DEFAULT_TIME_ZONE = 'America/New_York';
export const TIME_ZONES = Object.freeze([
  ['America/New_York', 'Eastern Time (EST)'], ['America/Chicago', 'Central Time (CST)'],
  ['America/Denver', 'Mountain Time (MST)'], ['America/Los_Angeles', 'Pacific Time (PST)'],
  ['UTC', 'UTC'], ['Europe/London', 'London (GMT)'], ['Europe/Paris', 'Paris (CET)'],
  ['Asia/Kolkata', 'India (IST)'], ['Asia/Tokyo', 'Tokyo (JST)'], ['Australia/Sydney', 'Sydney (AEST)']
]);
export function validTimeZone(value) {
  if (typeof value !== 'string' || !value || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
  catch { return false; }
}
export function formatClock(date, timeZone) {
  const zone = validTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  }).format(date);
  const abbreviation = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, timeZoneName: 'short'
  }).formatToParts(date).find(part => part.type === 'timeZoneName').value;
  return { time, abbreviation };
}
