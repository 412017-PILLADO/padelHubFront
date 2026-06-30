import { test, expect } from '@playwright/test';
import { loginAsOwner, API, futureDate } from './helpers';

/**
 * Panel de turnos: crea una reserva por API para mañana, la ve en el panel (con la cancha siempre
 * visible) usando el chip "Mañana", y la cancela vía el ConfirmDialog.
 */
test('ver y cancelar un turno del día', async ({ page }) => {
  // Reserva para mañana (el panel la muestra con el chip "Mañana"). La hora varía por corrida para
  // que el suite tolere re-ejecuciones sin reseteo previo; idealmente se corre sobre DB reseteada.
  const fecha = futureDate(1);
  const hh = String(8 + (Date.now() % 13)).padStart(2, '0');
  const hora = `${hh}:00`;
  const cliente = `Cliente ${Date.now()}`;

  const crear = await page.request.post(`${API}/public/reservas`, {
    headers: { 'X-Tenant': 'demo', 'Content-Type': 'application/json' },
    data: {
      complejoId: 1, canchaId: 1, fecha, hora, duracion: 60,
      clienteNombre: cliente, clienteWhatsapp: '3515551234',
    },
  });
  expect(crear.ok(), await crear.text()).toBeTruthy();

  await loginAsOwner(page); // queda en /admin (panel)

  await page.getByRole('button', { name: 'Mañana' }).click();

  const row = page.locator('.turno-row', { hasText: cliente });
  await expect(row).toBeVisible({ timeout: 10_000 });
  // La cancha se muestra siempre (Fase 3.1).
  await expect(row.locator('.t-meta')).toContainText('Cancha');
  // Link de WhatsApp.
  await expect(row.locator('a.wa')).toHaveAttribute('href', /wa\.me/);

  // Cancelar con confirmación (botón "Aceptar" del ConfirmDialog, no el de la fila).
  await row.locator('.act.cancel').click();
  await page.locator('.p-confirmdialog-accept-button').click();
  await expect(page.locator('.turno-row', { hasText: cliente })).toHaveCount(0, { timeout: 10_000 });
});
