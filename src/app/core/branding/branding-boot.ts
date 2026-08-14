/**
 * Marca cacheada del club, para pintar en el arranque. **Este módulo entra al bundle inicial**, así
 * que a propósito no tiene dependencias ni matemática de color: el caché guarda las variables CSS
 * ya resueltas (`{'--court': '#e0392b', …}`, ver `applyTenantColors` en ./tenant-colors) y acá solo
 * se vuelven a escribir. Todo el cálculo (contraste, rampa de PrimeNG) queda en los chunks lazy que
 * de verdad lo necesitan.
 */

/** Una clave por club Y plantilla: namespacing preventivo, no una corrección de un bug observado hoy.
 *  Se anticipa a que la tinta legible de este camino (panel/login) empiece a variar por plantilla,
 *  como ya varía en ClubStore.applyBranding para la landing (ver decidirTinta() en ./tenant-colors).
 *  Hoy ningún caller de este módulo pasa una plantilla real: los tres cachean bajo 'A' fijo (ver
 *  PLANTILLA_PANEL en branding.service.ts) porque `BrandingService.apply()` calcula siempre con la
 *  tinta default, sin importar la plantilla del tenant. El día que eso cambie, esta clave ya está
 *  lista para separar los buckets sin tocar este archivo de nuevo. */
export const brandingCacheKey = (slug: string, plantilla: string) =>
  `padel_branding_${slug}_${plantilla}`;

/*
 * OJO Plan 2 — ventana de tinta incorrecta conocida (preexistente, no la introduce este módulo): la
 * landing es RenderMode.Server y `ClubStore.applyBranding` corre en el server, así que el HTML
 * servido ya trae `--ink-on-accent` correcto para la plantilla del tenant. Pero `app.config.ts` llama
 * a `aplicarMarcaCacheada()` en TODO arranque de la app, sin mirar la ruta — así que al hidratar en
 * el cliente pisa esas variables con las cacheadas acá por el panel/login, calculadas con la tinta
 * default (no la de la plantilla real). Para un tenant en plantilla oscura eso es tinta incorrecta
 * hasta que `ClubStore.applyBranding` vuelve a correr en el cliente. Alcanza sólo a quien entró al
 * panel de SU club en el mismo navegador (los únicos que escriben esta clave, ver PLANTILLA_PANEL) y
 * después visita su propia landing pública. Un solo bucket antes de este task, el mismo bucket
 * renombrado a `_A` ahora: no es una regresión de este cambio.
 */

/** Variables CSS ya resueltas + el logo, tal como quedaron la última vez que se aplicó la marca. */
export interface MarcaCacheada {
  vars: Record<string, string>;
  logoUrl: string | null;
}

export function leerMarcaCacheada(slug: string, plantilla: string): MarcaCacheada | null {
  try {
    const raw = localStorage.getItem(brandingCacheKey(slug, plantilla));
    return raw ? (JSON.parse(raw) as MarcaCacheada) : null;
  } catch {
    return null; // JSON corrupto o storage bloqueado: seguimos con el color base.
  }
}

export function guardarMarcaCacheada(slug: string, plantilla: string, marca: MarcaCacheada): void {
  try {
    localStorage.setItem(brandingCacheKey(slug, plantilla), JSON.stringify(marca));
  } catch {
    /* storage lleno o deshabilitado: el caché es un lujo, no rompemos por esto. */
  }
}

/**
 * Escribe los colores de la última marca conocida. Se llama en el arranque de la app: el área admin
 * es client-render (depende de localStorage para el JWT) y no tiene, como la landing, un HTML del
 * server con la marca ya escrita — sin esto pinta el color de plataforma y salta al del club recién
 * cuando contesta la API.
 */
export function aplicarMarcaCacheada(root: CSSStyleDeclaration, slug: string, plantilla: string): void {
  const marca = leerMarcaCacheada(slug, plantilla);
  if (!marca?.vars) return;
  for (const [prop, valor] of Object.entries(marca.vars)) root.setProperty(prop, valor);
}
