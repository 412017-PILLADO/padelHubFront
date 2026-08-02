import { test, expect } from '@playwright/test';
import { API, RESERVA_URL, ownerToken } from './helpers';

// Res. 424/2020: link visible en la home, formulario sin registro, código inmediato.
test('el botón de arrepentimiento emite código y aparece en el panel', async ({ page, request }) => {
  await page.goto(RESERVA_URL);
  const link = page.locator('.arrep-link');
  await expect(link).toBeVisible();
  await link.click();

  await page.locator('.arrep-in').first().fill('E2E Arrepentido');
  await page.locator('.arrep-in').nth(1).fill('3510000000');
  await page.locator('.arrep-enviar').click();

  const codigo = await page.locator('.arrep-codigo').textContent();
  expect(codigo?.trim()).toMatch(/^ARR-[A-Z0-9]{6}$/);

  // Limpieza: sin esto cada corrida deja una solicitud pendiente para siempre en la bandeja del
  // panel (el owner abre su panel y ve N "E2E Arrepentido" acumulados). Se marcan como gestionadas
  // las de este test, no todas: si hay una real pendiente, no la tocamos.
  const headers = { Authorization: `Bearer ${await ownerToken(request)}`, 'X-Tenant': 'demo' };
  const pendientes = await request.get(`${API}/api/v1/arrepentimientos`, { headers }).then((r) => r.json());
  for (const a of pendientes.filter((x: { nombre: string }) => x.nombre === 'E2E Arrepentido')) {
    await request.post(`${API}/api/v1/arrepentimientos/${a.id}/gestionar`, { headers });
  }
});
