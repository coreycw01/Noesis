import sanitize from 'sanitize-html';

const allowedTags = [
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'hr',
  'blockquote', 'pre', 'code',
  'ul', 'ol', 'li',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption',
  'svg', 'g', 'rect', 'line', 'text',
];

export function sanitizeHtml(value = '') {
  return sanitize(value, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      table: ['aria-label'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      figure: ['data-noesis-chart', 'data-noesis-image', 'contenteditable'],
      svg: ['viewbox', 'viewBox', 'role', 'aria-label', 'width', 'height'],
      g: ['transform'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'opacity'],
      line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width'],
      text: ['x', 'y', 'fill', 'font-size', 'font-family', 'text-anchor'],
      '*': ['data-text-align', 'style'],
    },
    // Only presentation emitted by the document ribbon may survive a save.
    // No positioning, image URLs, custom properties, or executable CSS.
    allowedStyles: {
      '*': {
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'font-style': [/^(normal|italic|oblique)$/],
        'font-family': [/^[a-zA-Z\s,'"-]+$/],
        'font-size': [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/],
        'text-decoration': [/^(none|underline|line-through)(?:\s+(?:underline|line-through))?$/],
        'text-align': [/^(left|center|right|justify)$/],
        'vertical-align': [/^(baseline|sub|super)$/],
        'line-height': [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/],
        color: [/^#[\da-fA-F]{3,8}$/, /^rgba?\([\d.,\s%]+\)$/, /^[a-zA-Z]+$/],
        'background-color': [/^#[\da-fA-F]{3,8}$/, /^rgba?\([\d.,\s%]+\)$/, /^[a-zA-Z]+$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
    },
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  });
}

export function escapeTextAsHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');
}
