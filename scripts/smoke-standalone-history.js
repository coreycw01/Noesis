async (page) => {
  const base = new URL(page.url());
  if (base.origin !== 'http://127.0.0.1:9113') throw new Error('Use the local standalone demo.');
  await page.goto(new URL('/demo/inquiries/q_comfort_growth/', base).href);
  await page.getByRole('button', { name: 'Frame', exact: true }).waitFor();
  await page.goto(new URL('/demo/home/', base).href);
  const exercise = page.getByRole('button', { name: 'Open exercises', exact: true });
  await exercise.click();
  const tab = page.getByRole('tab', { name: 'Exercises', exact: true });
  await tab.waitFor();
  await page.goBack();
  await exercise.waitFor();
  await page.goForward();
  await tab.waitFor();
  await page.reload();
  await tab.waitFor();
  return 'Standalone inquiry deep link and Praxis Back, Forward, and reload passed.';
}
