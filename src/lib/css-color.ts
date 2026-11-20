/**
 * Read a design token as a colour a canvas or SVG attribute can use.
 * Tokens hold HSL triplets, so `cssColor('--caution')` gives `hsl(44 80% 38%)`
 * and follows the theme, light or dark. Falls back to the given colour when
 * there is no document (server render) or the token is missing.
 */
export function cssColor(token: string, alpha = 1, fallback = 'transparent') {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!value) return fallback;
  return alpha >= 1 ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
}
