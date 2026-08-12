import { test, expect } from '@playwright/test';

/**
 * Preview de plantillas por query params (herramienta de venta, ver landing.ts:
 * previewPlantilla/previewColor). `?plantilla=` con uno de los códigos que tienen cáscara
 * (`CODIGOS_CON_SHELL`) pisa visualmente la plantilla del tenant sin
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

/**
 * `?color=` además de pisar el primario tiene que dejar la TINTA legible que se derive de ese
 * color (--ink-on-accent, ver core/branding): un club de color claro necesita texto oscuro y uno
 * oscuro texto blanco. Antes esto se hardcodeaba en `#fff` y el afiche quedaba ilegible.
 */
test('el color de preview deriva la tinta legible del afiche', async ({ page }) => {
  // La marca se aplica cuando llega /public/config, así que se espera al valor (no se lee de una).
  // Ojo: al leer la custom property, el browser devuelve el valor YA resuelto — la tinta oscura
  // se escribe como `var(--ink)` pero se lee como el hex de ese token.
  const esperarInk = async (color: string, esperado: 'oscura' | 'blanca') => {
    await page.goto(`http://demo.localhost:4400/?plantilla=A&color=${encodeURIComponent(color)}`);
    const ink = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--ink-on-accent').trim(),
          ),
        { timeout: 15_000 },
      )
      .toBe(esperado === 'oscura' ? ink : '#fff');
  };
  await esperarInk('#f7d747', 'oscura'); // amarillo → tinta oscura
  await esperarInk('#2747ff', 'blanca'); // cobalto → tinta blanca
});
