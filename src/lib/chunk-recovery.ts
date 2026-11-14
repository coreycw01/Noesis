export const CHUNK_RECOVERY_SCRIPT = String.raw`
(function () {
  var key = 'noesis:chunk-recovery';
  var recovering = false;
  function isChunkFailure(value) {
    if (!value) return false;
    var text = typeof value === 'string' ? value : String(value.message || value.name || value);
    return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(text);
  }
  function isStartupScript(target) {
    if (!target || target.tagName !== 'SCRIPT' || !target.src) return false;
    var url = new URL(target.src, window.location.href);
    return url.origin === window.location.origin && /^\/_next\/static\/.*\.js$/.test(url.pathname);
  }
  function showRetry() {
    function reveal() {
      if (document.querySelector('.noesis-app')) return;
      var notice = document.getElementById('noesis-startup-retry');
      if (notice) notice.hidden = false;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', reveal, { once: true });
    } else reveal();
  }
  function recover(value, target) {
    if (recovering || document.querySelector('.noesis-app')) return;
    if (!isChunkFailure(value) && !isStartupScript(target)) return;
    if (window.navigator.onLine === false) return showRetry();
    var now = Date.now();
    try {
      var previous = Number(window.sessionStorage.getItem(key));
      if (Number.isFinite(previous) && previous > 0 && now - previous < 30000) return showRetry();
      window.sessionStorage.setItem(key, String(now));
    } catch {
      return showRetry();
    }
    recovering = true;
    window.location.reload();
  }
  window.addEventListener('error', function (event) { recover(event.error || event.message, event.target); }, true);
  window.addEventListener('unhandledrejection', function (event) { recover(event.reason); });
})();
`.trim();
