import { test, expect } from '@playwright/test';

/**
 * Preview de plantillas por query params (herramienta de venta, ver landing.ts:
 * previewPlantilla/previewColor). `?plantilla=A|B|C` pisa visualmente la plantilla del tenant sin
 * persistir nada y muestra un selector flotante (.tpl-pill) para cambiar de diseño en vivo.
 */
test('los query params de preview fuerzan plantilla y muestran el selector', async ({ page }) => {
  // Se registra ANTES del goto: el override de previewPlantilla se aplica recién tras el primer
  // render (afterNextRender, ver landing.ts) para no pisar la hidratación con un DOM distinto del
  // que sirvió el server — acá verificamos que efectivamente no dispare NG0500/mismatch.
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://demo.localhost:4400/?plantilla=B');
  await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'B');
  await expect(page.locator('.tpl-pill')).toBeVisible();
  await page.locator('.tpl-opt', { hasText: 'C' }).click();
  await expect(page.locator('[data-tpl]')).toHaveAttribute('data-tpl', 'C');

  expect(errors.filter((e) => e.includes('NG0') || e.toLowerCase().includes('hydration'))).toHaveLength(0);
});

test('sin query params no hay selector y manda la plantilla del tenant', async ({ page }) => {
  await page.goto('http://demo.localhost:4400/');
  await expect(page.locator('[data-tpl]')).toBeVisible();
  await expect(page.locator('.tpl-pill')).toHaveCount(0);
});
