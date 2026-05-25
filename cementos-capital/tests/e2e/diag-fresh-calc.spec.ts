import { test } from '@playwright/test';
import { login } from './helpers/auth';

test('Re-ejecutar cálculo sobre versión actual y ver omitidos', async ({ page }) => {
  await login(page);
  await page.goto('/versiones');
  const link = page.locator('table a', { hasText: /E2E_TEST_/ }).first();
  await link.waitFor({ timeout: 10_000 });
  const href = await link.getAttribute('href');
  const versionId = href?.match(/\/versiones\/([a-f0-9-]{36})/)?.[1];
  console.log('VERSION:', versionId);

  // Re-ejecutar cálculo
  await page.goto(`/versiones/${versionId}/calcular`);
  await page.getByRole('button', { name: /ejecutar cálculo/i }).click();
  // Esperar a que finalice
  await page.waitForResponse(r => r.url().includes('/calcular') && r.request().method() === 'POST', { timeout: 60_000 });
  await page.waitForTimeout(2_000);
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Abrir details
  const summary = page.locator('summary', { hasText: /Procesos omitidos/ });
  if (await summary.isVisible().catch(() => false)) {
    await summary.click();
    const items = await page.locator('details ul li').allInnerTexts();
    console.log('=== OMITIDOS (fresh calc) ===');
    for (const i of items.slice(0, 30)) console.log(i);
  } else {
    console.log('NO HAY OMITIDOS — todos los procesos calculados');
  }

  // Capturar matriz
  const m = await page.locator('text=/\\d+\\s+procesos.*\\d+\\s+periodos/').innerText().catch(() => 'no matrix');
  console.log('\n=== MATRIZ ===');
  console.log(m);

  // Cantidades costos
  const total = await page.locator('dd').filter({ hasText: /^\d+$/ }).first().innerText().catch(() => '?');
  console.log('Total cálculos:', total);
});
