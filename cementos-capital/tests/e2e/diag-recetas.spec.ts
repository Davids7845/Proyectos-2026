import { test } from '@playwright/test';
import { login } from './helpers/auth';

test('Inspeccionar /datos/recetas para ver qué se importó', async ({ page }) => {
  await login(page);
  await page.goto('/versiones');
  const link = page.locator('table a', { hasText: /E2E_TEST_/ }).first();
  await link.waitFor({ timeout: 10_000 });
  const href = await link.getAttribute('href');
  const versionId = href?.match(/\/versiones\/([a-f0-9-]{36})/)?.[1];
  console.log('VERSION_ID:', versionId);

  await page.goto(`/versiones/${versionId}/datos/recetas`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/diag-recetas.png', fullPage: true });

  // Volcar texto plano de toda la página
  const txt = await page.locator('main').innerText().catch(async () => await page.locator('body').innerText());
  console.log('=== /datos/recetas ===');
  console.log(txt.slice(0, 5000));
});
