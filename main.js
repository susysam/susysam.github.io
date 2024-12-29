// Button Event Listeners
document.getElementById('tabButton').addEventListener('click', function () {
  const url = document.getElementById('websiteName').value;
  if (url) {
    window.open(url, '_blank');
  } else {
    alert('Please enter a valid website URL!');
  }
});

document.getElementById('windowButton').addEventListener('click', function () {
  const url = document.getElementById('websiteName').value;
  if (url) {
    window.open(url, '_blank', 'width=800,height=600');
  } else {
    alert('Please enter a valid website URL!');
  }
});
