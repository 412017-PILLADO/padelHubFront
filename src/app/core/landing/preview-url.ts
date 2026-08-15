import { environment } from '../../../environments/environment';
import { currentTenantSlug, tenantSubdomain } from '../tenant/tenant';

/**
 * Lo que el preview pisa de la marca del tenant. El secundario es opcional a propósito: sin él gana
 * el que el club tenga guardado, que es lo correcto cuando el dueño no lo tocó.
 */
export interface OpcionesPreview {
  readonly plantilla: string;
  readonly color: string;
  readonly colorSec?: string | null;
}

/**
 * El `src` del iframe de preview de la galería del panel, armado a partir del href donde está
 * corriendo el panel.
 *
 * NO ES UN `/?plantilla=…` RELATIVO, y la diferencia no es cosmética. El tenant se resuelve por
 * SUBDOMINIO (`core/tenant/tenant.ts`) y la ruta '' sólo matchea la landing del club cuando hay uno
 * (`tenantHostMatch`):
 *
 *   producción · `costapadel.padel-hub.com.ar/admin` → `/` es la landing del club     ✔
 *   desarrollo · `localhost:4400/admin`              → `/` es la landing de MARKETING ✘
 *
 * Así que el host de destino sale de `currentTenantSlug()`, que en el apex cae al fallback de
 * desarrollo. En producción da el mismo host y el iframe queda same-origin igual que pide la spec;
 * en desarrollo apunta al subdominio y es cross-origin, cosa que no molesta: el panel sólo lo
 * MUESTRA —no lee ni scriptea adentro— y la landing es pública, sin cookies ni auth de por medio.
 *
 * Es una función PURA y recibe el href en vez de leer `location`: así los dos hosts se prueban sin
 * levantar nada, que es lo único que convierte esta trampa en una puerta.
 */
export function urlPreviewLanding(
  origen: string,
  opciones: OpcionesPreview,
  dominioBase: string = environment.baseDomain,
): string {
  const base = new URL(origen);
  const host = tenantSubdomain(base.hostname, dominioBase)
    ? base.hostname
    : `${currentTenantSlug(base.hostname, dominioBase)}.${dominioBase}`;

  const url = new URL(`${base.protocol}//${host}${base.port ? `:${base.port}` : ''}/`);
  url.searchParams.set('plantilla', opciones.plantilla);
  url.searchParams.set('color', opciones.color);
  if (opciones.colorSec) url.searchParams.set('color2', opciones.colorSec);
  // Apaga el selector flotante de venta: adentro del panel sería un segundo control desincronizado
  // del formulario (ver `club.store.ts` · `previewSinSelector`).
  url.searchParams.set('panel', '1');
  return url.toString();
}
