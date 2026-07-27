import { test, expect } from '@playwright/test';

/**
 * Preview de plantillas por query params (herramienta de venta, ver landing.ts:
 * previewPlantilla/previewColor). `?plantilla=A|B|C` pisa visualmente la plantilla del tenant sin
 * persistir nada y muestra un selector flotante (.tpl-pill) para cambiar de diseño en vivo.
 */
test('los query params de preview fuerzan plantilla y muestran el selector', async ({ page }) => {
  await page.goto('http://demo.localhost:4400/?plantilla=B');
  await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'B');
  await expect(page.locator('.tpl-pill')).toBeVisible();
  await page.locator('.tpl-opt', { hasText: 'C' }).click();
  await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'C');
});

test('sin query params no hay selector y manda la plantilla del tenant', async ({ page }) => {
  await page.goto('http://demo.localhost:4400/');
  await expect(page.locator('[data-tpl]')).toBeVisible();
  await expect(page.locator('.tpl-pill')).toHaveCount(0);
});
