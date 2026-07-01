import { test, expect } from '@playwright/test';
import { loginAsOwner, API, futureDate } from './helpers';

/**
 * Panel de turnos: crea una reserva por API para mañana, la ve en el panel (con la cancha siempre
 * visible) usando el chip "Mañana", y la cancela vía el ConfirmDialog.
 */
test('ver y cancelar un turno del día', async ({ page }) => {
  // Reserva para mañana (el panel la muestra con el chip "Mañana"). La hora se toma de la
  // disponibilidad real (la grilla depende del turno principal configurado), así el spec no se
  // rompe si cambia la config o quedan reservas de corridas previas.
  const fecha = futureDate(1);
  const disp = await page.request.get(`${API}/public/disponibilidad?fecha=${fecha}&duracion=60`, {
    headers: { 'X-Tenant': 'demo' },
  });
  expect(disp.ok(), await disp.text()).toBeTruthy();
  const slots: Array<{ hora: string; disponible: boolean; canchasLibres: Array<{ id: number }> }> =
    await disp.json();
  const libres = slots.filter((s) => s.disponible && s.canchasLibres.some((c) => c.id === 1));
  expect(libres.length, 'hay slots libres en cancha 1 para mañana').toBeGreaterThan(0);
  const hora = libres[Date.now() % libres.length].hora;
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
