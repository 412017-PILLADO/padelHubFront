import { request as pwRequest } from '@playwright/test';
import { API, TENANTS_E2E, futureDate } from './helpers';

/**
 * Días hacia adelante que se barren, contando desde hoy. Hoy la suite no reserva más allá de
 * hoy+2 (`elegirDiaYSlot` recorre los chips Hoy/Mañana/Pasado, `panel.spec` usa `futureDate(1)` y
 * `reserva-manual.spec` `futureDate(2)`), así que 7 es más del doble de lo necesario: deja margen
 * para una spec nueva que reserve un poco más lejos sin barrer medio calendario ni pagar el costo
 * de decenas de GETs por corrida.
 */
const DIAS_VENTANA = 7;

/**
 * Deja la base como la encontró. La suite crea reservas reales por la UI y ninguna spec las
 * limpia, así que la disponibilidad se iba consumiendo hasta que `panel.spec` y `sena.spec`
 * fallaban por FALTA DE DATOS y no por código — un rojo que no dice nada, que costó horas de
 * diagnóstico y que ya obligó a limpiar la base a mano.
 *
 * Cancela, no borra: el back libera el slot igual y la fila queda como rastro de la corrida.
 *
 * NUNCA tira: un teardown que explota convierte una corrida verde en roja y esconde el resultado
 * real. Todo lo que falla acá se loguea y sigue.
 *
 * OJO en desarrollo: esto cancela TODA reserva futura de esos cinco tenants, incluidas las que
 * hayas creado a mano para un smoke test. Si estás probando algo a mano, corré la suite antes.
 */
async function limpiar(): Promise<void> {
  const ctx = await pwRequest.newContext();
  let cancelados = 0;

  for (const tenant of TENANTS_E2E) {
    const login = await ctx.post(`${API}/api/v1/auth/login`, {
      headers: { 'X-Tenant': tenant.slug, 'Content-Type': 'application/json' },
      data: { email: tenant.email, password: tenant.password },
    });
    // Un tenant que no existe todavía no es un error: la suite pudo correr filtrada y nunca
    // haberlo provisionado.
    if (!login.ok()) continue;
    // En estos dos endpoints el tenant sale del JWT, no del header X-Tenant.
    const auth = { Authorization: `Bearer ${(await login.json()).token as string}` };

    for (let d = 0; d <= DIAS_VENTANA; d++) {
      const res = await ctx.get(`${API}/api/v1/turnos`, {
        headers: auth,
        params: { fecha: futureDate(d) },
      });
      if (!res.ok()) continue;
      // El back ya devuelve sólo los turnos que OCUPAN la cancha (CONFIRMADO y PENDIENTE vigente);
      // el filtro es por si eso cambia, para no pedir la baja de algo ya dado de baja.
      const turnos = (await res.json()) as { id: number; estado: string }[];
      for (const turno of turnos) {
        if (turno.estado === 'CANCELADO') continue;
        const baja = await ctx.post(`${API}/api/v1/turnos/${turno.id}/cancelar`, { headers: auth });
        if (baja.ok()) cancelados++;
      }
    }
  }

  await ctx.dispose();
  console.log(`[teardown] ${cancelados} reserva(s) canceladas`);
}

export default async function globalTeardown(): Promise<void> {
  try {
    await limpiar();
  } catch (e) {
    console.warn('[teardown] no se pudo limpiar:', e);
  }
}
