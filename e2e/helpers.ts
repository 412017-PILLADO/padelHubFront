import { Page, APIRequestContext, expect } from '@playwright/test';

export const API = 'http://localhost:8090';
export const RESERVA_URL = 'http://demo.localhost:4400/';
export const OWNER = { email: 'owner@padelhub.com', password: 'padel123' };

/** Obtiene un JWT del owner del tenant demo vía la API real. */
export async function ownerToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    headers: { 'X-Tenant': 'demo', 'Content-Type': 'application/json' },
    data: OWNER,
  });
  expect(res.ok(), 'login del owner debería responder 2xx').toBeTruthy();
  const body = await res.json();
  return body.token as string;
}

/**
 * Inicia sesión por la UI y deja al usuario en el panel (/admin). Se loguea por el formulario
 * (no inyectando localStorage) porque las rutas /admin* tienen guard que corre también en SSR:
 * un page.goto directo a una ruta protegida se evalúa en el servidor (sin localStorage) y redirige
 * a login. Tras el login, el router navega client-side y el guard ve el token.
 */
export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.locator('#email').fill(OWNER.email);
  await page.locator('#password').fill(OWNER.password);
  await page.locator('.confirm').click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
}

/** Desde el panel, navega a la pantalla de Agenda (config) por el nav link (client-side). */
export async function gotoAgenda(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Configurar agenda' }).click();
  await expect(page).toHaveURL(/\/admin\/config/, { timeout: 10_000 });
}

/** Una fecha futura (YYYY-MM-DD) para no chocar con slots ya pasados. */
export function futureDate(days = 5): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
