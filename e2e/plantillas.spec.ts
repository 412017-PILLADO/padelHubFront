import { test, expect, Page } from '@playwright/test';

/**
 * Valida las 3 plantillas de landing (A poster, B hero centrado, C compacta app): que cada tenant
 * renderice SU layout y que el flujo de reserva (compartido por las 3) llegue al éxito en todas.
 * Corre contra tenants dedicados creados por plataforma (acepadel/costapadel/urbanpadel), resueltos
 * por subdominio `<slug>.localhost`.
 */
const PLANTILLAS = [
  { slug: 'acepadel', tpl: 'A', shell: '.poster' },
  { slug: 'costapadel', tpl: 'B', shell: '.tpl-b' },
  { slug: 'urbanpadel', tpl: 'C', shell: '.tpl-c' },
];

/** Completa los 5 pasos de reserva (el markup es idéntico en las 3 plantillas). */
async function reservar(page: Page, phoneSuffix: string): Promise<void> {
  // 01 · Duración
  await expect(page.locator('.dur-chips .chip').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.dur-chips .chip').first().click();
  // 02 · Día — "Hoy"
  await page.locator('.days .chip').first().click();
  // 03 · Horario — primer slot libre
  const slot = page.locator('.times .slot:not([disabled])').first();
  await expect(slot).toBeVisible({ timeout: 15_000 });
  await slot.click();
  // 04 · Cancha — cualquiera
  await page.locator('.ccard.any').click();
  // 05 · Datos (teléfono único por corrida)
  await page.locator('#fName').fill('Test Plantilla');
  const phone = page.locator('#fPhone');
  if (await phone.isVisible()) {
    await phone.fill(`35155${phoneSuffix}`);
  }
  await page.locator('.confirm').click();
  // Éxito
  await expect(page.locator('.success.open')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.recap')).toBeVisible();
}

for (const { slug, tpl, shell } of PLANTILLAS) {
  test(`plantilla ${tpl} (${slug}): renderiza su layout y reserva hasta el éxito`, async ({ page }) => {
    await page.goto(`http://${slug}.localhost:4400/`);

    // El host de la landing marca la plantilla elegida y se ve la shell correspondiente.
    await expect(page.locator(`[data-tpl="${tpl}"]`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(shell)).toBeVisible();

    await reservar(page, `${tpl}${String(Date.now()).slice(-4)}`);
  });
}
