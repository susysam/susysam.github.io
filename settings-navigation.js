const links = [...document.querySelectorAll('[data-category]')];
const sections = [...document.querySelectorAll('.settings-category')];
let pendingHash = location.hash.slice(1);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function markCurrent(id) {
  links.forEach(link => {
    if (link.dataset.category === id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function jump(id, focus = false) {
  const section = sections.find(item => item.dataset.settingsPanel === id && !item.hidden);
  if (!section) return false;
  markCurrent(id);
  if (focus) section.focus({ preventScroll: true });
  section.scrollIntoView({ block: 'start', behavior: reducedMotion.matches || !focus ? 'instant' : 'smooth' });
  return true;
}
links.forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const id = link.dataset.category;
  history.pushState(null, '', '#' + id);
  pendingHash = '';
  jump(id, true);
}));
window.addEventListener('hashchange', () => {
  pendingHash = location.hash.slice(1);
  if (jump(pendingHash)) pendingHash = '';
});
window.addEventListener('site-account-rendered', () => {
  // Account visibility follows authentication, never the selected category.
  if (pendingHash && jump(pendingHash)) pendingHash = '';
  updateCurrent();
});
function updateCurrent() {
  const visible = sections.filter(section => !section.hidden);
  const current = visible.filter(section => section.getBoundingClientRect().top <= 130).at(-1) || visible[0];
  if (current) markCurrent(current.dataset.settingsPanel);
}
let scheduled = false;
window.addEventListener('scroll', () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; updateCurrent(); });
}, { passive: true });
window.addEventListener('resize', updateCurrent);
if (pendingHash && jump(pendingHash)) pendingHash = '';
updateCurrent();
