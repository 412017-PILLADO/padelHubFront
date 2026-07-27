import { test, expect } from '@playwright/test';
import { RESERVA_URL } from './helpers';

// Res. 424/2020: link visible en la home, formulario sin registro, código inmediato.
test('el botón de arrepentimiento emite código y aparece en el panel', async ({ page }) => {
  await page.goto(RESERVA_URL);
  const link = page.locator('.arrep-link');
  await expect(link).toBeVisible();
  await link.click();

  await page.locator('.arrep-in').first().fill('E2E Arrepentido');
  await page.locator('.arrep-in').nth(1).fill('3510000000');
  await page.locator('.arrep-enviar').click();

  const codigo = await page.locator('.arrep-codigo').textContent();
  expect(codigo?.trim()).toMatch(/^ARR-[A-Z0-9]{6}$/);
});
