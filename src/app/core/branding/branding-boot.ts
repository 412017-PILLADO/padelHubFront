/**
 * Marca cacheada del club, para pintar en el arranque. **Este módulo entra al bundle inicial**, así
 * que a propósito no tiene dependencias ni matemática de color: el caché guarda las variables CSS
 * ya resueltas (`{'--court': '#e0392b', …}`, ver `applyTenantColors` en ./tenant-colors) y acá solo
 * se vuelven a escribir. Todo el cálculo (contraste, rampa de PrimeNG) queda en los chunks lazy que
 * de verdad lo necesitan.
 */

/** Una clave por club Y plantilla: si el club cambia de plantilla, la marca vieja no se repinta (la
 *  tinta legible depende del esquema claro/oscuro del shell, ver decidirTinta() en ./tenant-colors).
 *  Antes la clave era sólo por club: un club que cambiaba de plantilla clara a oscura (o viceversa)
 *  arriesgaba, en el primer paint de un visitante que vuelve, la tinta de la plantilla vieja hasta
 *  que la API contestaba. */
export const brandingCacheKey = (slug: string, plantilla: string) =>
  `padel_branding_${slug}_${plantilla}`;

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
