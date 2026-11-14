async (page) => {
  const base = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use a local Noesis demo.');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 760 });
    await page.goto(new URL('/demo/home/', base).href);
    await page.getByRole('button', { name: 'Open exercises' }).click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/demo/labs');
    await page.getByRole('tab', { name: 'Exercises' }).click();
    await page.getByText('Daily Thought', { exact: true }).first().waitFor();
  }
  return 'Today exercise navigation passed at 390px and 1440px.';
}
