async (page) => {
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local Noesis demo.');
  await page.setViewportSize({ width: 390, height: 520 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const open = (route) => page.goto(new URL(`/demo/${route}/`, base).href);
  const button = (name) => page.getByRole('button', { name, exact: true });

  await open('atlas');
  await button('Map options').click();
  await page.getByRole('menuitemcheckbox', { name: 'Custom map', exact: true }).click();
  await button('Map Style').click();
  const dialog = page.getByRole('dialog', { name: 'Customize Map' });
  const blur = dialog.getByRole('slider', { name: 'Background blur' });
  await blur.press('Home');
  await blur.press('ArrowRight');
  if (await blur.getAttribute('aria-valuenow') !== '1') throw new Error('Atlas blur did not respond to the keyboard.');
  await dialog.getByRole('slider', { name: 'Background opacity' }).waitFor();
  await dialog.getByRole('switch', { name: 'Show weak links' }).waitFor();
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () =>
    (await window.axe.run('[role=dialog]')).violations.map(({ id }) => id));
  if (violations.length) throw new Error(`Atlas dialog accessibility: ${violations.join(', ')}`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });

  await open('evolution');
  await page.getByLabel('Evolution period start').fill('2026-11-14');
  await page.getByLabel('Evolution period end').fill('2026-11-13');
  await page.getByRole('alert').filter({ hasText: 'The end date must be on or after the start date.' }).waitFor();

  await open('settings');
  await page.getByRole('combobox', { name: 'Settings Section' }).click();
  await page.getByRole('option', { name: 'Appearance', exact: true }).click();
  const contrast = page.getByRole('switch', { name: 'High contrast mode' });
  const before = await contrast.getAttribute('aria-checked');
  await contrast.press('Space');
  if (await contrast.getAttribute('aria-checked') === before) throw new Error('High contrast did not toggle.');
  await page.getByRole('switch', { name: 'Reduced motion' }).waitFor();
  await open('inquiries/q_comfort_growth');
  await button('Investigate').click();
  await page.getByRole('button', { name: /^Test in practice/ }).click();
  await page.getByText('Optional test details', { exact: true }).click();
  for (const name of ['Practice name', 'When will you review it?', 'What would you expect to see?', 'Result, if already known']) {
    await page.getByRole('textbox', { name, exact: true }).waitFor();
  }
  return 'Atlas, Evolution, Settings and Inquiry accessibility smoke passed.';
}
