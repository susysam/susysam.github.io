// Provide a direct-open link that automatically disappears after 7 seconds.
window.startDirectLinkCountdown = function (link, hideElement, frame, seconds = 7) {
  if (!link || !hideElement) return function () {};

  const baseLabel = link.dataset.directLinkLabel || link.textContent.trim();
  link.dataset.directLinkLabel = baseLabel;

  let remaining = seconds;
  link.textContent = `${baseLabel} (${remaining}s)`;

  let timer = null;

  function hide() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    link.removeEventListener('click', hide);
    hideElement.style.display = 'none';
    if (frame) frame.style.height = '100%';
  }

  link.addEventListener('click', hide, { once: true });

  timer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      hide();
    } else {
      link.textContent = `${baseLabel} (${remaining}s)`;
    }
  }, 1000);

  return function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    link.removeEventListener('click', hide);
  };
};
