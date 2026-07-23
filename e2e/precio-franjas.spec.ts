import { test, expect, APIRequestContext } from '@playwright/test';
import { API, RESERVA_URL, ownerToken, loginAsOwner, gotoAgenda, elegirDiaYSlot } from './helpers';

/**
 * Precio por horario (franjas de ajuste porcentual): alta desde la config del panel, validación de
 * solapes, y precio efectivo + tag "Precio especial" en la landing pública. Contra el backend real.
 *
 * Seed demo: 3 canchas POR_CANCHA a $8000/$7000/$6000, horarios 08:00-23:00. La franja de prueba
 * cubre todo el día con -50%, así cualquier slot queda ajustado PERO cada cancha mantiene su precio
 * relativo ($4000/$3500/$3000): la regla que motivó el modelo porcentual.
 */
const DESCUENTO_PCT = 50;

/** Borra todas las franjas vía API (PUT replace-all con lista vacía) para no contaminar la config. */
async function borrarFranjas(request: APIRequestContext): Promise<void> {
  const token = await ownerToken(request);
  const res = await request.put(`${API}/api/v1/agenda/precio-franjas`, {
    headers: { 'X-Tenant': 'demo', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { franjas: [] },
  });
  expect(res.ok(), 'limpiar franjas debería responder 2xx').toBeTruthy();
}

test.describe('precio por horario', () => {
  test.afterEach(async ({ request }) => {
    await borrarFranjas(request);
  });

  test('franja % en config, solape bloqueado y precio por cancha ajustado en la landing', async ({ page, request }) => {
    // Si algún paso deja la config dirty, el guard beforeunload no debe colgar la navegación.
    page.on('dialog', (d) => d.accept());

    // Precios base por cancha (para calcular los efectivos esperados con el descuento).
    const cfgRes = await request.get(`${API}/public/config`, { headers: { 'X-Tenant': 'demo' } });
    expect(cfgRes.ok()).toBeTruthy();
    const cfg = await cfgRes.json();
    const bases: { nombre: string; precioHora: number }[] = cfg.canchas
      .filter((c: { precioHora: number | null }) => c.precioHora != null)
      .map((c: { nombre: string; precioHora: number }) => ({ nombre: c.nombre, precioHora: c.precioHora }));
    expect(bases.length).toBeGreaterThan(1);

    // ---- Panel: franja 08:00-23:00 con -50% y guardar dentro del Guardar general.
    await loginAsOwner(page);
    await gotoAgenda(page);

    await page.getByRole('button', { name: '+ Agregar franja' }).click();
    const franja = page.locator('.franja-item').first();
    await franja.locator('.franja-times .tsel').first().selectOption('08:00');
    await franja.locator('.franja-times .tsel').nth(1).selectOption('23:00');
    await franja.locator('.franja-tipo-field select').selectOption('DESCUENTO');
    await franja.locator('.franja-price-field input').fill(String(DESCUENTO_PCT));

    await page.locator('.save-btn').click();
    await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 10_000 });

    // ---- Solape: una segunda franja 10:00-12:00 (dentro de la primera) muestra el error
    //      inline y bloquea el guardado; al quitarla se puede seguir.
    await page.getByRole('button', { name: '+ Agregar franja' }).click();
    const solapada = page.locator('.franja-item').nth(1);
    await solapada.locator('.franja-times .tsel').first().selectOption('10:00');
    await solapada.locator('.franja-times .tsel').nth(1).selectOption('12:00');
    await solapada.locator('.franja-price-field input').fill('30');

    await expect(page.locator('.precio-aviso')).toBeVisible();
    await expect(page.locator('.save-btn')).toBeDisabled();

    await solapada.getByRole('button', { name: 'Quitar franja' }).click();
    await expect(page.locator('.precio-aviso')).toHaveCount(0);

    // ---- Landing pública: el descuento se aplica sobre el precio de CADA cancha.
    await page.goto(RESERVA_URL);

    const durChip = page.locator('.dur-chips .chip').first();
    await expect(durChip).toBeVisible();
    const durMin = parseInt((await durChip.locator('.c-label').innerText()).trim(), 10);
    expect(durMin).toBeGreaterThan(0);
    await durChip.click();

    const factor = (100 - DESCUENTO_PCT) / 100;
    const totalDe = (precioHora: number) =>
      `$${Math.round((Math.round(precioHora * factor) * durMin) / 60).toLocaleString('es-AR')}`;
    const minBase = Math.min(...bases.map((b) => b.precioHora));

    // Antes de elegir horario: "desde $X" considera el ajuste (el mínimo es la cancha más barata
    // con el descuento aplicado).
    await expect(page.locator('.step-price')).toHaveText(`desde ${totalDe(minBase)}`);

    await elegirDiaYSlot(page);

    // Cada cancha libre del slot muestra SU precio con el descuento (no un precio único plano)
    // y el tag "Precio especial".
    for (const b of bases) {
      const card = page.locator('.ccard:not(.any)', { hasText: b.nombre });
      if ((await card.count()) === 0) continue; // puede estar ocupada por otra corrida
      await expect(card.locator('.cc-price-tag')).toContainText('Precio especial');
      await expect(card.locator('.cc-price .amount')).toHaveText(totalDe(b.precioHora));
    }
  });
});
