import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

// Use the existing tsx toolchain for this experiment, not a production dependency.
const requireFromTsx = createRequire(require.resolve('tsx/package.json'));
const { build } = requireFromTsx('esbuild') as typeof import('esbuild');

async function measure() {
  const serve = process.argv.includes('--serve');
  const authPreview = serve && process.argv.includes('--local-auth');
  const workspace = serve || process.argv.includes('--workspace');
  const init = workspace ? `
    import { NoesisPersistentWorkspace } from './src/app/(workspace)/noesis-persistent-workspace';
    ${serve ? `
    import './src/app/reset.css';
    import './src/app/theme.css';
    import './src/app/(workspace)/startup.css';
    ${authPreview ? '' : "sessionStorage.setItem('noesis:open-local-demo', 'true');"}
    const push = history.pushState.bind(history);
    history.pushState = (...args) => {
      push(...args);
      window.dispatchEvent(new Event('noesis:probe-navigation'));
    };
    ` : ''}
    createRoot(document.getElementById('root')).render(createElement(NoesisPersistentWorkspace));
  ` : `
    function subscribe(callback) {
      window.addEventListener('popstate', callback);
      return () => window.removeEventListener('popstate', callback);
    }
    function Probe() {
      const pathname = useSyncExternalStore(subscribe, () => location.pathname);
      return createElement('main', null, parseNoesisRoute(pathname).view);
    }
    createRoot(document.body).render(createElement(Probe));
  `;
  const result = await build({
    stdin: {
      contents: `
        import { createElement, useSyncExternalStore } from 'react';
        import { createRoot } from 'react-dom/client';
        import { parseNoesisRoute } from './src/lib/noesis-routes';
        ${init}
      `,
      resolveDir: process.cwd(),
      loader: 'js',
    },
    bundle: true,
    minify: true,
    platform: 'browser',
    target: 'es2020',
    define: {
      'process.env.NODE_ENV': '"production"',
      ...(serve && Object.fromEntries([
        'ALLOW_PROTOTYPE_MODE', 'FIREBASE_API_KEY', 'FIREBASE_APP_ID', 'FIREBASE_APPCHECK_DEBUG_TOKEN',
        'FIREBASE_APPCHECK_SITE_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_MESSAGING_SENDER_ID',
        'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'NOESIS_LOCAL_EMULATORS',
      ].map((key) => {
        const localConfig: Record<string, string> = {
          FIREBASE_API_KEY: 'local-emulator-only', FIREBASE_APP_ID: '1:1:web:local',
          FIREBASE_AUTH_DOMAIN: 'demo-noesis-rules.firebaseapp.com', FIREBASE_PROJECT_ID: 'demo-noesis-rules',
          FIREBASE_STORAGE_BUCKET: 'demo-noesis-rules.appspot.com', FIREBASE_MESSAGING_SENDER_ID: '1',
        };
        return [`process.env.NEXT_PUBLIC_${key}`, authPreview && localConfig[key]
          ? JSON.stringify(localConfig[key]) : 'undefined'];
      }))),
    },
    ...(workspace && {
      jsx: 'automatic' as const,
      format: 'esm' as const,
      splitting: true,
      metafile: true,
      outdir: path.join(tmpdir(), 'noesis-runtime-probe'),
      entryNames: 'workspace',
      plugins: [{
        name: 'standalone-estimate',
        setup(builder) {
          if (authPreview) {
            builder.onResolve({ filter: /\/local-emulators$/ }, () => ({ path: 'local-emulators', namespace: 'probe' }));
          }
          builder.onResolve({ filter: /^next\/(navigation|image|link|dynamic)$/ }, ({ path: id }) => ({ path: id, namespace: 'probe' }));
          builder.onLoad({ filter: /.*/, namespace: 'probe' }, ({ path: id }) => {
            const adapters: Record<string, string> = {
              'local-emulators': 'export const useLocalFirebaseEmulators = true;',
              'next/navigation': `
                import { useSyncExternalStore } from 'react';
                const subscribe = (fn) => {
                  window.addEventListener('popstate', fn);
                  window.addEventListener('noesis:probe-navigation', fn);
                  return () => {
                    window.removeEventListener('popstate', fn);
                    window.removeEventListener('noesis:probe-navigation', fn);
                  };
                };
                export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
                export const useRouter = () => ({ push: (url) => history.pushState(null, '', url) });
              `,
              'next/link': "import { createElement } from 'react'; export default (props) => createElement('a', props);",
              'next/image': "import { createElement } from 'react'; export default (props) => createElement('img', props);",
              'next/dynamic': `
                import { createElement, lazy, Suspense } from 'react';
                export default function dynamic(load, options) {
                  const Component = lazy(async () => {
                    const mod = await load();
                    return typeof mod === 'function' ? { default: mod } : mod;
                  });
                  return (props) => createElement(Suspense, {
                    fallback: options?.loading ? createElement(options.loading) : null,
                  }, createElement(Component, props));
                }
              `,
            };
            return { contents: adapters[id], loader: 'js', resolveDir: process.cwd() };
          });
          if (serve) builder.onLoad({ filter: /\.css$/ }, async ({ path: file }) => {
            const css = await postcss([tailwind()]).process(await readFile(file, 'utf8'), { from: file });
            // Keep stylesheet loading at the same import boundary as its component.
            return { contents: `
              const style = document.createElement('style');
              style.textContent = ${JSON.stringify(css.css)};
              document.head.appendChild(style);
            `, loader: 'js' };
          });
        },
      }],
    }),
    write: false,
  });
  const entry = workspace
    ? result.outputFiles.find((file) => path.basename(file.path) === 'workspace.js')
    : result.outputFiles[0];
  if (!entry) throw new Error('Probe entry was not emitted.');
  const bytes = entry.contents;
  const outputs = result.metafile?.outputs ?? {};
  const seen = new Set<string>();
  function startupBytes(file: string): number {
    if (seen.has(file) || !outputs[file]) return 0;
    seen.add(file);
    return outputs[file].bytes + outputs[file].imports
      .filter((dependency) => dependency.kind === 'import-statement')
      .reduce((sum, dependency) => sum + startupBytes(dependency.path), 0);
  }
  const startup = Object.keys(outputs).find((file) => path.basename(file) === 'workspace.js');
  console.log(JSON.stringify({
    scope: serve ? 'Standalone demo with compiled styles in JS' : workspace ? 'Real workspace graph, sizing only: excludes CSS processing and browser verification' : 'React, React DOM, history subscription and Noesis route parsing only',
    rawKiB: Math.round(bytes.length / 1024),
    gzipKiB: Math.round(gzipSync(bytes).length / 1024),
    ...(startup && { initialJsKiB: Math.round(startupBytes(startup) / 1024) }),
  }));
  if (serve) {
    const files = new Map(result.outputFiles.map((file) => [`/__probe/${path.basename(file.path)}`, {
      raw: file.contents, gzip: gzipSync(file.contents),
    }]));
    const icon = await readFile('public/noesis-brand-mark.webp');
    createServer((request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const asset = files.get(pathname);
      if (asset) {
        const compressed = /\bgzip\b/.test(String(request.headers['accept-encoding'] ?? ''));
        response.writeHead(200, {
          'Content-Type': 'text/javascript', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding',
          ...(compressed && { 'Content-Encoding': 'gzip' }),
        });
        response.end(compressed ? asset.gzip : asset.raw);
      } else if (pathname === '/noesis-brand-mark.webp') {
        response.writeHead(200, { 'Content-Type': 'image/webp' });
        response.end(icon);
      } else if (/^\/demo(?:\/[^.?#]*)?$/.test(pathname) || (authPreview && /^\/home\/?$/.test(pathname))) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/noesis-brand-mark.webp"><title>Noesis standalone demo</title><div id="root"></div><script type="module" src="/__probe/workspace.js"></script></html>');
      } else {
        response.writeHead(pathname === '/' ? 302 : 404, pathname === '/' ? { Location: '/demo/home/' } : {});
        response.end();
      }
    }).listen(9113, '127.0.0.1', () => console.log('Standalone demo: http://127.0.0.1:9113/demo/home/'));
  }
}

void measure().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
