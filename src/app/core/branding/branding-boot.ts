/**
 * Marca cacheada del club, para pintar en el arranque. **Este módulo entra al bundle inicial**, así
 * que a propósito no tiene dependencias ni matemática de color: el caché guarda las variables CSS
 * ya resueltas (`{'--court': '#e0392b', …}`, ver `applyTenantColors` en ./tenant-colors) y acá solo
 * se vuelven a escribir. Todo el cálculo (contraste, rampa de PrimeNG) queda en los chunks lazy que
 * de verdad lo necesitan.
 */

/** Una clave por club Y plantilla: namespacing preventivo, no una corrección de un bug observado hoy.
 *  Hoy el segundo componente es **constante por construcción**, no "constante por ahora": lo que se
 *  cachea es lo que devuelve `applyTenantColors()`, que sale sólo del color del club y no recibe
 *  ningún valor de la cáscara (ver ./tenant-colors) — o sea que no hay nada que pueda hacer variar la
 *  clave. Los callers lo reflejan: los tres pasan 'A' fijo (ver PLANTILLA_PANEL en
 *  branding.service.ts y el initializer de app.config.ts). Un solo bucket, siempre. El parámetro
 *  queda por si algún día el caché guarda algo que sí dependa de la plantilla: ese día se separan los
 *  buckets sin tocar este archivo. */
export const brandingCacheKey = (slug: string, plantilla: string) =>
  `padel_branding_${slug}_${plantilla}`;

/*
 * CERRADA — "ventana de tinta incorrecta" (Plan 2). Se documenta acá porque los documentos del plan
 * la describen como abierta y hay que poder reconciliarlos, NO porque siga viva.
 *
 * Qué era: `app.config.ts` llama a `aplicarMarcaCacheada()` en TODO arranque, sin mirar la ruta, así
 * que al hidratar la landing pisaba el `--ink-on-accent` que el SSR ya había escrito (la landing es
 * RenderMode.Server) con el cacheado acá por el panel/login. Como ese valor se calculaba con la tinta
 * default y no con la de la plantilla del tenant, en una cáscara oscura era tinta incorrecta hasta
 * que `ClubStore.applyBranding` volvía a correr en el cliente.
 *
 * Qué la cerró: el Task B2 sacó la tinta de la cáscara de `decidirTinta`/`inkOnAccent`/
 * `applyTenantColors`. `--ink-on-accent` ya no depende de la plantilla —el texto cae sobre el acento,
 * no sobre la superficie— así que el valor cacheado y el que calcula la landing son el MISMO para un
 * mismo color de club, y pisar uno con el otro es un no-op. Verificado además que ninguna hoja
 * DECLARA `--ink-on-accent`: la única declaración del repo es el `#fff` de base en styles.scss; las
 * cáscaras sólo lo consumen con `var(...)`. No queda ningún camino por el que la plantilla pueda
 * llegar a ese token.
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
