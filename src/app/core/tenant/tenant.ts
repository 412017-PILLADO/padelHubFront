import { environment } from '../../../environments/environment';

/**
 * Resolución del tenant del lado del front: el slug sale del subdominio del hostname
 * (`la-cancha.padel-hub.com.ar` → `la-cancha`). Si no hay subdominio real (ej. `localhost`
 * pelado en dev, o el apex), cae a un fallback de desarrollo. El front lo manda al back en
 * el header `X-Tenant`.
 */
const DEV_FALLBACK_SLUG = 'demo';

/** Hostname actual, SSR-safe (en server/prerender no hay `window`). */
function currentHost(): string {
  return typeof window !== 'undefined' ? window.location.hostname : '';
}

/**
 * Subdominio del tenant relativo al dominio base (`environment.baseDomain`: `localhost` en dev,
 * `padel-hub.com.ar` en prod), o `null` si es el apex / `www` / un host fuera del dominio base.
 * Decide qué se muestra en `/`: con subdominio → reserva del tenant; sin subdominio → landing
 * de marketing de Padel-HUB.
 *
 *   demo.padel-hub.com.ar → 'demo'   ·   padel-hub.com.ar → null
 *   demo.localhost        → 'demo'   ·   localhost        → null
 */
export function tenantSubdomain(host: string = currentHost()): string | null {
  const base = environment.baseDomain;
  if (!host || host === base || host === `www.${base}`) return null;
  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, host.length - base.length - 1);
    return sub && !sub.includes('.') ? sub : null; // un solo nivel de subdominio
  }
  return null;
}

/** Slug para el header `X-Tenant`: el subdominio real, o el fallback de dev en el apex. */
export function currentTenantSlug(host: string = currentHost()): string {
  return tenantSubdomain(host) ?? DEV_FALLBACK_SLUG;
}
