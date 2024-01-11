import mila from 'markdown-it-link-attributes';
import blockEmbedPlugin from 'markdown-it-block-embed';
import playgroundPlugin from 'markdown-it-playground';
import hljs from 'highlight.js';
import iframe from 'markdown-it-iframe';
import markdownImagination from 'markdown-it-imagination';
import MarkdownIt from 'markdown-it';

// Enable markdown file parser
// https://github.com/markdown-it/markdown-it

// Add anchors to Markdown headings
// https://github.com/valeriangalliat/markdown-it-anchor
import anchor from 'markdown-it-anchor';

// Add anchors' table of contents for right sidebar
// https://www.npmjs.com/package/markdown-it-toc-done-right
import anchorToc from 'markdown-it-toc-done-right';

//  Add certain classes to selected elements in markdown files, needed for CSS
// https://github.com/HiroshiOkada/markdown-it-class
import markdownItClass from '@toycode/markdown-it-class';

const markdown = new MarkdownIt({
  html: true, // Enable HTML tags in source
  xhtmlOut: true, // Use '/' to close single tags (<br />).
  linkify: true, // Autoconvert URL-like text to links
  typographer: true, // Enable some language-neutral replacement + quotes
  // beautification.e
  // https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.js

  // Enable syntax hightlighting:
  // https://github.com/markdown-it/markdown-it#syntax-highlighting
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="markdown-pre"><code>${ hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true
        }).value }</code></pre>`;
      } catch (__) {
        // do nothing here
      }
    }

    return `<pre class="markdown-pre"><code>${ markdown.utils.escapeHtml(
      str
    ) }</code></pre>`;
  }
}).enable('image');

const mapContent = {
  ol: 'markdown',
  ul: 'markdown',
  a: 'markdown',
  h1: 'markdown-wrapper',
  h2: 'markdown-wrapper',
  h3: 'markdown-wrapper',
  h4: 'markdown-wrapper',
  iframe: 'markdown-iframe',
  img: 'markdown-iframe'
};
markdown.use(markdownItClass, mapContent);

// Add attributes to href links in markdown file
// https://www.npmjs.com/package/markdown-it-link-attributes
markdown.use(mila, {
  // Don't add attributes to links that start with '#', e.g. anchor links:
  // https://www.npmjs.com/package/markdown-it-link-attributes
  matcher(href) {
    return !href.startsWith('#');
  },
  attrs: {
    target: '_blank',
    rel: 'noopener'
  }
});

// Add anchor links to headings in markdown file
// https://github.com/valeriangalliat/markdown-it-anchor
markdown.use(anchor, {
  permalink: true,
  permalinkSymbol: '<span class="material-symbols-outlined" style="0.75em">share</span>'
});

// Add anchors' table of contents for right sidebar
// https://www.npmjs.com/package/markdown-it-toc-done-right
markdown.use(anchorToc, {
  containerClass: 'table-of-contents-from-markdown-123',
  listClass: 'table-of-contents',
  listType: 'ul',
  itemClass: 'table-of-contents',
  linkClass: 'table-of-contents',
  level: 1
});

// Add embed video support
// https://github.com/rotorz/markdown-it-block-embed
markdown.use(blockEmbedPlugin, {
  containerClassName: 'video-embed'
  /* services: {
   sisuloome: {
   width: 600,
   height: 600,
   },
   }, */
});

// Enable embedded code demo environments like JSFiddle and CodePen
// https://www.npmjs.com/package/markdown-it-playground
markdown.use(playgroundPlugin, {
  allowFullScreen: true
});

// Enable embedded iframes
// https://github.com/rjriel/markdown-it-iframe
markdown.use(iframe, {
  allowfullscreen: false,
  frameborder: 0, // default: 0
  renderIframe: true, // default: true
  width: '100%',
  height: '500px'
});

// Specify image rendering
// https://www.npmjs.com/package/markdown-it-imagination
markdown.use(markdownImagination, {
  lazy: true
});

export default markdown;
