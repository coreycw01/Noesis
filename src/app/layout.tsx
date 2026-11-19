import type { Metadata } from 'next';
import { CHUNK_RECOVERY_SCRIPT } from '@/lib/chunk-recovery';
import './reset.css';
import './theme.css';

const workspaceFontStylesheet = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';

export const metadata: Metadata = {
  title: 'Noesis - Turn thought into understanding',
  description: 'A personal philosophy workspace for mapping concepts, examining positions, building works, and testing practices.',
  applicationName: 'Noesis',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Noesis',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: { url: '/icon.png', sizes: '48x48', type: 'image/png' },
    apple: { url: '/noesis-install-icon.png', sizes: '512x512', type: 'image/png' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `
try {
  var saved = JSON.parse(localStorage.getItem('noesis:theme') || '{}');
  var mode = saved.themeMode || 'light';
  var accent = saved.accentTheme || 'violet';
  var headerFont = saved.headerFont || 'editorial';
  var fontSize = saved.fontSize || 'md';
  var interfaceShape = saved.interfaceShape || 'pills';
  var collectionView = saved.defaultCollectionView || 'cards';
  var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('high-contrast', Boolean(saved.highContrastMode));
  document.documentElement.classList.toggle('reduce-motion', Boolean(saved.reducedMotion));
  document.documentElement.setAttribute('data-theme', accent);
  document.documentElement.setAttribute('data-header-font', headerFont);
  document.documentElement.setAttribute('data-font-size', fontSize);
  document.documentElement.setAttribute('data-interface-shape', interfaceShape);
  document.documentElement.setAttribute('data-collection-view', collectionView);
  var stageColors = saved.stageColors || {};
  Object.keys(stageColors).forEach(function (key) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(stageColors[key] || ''));
    if (!m) return;
    var n = parseInt(m[1], 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min, h = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    var v = Math.round(h) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%';
    document.documentElement.style.setProperty('--stage-' + key, v);
    document.documentElement.style.setProperty('--sidebar-stage-' + key, v);
  });
} catch (error) {
  console.warn('Theme init failed', error);
}
            `.trim(),
          }}
        />
        <script
          id="chunk-recovery"
          dangerouslySetInnerHTML={{
            __html: CHUNK_RECOVERY_SCRIPT,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          id="load-workspace-fonts"
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var style = document.createElement('link');
  style.rel = 'stylesheet';
  style.media = 'print';
  style.addEventListener('load', function () { style.media = 'all'; }, { once: true });
  style.href = ${JSON.stringify(workspaceFontStylesheet)};
  document.head.appendChild(style);
})();`,
          }}
        />
        <noscript><link href={workspaceFontStylesheet} rel="stylesheet" /></noscript>
      </head>
      <body>
        {children}
        <aside id="noesis-startup-retry" hidden suppressHydrationWarning role="alert">
          <p>Noesis could not finish loading.</p>
          <p>Check your connection and reload this page.</p>
        </aside>
      </body>
    </html>
  );
}
