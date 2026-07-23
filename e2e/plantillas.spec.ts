import { test, expect, Page, request as pwRequest } from '@playwright/test';
import { API, elegirDiaYSlot } from './helpers';

/**
 * Valida las 3 plantillas de landing (A poster, B hero centrado, C compacta app): que cada tenant
 * renderice SU layout y que el flujo de reserva (compartido por las 3) llegue al éxito en todas.
 * Corre contra tenants dedicados (acepadel/costapadel/urbanpadel) resueltos por subdominio
 * `<slug>.localhost`; si no existen (base recién reseteada) se provisionan acá por la API de
 * plataforma con la key de dev.
 */
const PLANTILLAS = [
  { slug: 'acepadel', nombre: 'Ace Pádel', tpl: 'A', shell: '.poster' },
  { slug: 'costapadel', nombre: 'Costa Pádel', tpl: 'B', shell: '.tpl-b' },
  { slug: 'urbanpadel', nombre: 'Urban Pádel', tpl: 'C', shell: '.tpl-c' },
];

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext();
  for (const { slug, nombre, tpl } of PLANTILLAS) {
    const probe = await ctx.get(`${API}/public/config`, { headers: { 'X-Tenant': slug } });
    if (probe.ok()) continue;
    const alta = await ctx.post(`${API}/platform/tenants`, {
      headers: { 'X-Platform-Key': 'dev-platform-key', 'Content-Type': 'application/json' },
      data: {
        slug, name: nombre, plantilla: tpl,
        ownerEmail: `owner@${slug}.com`, ownerPassword: 'padel123',
        hosts: [`${slug}.localhost`],
      },
    });
    if (!alta.ok()) {
      throw new Error(`No se pudo provisionar ${slug}: ${alta.status()} ${await alta.text()}`);
    }
  }
  await ctx.dispose();
});

/** Completa los 5 pasos de reserva (el markup es idéntico en las 3 plantillas). */
async function reservar(page: Page, phoneSuffix: string): Promise<void> {
  // 01 · Duración
  await expect(page.locator('.dur-chips .chip').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.dur-chips .chip').first().click();
  // 02/03 · Día y horario — primer día con slot libre (de noche "Hoy" puede no tener)
  await elegirDiaYSlot(page);
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
