import { test, expect, Page } from '@playwright/test';
import { loginAsOwner, gotoAgenda, RESERVA_URL } from './helpers';

/**
 * La galería de plantillas de punta a punta (spec §7): el dueño elige MIRANDO —no leyendo un
 * `<select>`—, guarda, y la landing pública cambia. Los unit cubren que la grilla llame a
 * `setMarcaPlantilla()`; lo que sólo se puede ver acá es que ese click sobreviva al guardado y
 * llegue al visitante.
 *
 * Deja el tenant como lo encontró: la plantilla del demo es la A y otras specs la asumen.
 */
const irATabClub = async (page: Page) => {
  await page.locator('.cfg-tab', { hasText: 'Tu club' }).click();
  await expect(page.locator('.galeria')).toBeVisible({ timeout: 10_000 });
};

const guardar = async (page: Page) => {
  await page.locator('.save-btn').click();
  await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 10_000 });
};

test('la galería del panel cambia la plantilla de la landing', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);
  await irATabClub(page);

  const galeria = page.locator('.galeria');
  // Una miniatura por cáscara existente y NI UNA imagen: es la spec §7 hecha aserción.
  await expect(galeria.locator('plantilla-thumb')).toHaveCount(4);
  await expect(galeria.locator('img')).toHaveCount(0);
  // Y el select que esto reemplaza no volvió por ningún lado.
  await expect(page.locator('select.plantilla-sel')).toHaveCount(0);

  try {
    await galeria.locator('input[type="radio"][value="C"]').check();
    await expect(page.locator('.gal-item.sel plantilla-thumb')).toHaveAttribute('data-tpl', 'C');
    await guardar(page);

    await page.goto(RESERVA_URL);
    await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'C', { timeout: 10_000 });
  } finally {
    // Restaurar SIEMPRE, incluso si falló arriba: una spec que deja el demo en C hace fallar a las
    // que esperan la A, y el rojo aparece en el archivo equivocado.
    await page.goto('/admin/config');
    await irATabClub(page);
    await page.locator('.galeria input[type="radio"][value="A"]').check();
    await guardar(page);
  }
});

test('el preview vivo arranca en teléfono y apunta a la landing del club', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);
  await irATabClub(page);

  const iframe = page.locator('app-preview-plantilla iframe');
  await expect(iframe).toBeVisible();

  // 390 es el ancho con el que se revisó cada plantilla. Si arrancara en escritorio, el dueño
  // elegiría mirando el ancho que sus jugadores casi no usan.
  await expect(iframe).toHaveJSProperty('clientWidth', 390);

  // LA TRAMPA DEL APEX: en desarrollo el panel corre en `localhost` (sin subdominio) y un `src`
  // relativo mostraría la landing de MARKETING en vez de la del club. Ver core/landing/preview-url.ts.
  const src = await iframe.getAttribute('src');
  expect(src).toContain('demo.localhost');
  expect(src).toContain('panel=1');

  // Y adentro no aparece el selector flotante de venta, que sería un segundo control desincronizado
  // del formulario: se elegiría ahí una plantilla y se guardaría otra.
  await expect(
    page.frameLocator('app-preview-plantilla iframe').locator('.tpl-pill'),
  ).toHaveCount(0);
});
