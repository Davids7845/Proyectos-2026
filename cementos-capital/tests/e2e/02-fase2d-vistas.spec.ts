import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

// Smoke test de las vistas nuevas/refactorizadas en Fase 2d.
// Asume que existe al menos una versión en la base; toma la primera del listado.

async function getFirstVersionId(page: import('@playwright/test').Page): Promise<string | null> {
  await page.goto('/versiones');
  const links = await page.locator('a[href^="/versiones/"]').elementHandles();
  for (const lnk of links) {
    const href = await lnk.getAttribute('href');
    const m = href?.match(/^\/versiones\/([0-9a-f-]{36})(\/|$)/);
    if (m) return m[1];
  }
  return null;
}

test.describe('Fase 2d — vistas gerenciales', () => {
  test('Vista Costo renderiza KPI cards o estado vacío', async ({ page }) => {
    await login(page);
    const vid = await getFirstVersionId(page);
    test.skip(!vid, 'No hay versiones en la BD');
    await page.goto(`/versiones/${vid}/costo`);
    await expect(page.locator('h1')).toContainText(/Costo por proceso/i);
  });

  test('Vista Energía carga (KPIs o tabla)', async ({ page }) => {
    await login(page);
    const vid = await getFirstVersionId(page);
    test.skip(!vid, 'No hay versiones en la BD');
    await page.goto(`/versiones/${vid}/datos/energia`);
    await expect(page.locator('h1')).toContainText(/Energ/i);
  });

  test('Vista Gráficas carga con selector de versión', async ({ page }) => {
    await login(page);
    const vid = await getFirstVersionId(page);
    test.skip(!vid, 'No hay versiones en la BD');
    await page.goto(`/versiones/${vid}/graficas`);
    await expect(page.locator('h1')).toContainText(/Gr.ficas/i);
    await expect(page.locator('select')).toBeVisible();
  });

  test('Vista Costo Arrastrado carga con selector', async ({ page }) => {
    await login(page);
    const vid = await getFirstVersionId(page);
    test.skip(!vid, 'No hay versiones en la BD');
    await page.goto(`/versiones/${vid}/arrastrado`);
    await expect(page.locator('h1')).toContainText(/Costo arrastrado/i);
    await expect(page.locator('select')).toBeVisible();
  });

  test('Vista Sin Consolidar carga e indica el modo activo', async ({ page }) => {
    await login(page);
    const vid = await getFirstVersionId(page);
    test.skip(!vid, 'No hay versiones en la BD');
    await page.goto(`/versiones/${vid}/sin-consolidar`);
    await expect(page.locator('h1')).toContainText(/Costo sin consolidar/i);
    await expect(page.locator('body')).toContainText(/(Sin Consolidar|Consolidado)/);
  });
});
