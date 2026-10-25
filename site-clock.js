import { DEFAULT_TIME_ZONE, TIME_ZONES, validTimeZone, formatClock } from './time-preferences.js';

const selectors = [...document.querySelectorAll('[data-timezone-select]')];
const time = document.querySelector('.time-body #time');
let zone;
function restore() {
  const saved = window.siteStorage.getItem('timeZone');
  zone = validTimeZone(saved) ? saved : DEFAULT_TIME_ZONE;
  selectors.forEach(select => {
    const choices = TIME_ZONES.some(([value]) => value === zone) ? TIME_ZONES : [...TIME_ZONES, [zone, zone]];
    select.replaceChildren(...choices.map(([value, name]) => new Option(name, value)));
    select.value = zone;
  });
  tick();
}
function tick() {
  if (!time) return;
  try {
    const current = formatClock(new Date(), zone);
    time.textContent = current.time;
    const selected = selectors[0]?.selectedOptions[0];
    if (selected) selected.textContent = (TIME_ZONES.find(([value]) => value === zone)?.[1] || zone) + ' · ' + current.abbreviation;
    document.getElementById('time-sub').textContent = (TIME_ZONES.find(([value]) => value === zone)?.[1] || zone.replaceAll('_', ' ')) + ' · ' + current.abbreviation;
  } catch {
    time.textContent = 'Clock unavailable';
    document.getElementById('time-sub').textContent = 'This browser does not support timezone formatting.';
  }
}
selectors.forEach(select => select.addEventListener('change', () => {
  if (!validTimeZone(select.value)) return;
  zone = select.value;
  const saved = window.siteStorage.setItem('timeZone', zone);
  tick();
  document.querySelectorAll('[data-timezone-feedback]').forEach(element => {
    element.textContent = saved ? 'Timezone saved on this device. Cloud saving follows your sync status.' :
      'Timezone changed for this page. Device storage is unavailable.';
  });
}));
window.addEventListener('storage', event => { if (event.key === null || event.key === 'timeZone') restore(); });
restore();
if (time) setInterval(tick, 1000);
