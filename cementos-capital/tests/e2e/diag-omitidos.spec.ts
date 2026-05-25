import { test } from '@playwright/test';
import { login } from './helpers/auth';

test('Captura diagnóstico de procesos omitidos del último run', async ({ page }) => {
  await login(page);
  await page.goto('/versiones');
  // Tomar la primera versión "E2E_TEST_..." que aparezca
  const link = page.locator('table a', { hasText: /E2E_TEST_/ }).first();
  await link.waitFor({ timeout: 10_000 });
  const href = await link.getAttribute('href');
  const versionId = href?.match(/\/versiones\/([a-f0-9-]{36})/)?.[1];
  console.log('VERSION_ID:', versionId);

  await page.goto(`/versiones/${versionId}/calcular`);
  await page.waitForLoadState('networkidle');

  // Capturar full page screenshot del diagnóstico
  await page.screenshot({ path: 'test-results/diag-calcular.png', fullPage: true });

  // Forzar abrir el <details> de procesos omitidos
  const detailsSummary = page.locator('summary', { hasText: /Procesos omitidos/ });
  if (await detailsSummary.isVisible().catch(() => false)) {
    await detailsSummary.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/diag-calcular-open.png', fullPage: true });

    // Imprimir las razones en console
    const items = await page.locator('details ul li').allInnerTexts();
    console.log('=== PROCESOS OMITIDOS ===');
    for (const i of items) console.log(i);
  } else {
    console.log('No se encontró <summary> con "Procesos omitidos"');
  }
});
