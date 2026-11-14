async (page) => {
  const url = 'http://127.0.0.1:9113/home/';
  if (new URL(page.url()).origin !== new URL(url).origin) throw new Error('Use the local standalone auth preview.');
  const email = `noesis-smoke-${Date.now()}@example.test`;
  const password = 'Disposable-local-test-830!';
  const created = await page.request.post('http://127.0.0.1:9198/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-emulator-only', {
    data: { email, password, returnSecureToken: true },
  });
  if (!created.ok()) throw new Error(`Auth emulator setup failed: ${created.status()}`);
  await page.goto(url);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  const workspace = page.locator('.noesis-app');
  await workspace.waitFor({ timeout: 20000 });
  await page.reload();
  await workspace.waitFor({ timeout: 20000 });
  return 'Standalone email sign-in and authenticated shell after reload passed against the local emulator.';
}
