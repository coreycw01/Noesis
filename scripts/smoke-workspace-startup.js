async (page) => {
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local production build.');
  await page.setViewportSize({ width: 390, height: 760 });
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  try {
    const throttled = base.searchParams.has('throttle');
    if (throttled) await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 200 * 1024, uploadThroughput: 90 * 1024,
    });
    const response = await page.goto(new URL('/demo/home/', base).href, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== 200) throw new Error('Today did not load.');
    await page.locator('.noesis-app').getByRole('heading', { name: /^Good /, level: 1 }).waitFor();
    return await page.evaluate(() => {
      const assets = performance.getEntriesByType('resource').filter(({ name }) => {
        const url = new URL(name);
        return url.origin === location.origin && /^(?:\/_next\/static\/|\/__probe\/)/.test(url.pathname)
          && /\.(js|css)$/.test(url.pathname);
      });
      if (!assets.length) throw new Error('No production assets measured.');
      const kib = (bytes) => Math.round(bytes / 1024);
      return {
        checkpoint: 'Today heading visible (local demo)',
        requests: assets.length,
        visibleMs: Math.round(performance.now()),
        decodedKiB: kib(assets.reduce((sum, asset) => sum + asset.decodedBodySize, 0)),
        transferredKiB: kib(assets.reduce((sum, asset) => sum + asset.transferSize, 0)),
        largest: assets.sort((a, b) => b.decodedBodySize - a.decodedBodySize).slice(0, 5)
          .map(({ name, decodedBodySize }) => ({ asset: new URL(name).pathname, decodedKiB: kib(decodedBodySize) })),
      };
    });
  } finally {
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    await client.detach();
  }
}
