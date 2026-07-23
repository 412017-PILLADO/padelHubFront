import { test, expect } from '@playwright/test';
import { loginAsOwner, futureDate } from './helpers';

/**
 * Reserva manual desde el panel: el dueño carga un turno a mano (p. ej. una seña transferida fuera
 * de término) y nace CONFIRMADO, visible en la agenda del día elegido.
 */
test('reserva manual del panel: crea confirmada y aparece en la agenda', async ({ page }) => {
  await loginAsOwner(page);

  await page.getByRole('button', { name: '+ Reserva manual' }).click();
  const card = page.locator('.manual-card');
  await expect(card).toBeVisible();

  // Pasado mañana: agenda holgada y no pisa los slots que usan los otros specs.
  await card.locator('#mFecha').fill(futureDate(2));

  const hora = card.locator('#mHora');
  await expect(hora).toBeEnabled({ timeout: 10_000 });
  await hora.selectOption({ index: 1 }); // 0 es el placeholder "Elegí un horario"

  const cliente = `Manual E2E ${Date.now()}`;
  await card.locator('#mNombre').fill(cliente);
  // WhatsApp queda vacío a propósito: en la manual es opcional.
  await card.getByRole('button', { name: 'Crear reserva' }).click();

  // El modal cierra y el panel salta al día de la reserva.
  await expect(card).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Lista' }).click();
  await expect(page.locator('.turno-row', { hasText: cliente })).toBeVisible({ timeout: 10_000 });
});
