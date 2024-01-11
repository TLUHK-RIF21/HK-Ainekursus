function closeMenu() {
  let x = document.querySelector('.closing-menu');
  x.classList.toggle('menu-zero');
}

//function to add or togle sidebar menus
const panMainContentLeft = () => {
  const x = document.querySelector('.main-wrapper');
  const y = document.querySelector('.side-btn-wrapper');
  x.classList.toggle('left-pan');
  x.classList.remove('right-pan');

  y.classList.toggle('left-pan');
  y.classList.remove('right-pan');
};

const panMainContentRight = () => {
  const x = document.querySelector('.main-wrapper');
  const y = document.querySelector('.side-btn-wrapper');
  x.classList.remove('left-pan');
  x.classList.toggle('right-pan');

  y.classList.remove('left-pan');
  y.classList.toggle('right-pan');
};

// function to close sidebar menus, when clicked outside
/* const remMainContent = () => {
 const x = document.querySelector('.main-wrapper');
 const y = document.querySelector('.side-btn-wrapper');
 x.classList.remove('left-pan');
 x.classList.remove('right-pan');

 y.classList.remove('left-pan');
 y.classList.remove('right-pan');
 }; */

// add class on mediaquery change
const mediaQuery = window.matchMedia('(min-width: 1024px)');

function handleTabletChange(e) {
  // Check if the media query is true
  if (e.matches) {
    let x = document.querySelector('.closing-menu');
    x.classList.toggle('menu-zero');
  }
}

// scroll first horisontally then vertically, you must use it with:
// scrollToAnchor('myAnchor');
const scrollToAnchor = (anchorId) => {
  const anchorElement = document.getElementById(anchorId);
  if (anchorElement) {
    const horizontalOffset =
      anchorElement.getBoundingClientRect().left + window.scrollX;
    window.scrollTo({ top: window.scrollY, left: horizontalOffset });
    anchorElement.scrollIntoView({ behavior: 'smooth' });
  }
};

/* // Register event listener
 mediaQuery.addListener(handleTabletChange);

 // Initial check
 handleTabletChange(mediaQuery); */

// copy the anchor link into memory for coping

document.addEventListener('DOMContentLoaded', () => {
  const anchors = document.querySelectorAll('.header-anchor');

  anchors.forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      event.preventDefault();

      const href = window.location.href;
      const anchorHref = `${ href.split('#')[0] }${ anchor.getAttribute(
        'href') }`;

      copyToClipboard(anchorHref);
      alert(`Kopeerisid veebiaadressi: ${ anchorHref }`);
    });
  });
});

const copyToClipboard = (text) => {
  const dummyElement = document.createElement('textarea');
  document.body.appendChild(dummyElement);
  dummyElement.value = text;
  dummyElement.select();
  document.execCommand('copy');
  document.body.removeChild(dummyElement);
};

// radiobuttons behavior in lessons pages
function handleRadioClick(branch) {
  //  console.log('value1:', value);
  const id = document.getElementById('courseId').value;
  console.log(id, branch, window.location);
  window.location.href = `${ window.location.origin }/course/${ id }/about?ref=${ branch }`;
  //document.getElementById('selectedVersion').value = value;
  //document.getElementById('my-form').submit();
}

function handleCourseClick(team, courseSlug) {
  const formId = `overview-${ team }-${ courseSlug }`;
  // console.log('formId:', formId);
  document.getElementById(formId).submit();
  // console.log('team:', team);
  // console.log('courseSlug:', courseSlug);
  document.getElementById(`overview-${ team }-${ courseSlug }`).submit();
}


