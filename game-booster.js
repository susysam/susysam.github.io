document.addEventListener('DOMContentLoaded', function () {
    const gameBoosterToggle = document.getElementById('gameBoosterToggle');
    const gameBoosterEnabled = localStorage.getItem('gameBoosterEnabled') === 'true';

    // Apply game booster if previously enabled
    if (gameBoosterEnabled) {
        enableGameBooster();
        gameBoosterToggle.checked = true;
    }

    // Toggle game booster on change
    gameBoosterToggle.addEventListener('change', function () {
        if (this.checked) {
            enableGameBooster();
            localStorage.setItem('gameBoosterEnabled', 'true');
        } else {
            disableGameBooster();
            localStorage.setItem('gameBoosterEnabled', 'false');
        }
    });
});

function enableGameBooster() {
    // Add animation or performance optimizations
    const boosterAnimation = document.createElement('div');
    boosterAnimation.textContent = 'Boosting Game Performance...';
    boosterAnimation.style.position = 'fixed';
    boosterAnimation.style.top = '50%';
    boosterAnimation.style.left = '50%';
    boosterAnimation.style.transform = 'translate(-50%, -50%)';
    boosterAnimation.style.padding = '20px';
    boosterAnimation.style.backgroundC
