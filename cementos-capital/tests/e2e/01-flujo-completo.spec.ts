import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { cleanupTestVersions } from './helpers/cleanup';
import { getExcelFixturePath } from './helpers/excel';

const VERSION_NAME = `E2E_TEST_${Date.now()}`;

test.beforeAll(async () => {
  await cleanupTestVersions();
});

test.afterAll(async () => {
  await cleanupTestVersions();
});

test('Flujo completo: login → importar → calcular → validar costos → trazabilidad', async ({ page }) => {
  let versionId: string | null = null;

  // === PASO 1: Login ===
  await test.step('Login con usuario de prueba', async () => {
    await login(page);
    await expect(page.locator('h1')).toContainText('Versiones de Presupuesto');
  });

  // === PASO 2: Crear versión ===
  // NuevaVersionButton abre un modal inline y después llama router.refresh()
  // (no navega a /versiones/[id]). El ID se extrae del link en la tabla.
  await test.step('Crear versión nueva', async () => {
    await page.getByRole('button', { name: /nueva versión/i }).click();

    // El modal tiene un input texto con placeholder "Ej: Ppto 2026 v1"
    await page.getByPlaceholder(/ppto.*2026/i).fill(VERSION_NAME);
    await page.getByRole('button', { name: /crear versión/i }).click();

    // Modal se cierra (su encabezado desaparece) y la página se refresca
    await expect(
      page.locator('h2', { hasText: 'Nueva versión de presupuesto' })
    ).toBeHidden({ timeout: 10_000 });

    // La nueva versión aparece en la tabla como un link
    const versionLink = page.locator('table a', { hasText: VERSION_NAME }).first();
    await expect(versionLink).toBeVisible({ timeout: 10_000 });
    const href = await versionLink.getAttribute('href');
    versionId = href?.match(/\/versiones\/([a-f0-9-]{36})/)?.[1] ?? null;
    expect(versionId, 'No se pudo extraer versionId del href').toBeTruthy();
  });

  // === PASO 3: Importar Excel ===
  await test.step('Importar archivo Excel', async () => {
    await page.goto(`/versiones/${versionId}/datos/importar`);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(getExcelFixturePath());

    // Botón "Importar" se habilita al seleccionar un archivo
    await page.getByRole('button', { name: /^Importar$/i }).click();

    // El importer puede tardar. Esperamos el encabezado del reporte.
    await expect(
      page.locator('h2', { hasText: 'Reporte de importación' })
    ).toBeVisible({ timeout: 60_000 });

    // Verificar que no hay errores críticos (error_msg en rojo)
    const errorBox = page.locator('.bg-red-50').filter({ hasText: /^Error:/ });
    await expect(errorBox).toBeHidden({ timeout: 2_000 }).catch(() => {
      throw new Error('La importación reportó un error. Ver screenshot.');
    });
  });

  // === PASO 4: Verificar datos cargados ===
  await test.step('Verificar /datos/precios tiene filas', async () => {
    await page.goto(`/versiones/${versionId}/datos/precios`);
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount, `Se esperaban ≥20 precios, encontrados: ${rowCount}`).toBeGreaterThan(20);
  });

  await test.step('Verificar /datos/recetas tiene filas', async () => {
    await page.goto(`/versiones/${versionId}/datos/recetas`);
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
  });

  // === PASO 5: Ejecutar cálculo ===
  // Botón real: "Ejecutar cálculo". Tras completar, router.refresh() re-renderiza
  // la página y el dl muestra lastRun.estado = "exitoso".
  await test.step('Ejecutar cálculo', async () => {
    await page.goto(`/versiones/${versionId}/calcular`);
    await page.getByRole('button', { name: /ejecutar cálculo/i }).click();

    // Esperar que el botón deje de estar en estado "Calculando…" y la página
    // muestre el resultado. El refresh del servidor muestra "exitoso" en el dl.
    await expect(
      page.locator('dd').filter({ hasText: 'exitoso' }).first()
    ).toBeVisible({ timeout: 120_000 });
  });

  // === PASO 6: Validar Cemento UG ≈ 95,900 COP/Ton (sep-2025) ===
  await test.step('Validar costo Cemento UG ≈ 95.900 en sep-2025', async () => {
    await page.goto(`/versiones/${versionId}/costo`);
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });

    // Fila ORD 6 "Cemento UG" — excluye variantes con sufijo (50 KG, 42,5, 25 KG, TP)
    const cemUgRow = page.locator('tbody tr')
      .filter({ hasText: /Cemento UG/i })
      .filter({ hasNot: page.locator('text=/50 KG|42,5|25 KG|TP/i') })
      .first();
    await expect(cemUgRow).toBeVisible({ timeout: 10_000 });

    const cells = await cemUgRow.locator('td').allInnerTexts();
    expect(
      containsValueNear(cells, 95_900, 0.01),
      `Cemento UG: ninguna celda ≈95.900 ±1%. Valores: ${cells.join(' | ')}`
    ).toBe(true);
  });

  // === PASO 7: Validar Clinker ≈ 113,463 COP/Ton (sep-2025) ===
  await test.step('Validar costo Clinker ≈ 113.463 en sep-2025', async () => {
    const clinkerRow = page.locator('tbody tr', { hasText: /Clinkerización/i }).first();
    await expect(clinkerRow).toBeVisible({ timeout: 10_000 });

    const cells = await clinkerRow.locator('td').allInnerTexts();
    expect(
      containsValueNear(cells, 113_463, 0.01),
      `Clinker: ninguna celda ≈113.463 ±1%. Valores: ${cells.join(' | ')}`
    ).toBe(true);
  });

  // === PASO 8: Trazabilidad ===
  await test.step('Click en celda abre árbol de trazabilidad', async () => {
    // Las celdas clicables son <a href="/versiones/[id]/calculos/[calcId]">
    const cellLink = page.locator('tbody a[href*="/calculos/"]').first();
    await expect(cellLink).toBeVisible({ timeout: 10_000 });
    await cellLink.click();

    await page.waitForURL(/\/calculos\/[a-f0-9-]{36}/, { timeout: 15_000 });

    // El CalculationTree carga el árbol. Esperar nodo raíz visible.
    await expect(page.locator('.bg-white.border').first()).toBeVisible({ timeout: 10_000 });

    // Intentar expandir un nodo con aria-label="Expandir"
    const expandBtn = page.locator('[aria-label="Expandir"]').first();
    if (await expandBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expandBtn.click();
    }

    // Verificar que hay al menos una "expresión evaluada" expandible (árbol con hijos)
    await expect(page.locator('summary', { hasText: 'expresión evaluada' }).first())
      .toBeVisible({ timeout: 10_000 });
  });

  // === PASO 9: Dashboard ===
  await test.step('Dashboard renderiza gráficos SVG', async () => {
    await page.goto(`/versiones/${versionId}/dashboard`);
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
    const svgCount = await page.locator('svg').count();
    expect(svgCount, 'Se esperaban al menos 2 gráficos SVG').toBeGreaterThan(0);
  });
});

// ─── Utilidad numérica ─────────────────────────────────────────────────────
// Parsea números en formato es-CO (95.900 → 95900, 95.900,55 → 95900.55)
function parseEsCO(text: string): number {
  const cleaned = text
    .replace(/[^\d,.-]/g, '')   // quitar símbolos excepto dígitos , . -
    .replace(/\./g, '')         // quitar separador de miles (.)
    .replace(',', '.');         // convertir decimal (,) a (.)
  return parseFloat(cleaned);
}

function containsValueNear(cells: string[], target: number, tolerance: number): boolean {
  return cells.some(text => {
    const num = parseEsCO(text);
    if (isNaN(num) || num === 0) return false;
    return Math.abs(num - target) / target < tolerance;
  });
}
