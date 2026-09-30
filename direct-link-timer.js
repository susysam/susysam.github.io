// Provide a direct-open link that stays on screen permanently.
window.startDirectLinkCountdown = function (link, hideElement, frame) {
  if (!link || !hideElement) return;
  
  const label = link.dataset.directLinkLabel || link.textContent.trim();
  link.dataset.directLinkLabel = label;
  link.textContent = label; // Just keep the label as is

  function hide() {
    link.removeEventListener('click', hide);
    hideElement.style.display = 'none';
    if (frame) frame.style.height = '100%';
  }

  link.addEventListener('click', hide, { once: true });
  
  // Return an empty stop function since there is no timer to stop anymore
  return function stop() {
    link.removeEventListener('click', hide);
  };
};
