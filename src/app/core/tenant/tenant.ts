import { inject, REQUEST } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Resolución del tenant del lado del front: el slug sale del subdominio del hostname
 * (`la-cancha.padel-hub.com.ar` → `la-cancha`). Si no hay subdominio real (ej. `localhost`
 * pelado en dev, o el apex), cae a un fallback de desarrollo. El front lo manda al back en
 * el header `X-Tenant`.
 */
const DEV_FALLBACK_SLUG = 'demo';

/**
 * Hostname actual (sin puerto), SSR-safe:
 *  - en el browser sale de `location.hostname`;
 *  - en SSR sale del header `Host` de la request entrante, vía el token `REQUEST` de Angular
 *    (solo se provee cuando la ruta se renderiza con `RenderMode.Server`; en prerender/build
 *    o si por algún motivo no está disponible, `inject(REQUEST)` resuelve `null` → host vacío
 *    → apex → landing de marketing, el fallback más seguro).
 *
 * Debe invocarse dentro de un contexto de inyección (componente, interceptor, guard funcional):
 * es lo que permite que la MISMA función sirva para decidir tenant-vs-marketing tanto en el
 * browser como en el server, sin duplicar lógica de hostname en dos lugares.
 */
function currentHost(): string {
  if (typeof window !== 'undefined') return window.location.hostname;
  const host = inject(REQUEST)?.headers.get('host') ?? '';
  return host.split(':')[0]; // el header Host puede traer ":puerto" (ej. "demo.localhost:4400")
}

/**
 * Subdominio del tenant relativo al dominio base (`environment.baseDomain`: `localhost` en dev,
 * `padel-hub.com.ar` en prod), o `null` si es el apex / `www` / un host fuera del dominio base.
 * Decide qué se muestra en `/`: con subdominio → reserva del tenant; sin subdominio → landing
 * de marketing de Padel-HUB.
 *
 *   demo.padel-hub.com.ar → 'demo'   ·   padel-hub.com.ar → null
 *   demo.localhost        → 'demo'   ·   localhost        → null
 *
 * El dominio base se puede pasar por parámetro, y no es un adorno de testabilidad: con el default
 * de `environment` el comportamiento de PRODUCCIÓN es imposible de verificar desde los tests, que
 * corren con `baseDomain: 'localhost'`. Lo destapó `preview-url.spec.ts`, donde un host de
 * producción daba `null` y el iframe del preview se habría ido a otro host.
 */
export function tenantSubdomain(
  host: string = currentHost(),
  base: string = environment.baseDomain,
): string | null {
  if (!host || host === base || host === `www.${base}`) return null;
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, host.length - base.length - 1);
    return sub && !sub.includes('.') ? sub : null; // un solo nivel de subdominio
  }
  return null;
}

/** Slug para el header `X-Tenant`: el subdominio real, o el fallback de dev en el apex. */
export function currentTenantSlug(
  host: string = currentHost(),
  base: string = environment.baseDomain,
): string {
  return tenantSubdomain(host, base) ?? DEV_FALLBACK_SLUG;
}

/**
 * `canMatch` de la ruta '': con subdominio de tenant (`la-cancha.padel-hub.com.ar`) → la landing de
 * reserva del club. Corre tanto en el browser como en el server (la ruta '' se renderiza con
 * `RenderMode.Server`, ver app.routes.server.ts), así el HTML servido para cada subdominio ya sale
 * con el componente correcto — sin el flash de marketing hasta hidratar y siendo indexable por host.
 * Si no matchea (apex/www), el router sigue con la próxima ruta '' (marketing) en app.routes.ts.
 */
export const tenantHostMatch: CanMatchFn = () => tenantSubdomain() !== null;
