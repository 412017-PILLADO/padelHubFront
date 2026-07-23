import { test, expect } from '@playwright/test';
import { RESERVA_URL, elegirDiaYSlot } from './helpers';

/**
 * Flujo público de reserva en 5 pasos sobre demo.localhost.
 * @smoke el camino feliz mínimo (lo reutiliza la suite de humo).
 */
test('reserva pública: 5 pasos hasta el éxito @smoke', async ({ page }) => {
  await page.goto(RESERVA_URL);

  // 01 · Duración — elegimos la primera disponible.
  await expect(page.locator('.dur-chips .chip').first()).toBeVisible();
  await page.locator('.dur-chips .chip').first().click();

  // 02/03 · Día y horario — primer día con slot libre (de noche "Hoy" puede no tener).
  await elegirDiaYSlot(page);

  // 04 · Cancha — "Cualquiera disponible".
  await page.locator('.ccard.any').click();

  // 05 · Datos. Teléfono único por corrida: el back limita reservas por teléfono (anti-abuso),
  // así el smoke es re-ejecutable sin chocar con ese límite.
  await page.locator('#fName').fill('Test E2E');
  const phone = page.locator('#fPhone');
  if (await phone.isVisible()) {
    await phone.fill(`35155${String(Date.now()).slice(-5)}`);
  }

  await page.locator('.confirm').click();

  // Éxito.
  await expect(page.locator('.success.open')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.recap')).toBeVisible();
});
