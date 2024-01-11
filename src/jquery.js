import jsdom from 'jsdom';
import $Factory from 'jquery';

const { JSDOM } = jsdom;
const { window } = new JSDOM();
const $ = $Factory(window);

// https://stackoverflow.com/a/52894409

// https://www.npmjs.com/package/wl-iframe-resizer?activeTab=readme
$('.markdown-iframe').load(function () {
  $(this).contents().find('body').append(
    '<script type="text/javascript" src="https://raw.githubusercontent.com/davidjbradshaw/iframe-resizer/master/js/iframeResizer.contentWindow.min.js"></script>'
  );
});

/*
 // https://www.npmjs.com/package/wl-iframe-resizer?activeTab=readme
 $('.markdown-iframe').iFrameResize({ log: true });
 */
