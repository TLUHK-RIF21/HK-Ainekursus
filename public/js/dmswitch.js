// check which theme is chosen and if it is dark then let the mode switcher
// will be selected
window.onload = function () {
  const htmlElement = document.documentElement;
  const checkboxElement = document.getElementById('switch');

  if (htmlElement.classList.contains('light-theme')) {
    checkboxElement.checked = false;
  }
};
