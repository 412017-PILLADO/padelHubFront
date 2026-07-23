import { test, expect, APIRequestContext } from '@playwright/test';
import { API, RESERVA_URL, ownerToken, loginAsOwner, gotoAgenda, elegirDiaYSlot } from './helpers';

/**
 * Precio por horario (franjas): alta desde la config del panel, validación de solapes,
 * y precio efectivo + tag "Precio especial" en la landing pública. Contra el backend real.
 *
 * Seed demo: 3 canchas POR_CANCHA a $8000/$7000/$6000, horarios 08:00-23:00. La franja de
 * prueba cubre todo el día a $5000/h (menor que todas las bases) para que cualquier slot
 * elegido quede pisado por la franja.
 */
const FRANJA_PRECIO = 5000;

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

  test('franja en config, solape bloqueado y precio especial en la landing', async ({ page, request }) => {
    // Si algún paso deja la config dirty, el guard beforeunload no debe colgar la navegación.
    page.on('dialog', (d) => d.accept());

    // ---- Panel: agregar franja 08:00-23:00 → $5000/h y guardar dentro del Guardar general.
    await loginAsOwner(page);
    await gotoAgenda(page);

    await page.getByRole('button', { name: '+ Agregar franja' }).click();
    const franja = page.locator('.franja-item').first();
    await franja.locator('.tsel').first().selectOption('08:00');
    await franja.locator('.tsel').nth(1).selectOption('23:00');
    await franja.locator('.franja-price-field input').fill(String(FRANJA_PRECIO));

    await page.locator('.save-btn').click();
    await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 10_000 });

    // ---- Solape: una segunda franja 10:00-12:00 (dentro de la primera) muestra el error
    //      inline y bloquea el guardado; al quitarla se puede seguir.
    await page.getByRole('button', { name: '+ Agregar franja' }).click();
    const solapada = page.locator('.franja-item').nth(1);
    await solapada.locator('.tsel').first().selectOption('10:00');
    await solapada.locator('.tsel').nth(1).selectOption('12:00');
    await solapada.locator('.franja-price-field input').fill('9000');

    await expect(page.locator('.precio-aviso')).toBeVisible();
    await expect(page.locator('.save-btn')).toBeDisabled();

    await solapada.getByRole('button', { name: 'Quitar franja' }).click();
    await expect(page.locator('.precio-aviso')).toHaveCount(0);

    // ---- Landing pública: la franja pisa el precio de todas las canchas.
    await page.goto(RESERVA_URL);

    // Duración: primer chip; leemos los minutos del label para calcular el total esperado.
    const durChip = page.locator('.dur-chips .chip').first();
    await expect(durChip).toBeVisible();
    const durMin = parseInt((await durChip.locator('.c-label').innerText()).trim(), 10);
    expect(durMin).toBeGreaterThan(0);
    await durChip.click();

    const totalEsperado = `$${Math.round((FRANJA_PRECIO * durMin) / 60).toLocaleString('es-AR')}`;

    // Antes de elegir horario: "desde $X" considera la franja (5000 es el mínimo global).
    await expect(page.locator('.step-price')).toHaveText(`desde ${totalEsperado}`);

    // Día y horario: primer día con slot libre (hoy puede no tener turnos restantes).
    await elegirDiaYSlot(page);

    // Con el horario elegido todas las canchas cobran la franja: precio exacto (sin "desde").
    await expect(page.locator('.step-price')).toHaveText(totalEsperado);

    // Cards de cancha: tag "Precio especial" y el precio efectivo de la franja en cada una.
    const cards = page.locator('.ccard:not(.any)');
    await expect(cards.first()).toBeVisible();
    const nCards = await cards.count();
    for (let i = 0; i < nCards; i++) {
      await expect(cards.nth(i).locator('.cc-price-tag')).toContainText('Precio especial');
      await expect(cards.nth(i).locator('.cc-price .amount')).toHaveText(totalEsperado);
    }
  });
});
