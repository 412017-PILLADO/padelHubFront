import { test, expect, Page } from '@playwright/test';
import { loginAsOwner, gotoAgenda } from './helpers';

/** Clickea la pestaña de configuración con ese label (ej: "Agenda", "Canchas", "Cobros"). */
const irATab = async (page: Page, label: string) => {
  await page.locator('.cfg-tab', { hasText: label }).click();
};

/** La pantalla de config carga los datos sembrados y guarda un cambio de configuración. */
test('config: carga datos y guarda un cambio', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  // Datos sembrados visibles, cada uno en su pestaña.
  await irATab(page, 'Agenda');
  await expect(page.getByText('Horario semanal')).toBeVisible();

  await irATab(page, 'Canchas');
  await expect(page.locator('.cancha-item', { hasText: 'Cancha 1' })).toBeVisible({ timeout: 10_000 });

  // Card Mercado Pago: visible y sin conectar en el entorno de e2e
  await irATab(page, 'Cobros');
  await expect(page.locator('.mp-estado')).toBeVisible();
  await expect(page.locator('.mp-connect')).toBeVisible();

  // Cambiar la duración por defecto (marca dirty) y guardar. Se restaura al final para no
  // contaminar la config compartida (la grilla de disponibilidad se ancla al turno principal).
  await irATab(page, 'Agenda');
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

/** Cambiar de pestaña con cambios sin guardar y volver no debe perder el cambio: el estado
 *  vive en signals del componente, no se remonta al cambiar de @case. */
test('config: un cambio sin guardar sobrevive al cambiar de pestaña y volver', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  await irATab(page, 'Agenda');
  const defChips = page.locator('.def-chips .dchip');
  await expect(defChips.first()).toBeVisible();
  const originalIdx = await defChips.evaluateAll(
    (els) => els.findIndex((e) => e.getAttribute('aria-pressed') === 'true'),
  );
  const count = await defChips.count();
  const targetIdx = originalIdx === count - 1 ? 0 : count - 1;
  await defChips.nth(targetIdx).click();

  await expect(page.locator('.savebar .sv')).toHaveText('Cambios sin guardar');

  await irATab(page, 'Precios');
  await irATab(page, 'Agenda');

  await expect(defChips.nth(targetIdx)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.savebar .sv')).toHaveText('Cambios sin guardar');

  // No guardamos: dejamos la config sembrada intacta (this test no persiste el cambio).
});

/** `?tab=cobros` en la URL abre directamente esa pestaña. */
test('config: ?tab=cobros en la URL abre esa pestaña directamente', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  await page.goto(page.url() + '?tab=cobros');
  await expect(page.locator('.cfg-tab.on')).toHaveText('Cobros');
  await expect(page.locator('.mp-estado')).toBeVisible();
});
