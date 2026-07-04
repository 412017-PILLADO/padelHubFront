import { test, expect } from '@playwright/test';
import { loginAsOwner, gotoAgenda } from './helpers';

/** La pantalla de config carga los datos sembrados y guarda un cambio de configuración. */
test('config: carga datos y guarda un cambio', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  // Datos sembrados visibles.
  await expect(page.getByText('Horario semanal')).toBeVisible();
  await expect(page.locator('.cancha-item', { hasText: 'Cancha 1' })).toBeVisible({ timeout: 10_000 });

  // Cambiar la duración por defecto (marca dirty) y guardar. Se restaura al final para no
  // contaminar la config compartida (la grilla de disponibilidad se ancla al turno principal).
  const defChips = page.locator('.def-chips .dchip');
  await expect(defChips.first()).toBeVisible();
  const originalIdx = await defChips.evaluateAll(
    (els) => els.findIndex((e) => e.getAttribute('aria-pressed') === 'true'),
  );
  const count = await defChips.count();
  const targetIdx = originalIdx === count - 1 ? 0 : count - 1;
  await defChips.nth(targetIdx).click();

  await page.locator('.save-btn').click();

  // Tras guardar, la barra de estado vuelve a "Todo guardado" (persistente, no transitorio como el toast).
  await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 10_000 });

  // Restaurar el turno principal original y volver a guardar.
  if (originalIdx >= 0) {
    await defChips.nth(originalIdx).click();
    await page.locator('.save-btn').click();
    await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 10_000 });
  }
});
