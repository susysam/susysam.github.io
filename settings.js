// Dark Mode Toggle
const darkModeToggle = document.getElementById('darkModeToggle');
darkModeToggle.addEventListener('change', function () {
  if (this.checked) {
    document.body.style.backgroundColor = '#333';
    document.body.style.color = '#fff';
  } else {
    document.body.style.backgroundColor = '#f8f9fa';
    document.body.style.color = '#333';
  }
});

// Game Booster Toggle (Placeholder)
const gameBoosterToggle = document.getElementById('gameBoosterToggle');
gameBoosterToggle.addEventListener('change', function () {
  if (this.checked) {
    alert('Game Booster Enabled! (Just kidding, this is a placeholder)');
  } else {
    alert('Game Booster Disabled!');
  }
});
