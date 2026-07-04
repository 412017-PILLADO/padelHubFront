import { test, expect, APIRequestContext } from '@playwright/test';
import { RESERVA_URL, API, ownerToken, loginAsOwner } from './helpers';

/** Activa/desactiva el módulo de señas del complejo demo vía la API del panel. */
async function setSena(
  request: APIRequestContext,
  token: string,
  requiere: boolean,
  monto: number | null,
  alias: string | null = null,
) {
  const res = await request.put(`${API}/api/v1/agenda/sena`, {
    headers: { 'X-Tenant': 'demo', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { requiereSena: requiere, senaMonto: monto, senaAlias: alias },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe('señas', () => {
  // Siempre dejar el módulo apagado: otros specs esperan reservas CONFIRMADO al instante.
  test.afterEach(async ({ request }) => {
    const token = await ownerToken(request);
    await setSena(request, token, false, null);
  });

  test('reserva con seña queda PENDIENTE, muestra el aviso y el dueño la confirma', async ({ page, request }) => {
    const token = await ownerToken(request);
    await setSena(request, token, true, 5000, 'padel.hub.e2e');

    const cliente = `Seña E2E ${Date.now()}`;

    // ── Reserva por UI en demo.localhost: la pantalla de éxito debe pedir la seña ──
    await page.goto(RESERVA_URL);

    await expect(page.locator('.dur-chips .chip').first()).toBeVisible();
    await page.locator('.dur-chips .chip').first().click();          // 01 · Duración
    // 02 · Día "Mañana" (agenda completa; evita competir con el @smoke que usa "Hoy"). El pendiente
    // igual aparece en el panel, que lista los pendientes de todas las fechas.
    await page.locator('.days .chip').nth(1).click();

    // 03 · Horario. La grilla se re-renderiza al recargar disponibilidad, así que reintentamos el
    // click hasta que un slot quede estable y aparezcan sus canchas (el elemento se desprende si no).
    const slots = page.locator('.times .slot:not([disabled])');
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    await expect(async () => {
      await slots.first().click();
      await expect(page.locator('.court.any')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page.locator('.court.any').click();                        // 04 · Cancha (cualquiera)

    await page.locator('#fName').fill(cliente);                      // 05 · Datos
    const phone = page.locator('#fPhone');
    if (await phone.isVisible()) {
      await phone.fill(`35166${String(Date.now()).slice(-5)}`);
    }
    await page.locator('.confirm').click();

    // Éxito con el bloque de seña (monto formateado es-AR + botón de WhatsApp).
    await expect(page.locator('.success.open')).toBeVisible({ timeout: 15_000 });
    const senaBox = page.locator('.sena-box');
    await expect(senaBox).toBeVisible();
    await expect(senaBox).toContainText('5.000');
    // El alias se muestra con su botón de copiar.
    await expect(senaBox.locator('.sa-value')).toHaveText('padel.hub.e2e');
    await expect(senaBox.locator('.sa-copy')).toBeVisible();
    await expect(senaBox.locator('.sena-wa')).toHaveAttribute('href', /wa\.me/);

    // ── Panel: la reserva aparece como pendiente y el dueño la confirma ──
    await loginAsOwner(page); // navega a localhost:4400/admin (panel)

    const row = page.locator('.pb-row', { hasText: cliente });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('.pb-wa')).toHaveAttribute('href', /wa\.me/);

    await row.locator('.pb-ok').click(); // Confirmar (sin ConfirmDialog)
    await expect(page.locator('.pb-row', { hasText: cliente })).toHaveCount(0, { timeout: 10_000 });
  });
});
