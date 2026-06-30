import { test, expect } from '@playwright/test';
import { OWNER } from './helpers';

test('el guard redirige a login si no hay sesión', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('login del owner entra al panel', async ({ page }) => {
  await page.goto('/admin/login');

  await page.locator('#email').fill(OWNER.email);
  await page.locator('#password').fill(OWNER.password);
  await page.locator('.confirm').click();

  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  // El encabezado del panel.
  await expect(page.getByText('Turnos del día.')).toBeVisible();
});
