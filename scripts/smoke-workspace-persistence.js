async (page) => {
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local demo.');
  page.setDefaultTimeout(8000);
  const open = (path) => page.goto(new URL(`/demo/${path}/`, base).href);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const waitForValue = async (field, value) => {
    await field.waitFor();
    if (await field.inputValue() !== value) throw new Error(`Saved value missing: ${value}`);
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const inquiry = 'inquiries/q_comfort_growth';
    const work = 'works/d_agency_notes';
    const marker = `Local release check ${width}`;
    await open(inquiry);
    await button('Frame').click();
    const stakes = page.getByLabel('Why does this matter?', { exact: true });
    await stakes.fill(marker);
    await button('Save Context').click();
    await button('Save Context').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Save Context' && b.disabled));
    await open(inquiry);
    await button('Frame').click();
    await waitForValue(stakes, marker);
    await open(work);
    const title = page.getByLabel('Work title', { exact: true });
    await title.fill(marker);
    await page.getByRole('button', { name: /^Save work/ }).click();
    await page.getByRole('button', { name: 'Save work', exact: true }).waitFor();
    await open(work);
    await waitForValue(title, marker);
    const body = page.getByRole('textbox', { name: 'Document body', exact: true }).first();
    const bodyMarker = `Autosaved body ${width}`;
    await body.fill(bodyMarker);
    await page.getByRole('button', { name: 'Save work', exact: true }).waitFor();
    await open(work);
    await body.getByText(bodyMarker, { exact: true }).or(body.filter({ hasText: bodyMarker })).first().waitFor();
    await button('More work actions').click();
    await page.getByRole('menuitem', { name: 'Delete work', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Work', exact: true }).click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/demo/works');
    await open('settings');
    if (width < 1280) {
      await page.getByRole('combobox', { name: 'Settings Section' }).click();
      await page.getByRole('option', { name: 'Data', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /^Data / }).click();
    }
    await button(`Restore ${marker}`).click();
    await button(`Restore ${marker}`).waitFor({ state: 'hidden' });
    await open(work);
    await waitForValue(title, marker);
    await body.filter({ hasText: bodyMarker }).waitFor();
  }
  return 'Inquiry save, Work save, and Work recovery passed at both widths.';
}
