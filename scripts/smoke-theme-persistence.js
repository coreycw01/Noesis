async (page) => {
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local demo.');
  const open = (route) => page.goto(new URL(`/demo/${route}/`, base).href);
  const waitForMode = (dark) => page.waitForFunction(
    (expected) => document.documentElement.classList.contains('dark') === expected,
    dark,
  );
  for (const [width, mode] of [[390, 'Dark'], [1440, 'Light']]) {
    await page.setViewportSize({ width, height: 800 });
    await open('settings');
    if (width < 1280) {
      await page.getByRole('combobox', { name: 'Settings Section' }).click();
      await page.getByRole('option', { name: 'Appearance', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /^Appearance/ }).click();
    }
    const selector = page.getByRole('combobox', { name: 'Mode', exact: true });
    if ((await selector.innerText()).trim() !== mode) {
      await selector.click();
      await page.getByRole('option', { name: mode, exact: true }).click();
      await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await page.getByRole('button', { name: 'Saved', exact: true }).waitFor();
    }
    for (const [route, heading] of [['home', /^Good /], ['atlas', /Atlas/i], ['evolution', /Evolution/i]]) {
      await open(route);
      await page.locator('.noesis-app').getByRole('heading', { name: heading, level: 1 }).first().waitFor();
      await waitForMode(mode === 'Dark');
    }
  }
  return 'Dark and light appearance persisted across production demo page loads.';
}
