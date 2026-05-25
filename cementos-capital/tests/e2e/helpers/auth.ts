import type { Page } from '@playwright/test';

export async function login(page: Page) {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Configurar PLAYWRIGHT_TEST_EMAIL y PLAYWRIGHT_TEST_PASSWORD en .env.e2e.local'
    );
  }
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /ingresar/i }).click();
  await page.waitForURL('**/versiones', { timeout: 15_000 });
}
