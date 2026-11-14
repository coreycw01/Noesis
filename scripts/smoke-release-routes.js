async (page) => {
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local production build.');
  const routes = {
    home: /^Good /, atlas: /Atlas/i, evolution: /Evolution/i, goals: /Praxis/i,
    profile: /Profile/i, settings: /Settings/i, 'context-desk': /Context Desk/i,
    library: /Library/i, works: /Works/i, concepts: /Concepts/i,
    inquiries: /Inquiries/i, positions: /Positions/i, labs: /Praxis/i,
  };
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const [route, name] of Object.entries(routes)) {
        const response = await page.goto(new URL(`/demo/${route}/`, base).href);
        if (response?.status() !== 200) throw new Error(`${route}: HTTP ${response?.status()}`);
        await page.locator('.noesis-app').getByRole('heading', { name, level: 1 }).first().waitFor({ timeout: 10000 });
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
          throw new Error(`${route}: page overflow at ${width}px`);
        }
      }
    }
    if (errors.length) throw new Error(errors.join('; '));
    return '26 production route checks passed.';
  } finally {
    page.off('pageerror', onError);
  }
}
