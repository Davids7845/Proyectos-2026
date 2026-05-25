import { test } from '@playwright/test';
import { login } from './helpers/auth';

test('Dump diagnostic data via /api/diag', async ({ page }) => {
  await login(page);
  await page.goto('/versiones');
  const link = page.locator('table a', { hasText: /E2E_TEST_/ }).first();
  await link.waitFor({ timeout: 10_000 });
  const href = await link.getAttribute('href');
  const versionId = href?.match(/\/versiones\/([a-f0-9-]{36})/)?.[1];
  console.log('VERSION:', versionId);

  const res = await page.request.get(`/api/versiones/${versionId}/diag`);
  const data = await res.json();

  console.log('\n=== precios CALTLVTRIT ===');
  for (const p of data.precios_caltlvtrit ?? []) {
    console.log(`  ${p.periodo} | proveedor="${p.proveedor}" | ${p.precio_unitario}`);
  }

  console.log('\n=== pct CALTLVTRIT ===');
  for (const p of data.pct_caltlvtrit ?? []) {
    console.log(`  ${p.periodo} | proveedor="${p.proveedor}" | ${p.porcentaje}`);
  }

  console.log('\n=== recetas (con num_lineas) ===');
  for (const r of data.recetas ?? []) {
    console.log(`  ORD${r.proceso_ord} ${r.proceso_nombre} | producto=${r.producto_codigo} | ${r.periodo} | lineas=${r.num_lineas}`);
  }
});
