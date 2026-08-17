import { Page, APIRequestContext, expect } from '@playwright/test';

export const API = 'http://localhost:8095';
export const RESERVA_URL = 'http://demo.localhost:4400/';
export const OWNER = { email: 'owner@padelhub.com', password: 'padel123' };

/**
 * Todos los tenants que la suite toca. `demo` es el de siempre; los otros cuatro los provisiona
 * `plantillas.spec.ts` por la API de plataforma si no existen. Vive acá y no en el teardown porque
 * es la respuesta a "¿en qué bases escribe esta suite?", y esa pregunta la va a tener cualquiera.
 */
export const TENANTS_E2E: readonly { slug: string; email: string; password: string }[] = [
  { slug: 'demo', email: OWNER.email, password: OWNER.password },
  { slug: 'acepadel', email: 'owner@acepadel.com', password: 'padel123' },
  { slug: 'costapadel', email: 'owner@costapadel.com', password: 'padel123' },
  { slug: 'urbanpadel', email: 'owner@urbanpadel.com', password: 'padel123' },
  { slug: 'solpadel', email: 'owner@solpadel.com', password: 'padel123' },
];

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
  // El botón se ata a signals que sólo se actualizan una vez hidratado el SSR; rellenamos y
  // reintentamos hasta que se habilita, para no clickear un botón deshabilitado por timing.
  const confirm = page.locator('.confirm');
  await expect(async () => {
    await page.locator('#email').fill(OWNER.email);
    await page.locator('#password').fill(OWNER.password);
    await expect(confirm).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await confirm.click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
}

/** Desde el panel, navega a la pantalla de Agenda (config) por el nav link (client-side). */
export async function gotoAgenda(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Configurar agenda' }).click();
  await expect(page).toHaveURL(/\/admin\/config/, { timeout: 10_000 });
}

/** Una fecha futura (YYYY-MM-DD) para no chocar con slots ya pasados. Se arma con la fecha
 *  LOCAL: con toISOString() (UTC), de noche en UTC-3 el día ya cambió y quedaba corrida en +1
 *  respecto de los chips Hoy/Mañana del panel. */
export function futureDate(days = 5): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Elige el primer día de la semana con un slot libre y lo clickea, dejando visible el paso de
 *  canchas. De noche "Hoy" puede no tener turnos restantes (el horario demo cierra 23:00), así que
 *  no se puede asumir el primer chip; y la grilla se re-renderiza al recargar disponibilidad, así
 *  que el click se reintenta hasta que el slot quede estable y aparezcan sus canchas (mismo patrón
 *  que sena.spec). */
export async function elegirDiaYSlot(page: Page): Promise<void> {
  // El último chip ("Otra") no es un día: abre el datepicker inline y su overlay taparía los slots.
  const dias = page.locator('.days .chip', { hasNot: page.locator('.c-label', { hasText: 'Otra' }) });
  const slot = page.locator('.times .slot:not([disabled])').first();
  const n = await dias.count();
  let diasConSlots = 0;
  for (let i = 0; i < n; i++) {
    await dias.nth(i).click();
    // waitFor y no isVisible(): isVisible no espera (devuelve el estado del momento).
    const hay = await slot.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false);
    if (!hay) continue;
    diasConSlots++;
    try {
      await expect(async () => {
        await slot.click({ timeout: 2_000 });
        await expect(page.locator('.ccard.any')).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 10_000 });
      return;
    } catch {
      // La grilla del día quedó vacía tras el refresh: probar el siguiente día.
    }
  }
  // Los dos modos de falla salen por el mismo lado del bucle, y confundirlos ya costó horas: con
  // "no hay slots" se buscó agotamiento de datos durante una sesión entera cuando lo que pasaba era
  // que el paso de cancha no se dibujaba. Si hubo slots, el problema no son los datos.
  if (diasConSlots > 0) {
    throw new Error(
      `hubo slots libres en ${diasConSlots} día(s) pero el paso de cancha nunca apareció. ` +
        'Causa conocida: el club tiene autoasignacion=true y el flujo saltea ese paso ' +
        '(PUT /api/v1/agenda/autoasignacion {"autoasignacion":false} lo restaura). ' +
        'Si no es eso, el selector .ccard.any cambió.',
    );
  }
  throw new Error('ningún día de la semana tiene slots libres');
}
