import { test, expect } from '@playwright/test';
import { loginAsOwner, gotoAgenda } from './helpers';

/** La pantalla de config carga los datos sembrados y guarda un cambio de configuración. */
test('config: carga datos y guarda un cambio', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  // Datos sembrados visibles.
  await expect(page.getByText('Horario semanal')).toBeVisible();
  await expect(page.locator('.cancha-item', { hasText: 'Cancha 1' })).toBeVisible({ timeout: 10_000 });

  // Cambiar la duración por defecto (marca dirty) y guardar.
  const defChips = page.locator('.def-chips .dchip');
  await expect(defChips.first()).toBeVisible();
  await defChips.last().click();

  await page.locator('.save-btn').click();

  // Tras guardar, la barra de estado vuelve a "Todo guardado" (persistente, no transitorio como el toast).
  await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 10_000 });
});
