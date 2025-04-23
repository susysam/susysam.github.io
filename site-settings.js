// site-settings.js

// Apply Dark Mode on Page Load
document.addEventListener('DOMContentLoaded', () => {
  const isDarkMode = localStorage.getItem('theme') === 'dark';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  }
  // Sync dark mode toggle switch
  document.getElementById('darkModeToggle').checked = isDarkMode;
});

// Dark Mode Toggle
document.getElementById('darkModeToggle').addEventListener('change', function () {
  if (this.checked) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('theme', 'light');
  }
});

// Go to Home Button
document.getElementById('homeButton').addEventListener('click', function () {
  window.location.href = 'index.html'; // Update to correct home page
});

// Open in New Tab
document.getElementById('tabButton').addEventListener('click', function () {
  const url = prompt('Enter a website URL to open:');
  if (url) {
    window.open(url, '_blank');
  } else {
    alert('Please enter a valid URL!');
  }
});

// Open in New Window
document.getElementById('windowButton').addEventListener('click', function () {
  const url = prompt('Enter a website URL to open:');
  if (url) {
    window.open(url, '_blank', 'width=800,height=600');
  } else {
    alert('Please enter a valid URL!');
  }
});
