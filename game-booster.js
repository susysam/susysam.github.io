// Game Booster Script
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
    // Show animation
    const boosterAnimation = document.createElement('div');
    boosterAnimation.textContent = 'Boosting Game Performance...';
    boosterAnimation.style.position = 'fixed';
    boosterAnimation.style.top = '50%';
    boosterAnimation.style.left = '50%';
    boosterAnimation.style.transform = 'translate(-50%, -50%)';
    boosterAnimation.style.padding = '20px';
    boosterAnimation.style.backgroundColor = '#4CAF50';
    boosterAnimation.style.color = '#fff';
    boosterAnimation.style.borderRadius = '10px';
    boosterAnimation.style.zIndex = '9999';
    document.body.appendChild(boosterAnimation);

    setTimeout(() => {
        boosterAnimation.remove();
        console.log('Game Booster Enabled');
    }, 2000);

    // Add performance optimizations here
    document.body.style.transition = 'all 0.5s ease';
}

function disableGameBooster() {
    console.log('Game Booster Disabled');
    // Revert performance optimizations here
    document.body.style.transition = '';
}
