// Hide temporary direct-open links after fifteen seconds.
window.startDirectLinkCountdown = function (link, hideElement, frame) {
  if (!link || !hideElement) return;
  const timerWindow = link.ownerDocument.defaultView;
  const label = link.textContent.trim();
  const deadline = Date.now() + 15000;
  let interval;

  function stop() {
    timerWindow.clearInterval(interval);
    timerWindow.clearTimeout(timeout);
    link.removeEventListener('click', hide);
  }

  function hide() {
    stop();
    hideElement.style.display = 'none';
    if (frame) frame.style.height = '100%';
  }

  function update() {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) hide();
    else link.textContent = label + ' (' + remaining + 's)';
  }

  link.addEventListener('click', hide, { once: true });
  interval = timerWindow.setInterval(update, 250);
  const timeout = timerWindow.setTimeout(hide, 15000);
  update();
  return stop;
};
