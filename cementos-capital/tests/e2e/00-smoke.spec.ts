import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test('La app carga y permite login', async ({ page }) => {
  await login(page);
  await expect(page.locator('h1')).toContainText(/versiones|presupuesto/i);
});

test('La pestaña /admin/maestros/procesos lista los 17 ORDs', async ({ page }) => {
  await login(page);
  await page.goto('/admin/maestros/procesos');
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
  const rowCount = await page.locator('table tbody tr').count();
  expect(rowCount, `Se esperaban ≥17 procesos, encontrados: ${rowCount}`).toBeGreaterThanOrEqual(17);
});

test('La página de fórmulas existe', async ({ page }) => {
  await login(page);
  await page.goto('/admin/formulas');
  await expect(page.locator('body')).toContainText(/f.rmula/i, { timeout: 5_000 });
});
