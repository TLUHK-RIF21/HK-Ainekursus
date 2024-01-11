const tabButtons = document.querySelectorAll('.tab-btn');
const tabContent = document.querySelectorAll('.tab-pane');

tabButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    // Remove the 'active' class from all buttons and content
    tabButtons.forEach((btn) => btn.classList.remove('active'));
    tabContent.forEach((content) => content.classList.add('hidden'));

    // Add the 'active' class to the clicked button and show the corresponding
    // content
    button.classList.add('active');
    tabContent[index].classList.remove('hidden');
  });
});

// Activate the first tab by default
tabButtons[0].click();
