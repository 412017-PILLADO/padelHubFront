import { test, expect } from '@playwright/test';
import { loginAsOwner, gotoAgenda } from './helpers';

/** Gestión de canchas desde el panel: alta → edición → baja (la feature nueva de esta ronda). */
test('alta, edición y baja de una cancha', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  const nombre = `Cancha E2E ${Date.now()}`;
  const renombrada = `${nombre} (editada)`;

  // ── Alta ──
  await page.locator('.cancha-add').click();
  await page.locator('#cName').fill(nombre);
  // tipoPared queda en su default (CRISTAL); precio/color opcionales.
  await page.locator('.cancha-save').click();

  const item = page.locator('.cancha-item', { hasText: nombre });
  await expect(item).toBeVisible({ timeout: 10_000 });

  // ── Edición ──
  await item.locator('.cancha-edit').click();
  await page.locator('#cName').fill(renombrada);
  await page.locator('.cancha-save').click();
  await expect(page.locator('.cancha-item', { hasText: renombrada })).toBeVisible({ timeout: 10_000 });

  // ── Baja (con confirmación) ──
  await page.locator('.cancha-item', { hasText: renombrada }).locator('.cancha-del').click();
  await page.locator('.p-confirmdialog-accept-button').click();
  await expect(page.locator('.cancha-item', { hasText: renombrada })).toHaveCount(0, { timeout: 10_000 });
});
