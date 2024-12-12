// Dark Mode Script
document.addEventListener('DOMContentLoaded', function () {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeEnabled = localStorage.getItem('darkModeEnabled') === 'true';

    // Apply dark mode if previously enabled
    if (darkModeEnabled) {
        enableDarkMode();
        darkModeToggle.checked = true;
    }

    // Toggle dark mode on change
    darkModeToggle.addEventListener('change', function () {
        if (this.checked) {
            enableDarkMode();
            localStorage.setItem('darkModeEnabled', 'true');
        } else {
            disableDarkMode();
            localStorage.setItem('darkModeEnabled', 'false');
        }
    });
});

function enableDarkMode() {
    document.body.style.backgroundColor = '#121212'; // Dark background
    document.body.style.color = '#ffffff'; // Light text
    // Add any other dark mode styling here
}

function disableDarkMode() {
    document.body.style.backgroundColor = '#f0f0f0'; // Light background
    document.body.style.color = '#333'; // Dark text
    // Revert any other dark mode styling here
}
