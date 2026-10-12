import sanitize from 'sanitize-html';

const allowedTags = [
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's',
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
      figure: ['data-noesis-chart'],
      svg: ['viewbox', 'viewBox', 'role', 'aria-label', 'width', 'height'],
      g: ['transform'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill'],
      line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width'],
      text: ['x', 'y', 'fill', 'font-size', 'font-family', 'text-anchor'],
      '*': ['data-text-align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
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
