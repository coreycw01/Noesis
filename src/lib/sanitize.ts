const blockedBlocks = /<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi;
const blockedTags = /<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)[^>]*>/gi;
const eventHandlers = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const dangerousUrls = /\s+(href|src|xlink:href)\s*=\s*("|')?\s*(javascript:|data:text\/html|vbscript:)[^"'\s>]*/gi;
const styleAttributes = /\s+style\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;

export function sanitizeHtml(value = '') {
  return value
    .replace(blockedBlocks, '')
    .replace(blockedTags, '')
    .replace(eventHandlers, '')
    .replace(dangerousUrls, '')
    .replace(styleAttributes, '');
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
