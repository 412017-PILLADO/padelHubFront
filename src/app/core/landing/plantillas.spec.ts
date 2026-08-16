import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CODIGOS_CON_SHELL,
  CODIGOS_PLANTILLA,
  DIR_SHELL,
  FUENTES_PLATAFORMA,
  PLANTILLAS,
  normalizarPlantilla,
  shellDePlantilla,
  urlFuentes,
} from './plantillas';

/**
 * Lee un archivo fuente del repo. La ruta va desde la raíz del proyecto y NO relativa a este spec:
 * el builder bundlea los specs a un temporal antes de correrlos, así que `import.meta.url` apunta
 * al bundle y no al árbol de fuentes. Si algún día el runner cambia de cwd, esto TIRA (ENOENT) en
 * vez de quedarse verde en silencio, que es lo que se quiere de un test que existe para vigilar.
 */
function leerFuente(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

/**
 * Último valor declarado para una custom property en una hoja, o null si la hoja no la declara.
 * El `\\s*:` es lo que evita que `--ink` matchee `--ink-dim` / `--ink-on-accent`, y lo que hace que
 * los `var(--ink)` (uso, no declaración) no cuenten.
 */
function declaracionCss(css: string, prop: string): string | null {
  const hits = [...css.matchAll(new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'g'))];
  return hits.length ? hits[hits.length - 1][1].trim() : null;
}

/**
 * ¿Es clara esta tinta? Promedio de canales sobre el medio del rango: alcanza y sobra para separar
 * `#11162b` de `#eef2f8` sin traer acá la fórmula WCAG (que vive en core/branding y se testea allá).
 *
 * Sólo entiende `#rrggbb`. Con cualquier otra forma (`rgb(...)`, `#eef`, un `color-mix()`) el
 * `parseInt` da NaN y toda comparación con NaN es false — o sea que devolvería 'oscura' calladita.
 * Por eso quien la llama afirma primero la FORMA (ver el `toMatch` más abajo): un tripwire que puede
 * pasar en falso no vigila nada.
 */
function esClara(hex: string): boolean {
  const num = parseInt(hex.trim().replace('#', ''), 16);
  return (((num >> 16) & 255) + ((num >> 8) & 255) + (num & 255)) / 3 > 127;
}

/* La carpeta de la cáscara de cada código ya no se escribe acá: sale de `DIR_SHELL`, que exporta el
   registry. Vivía como copia local y era la segunda de dos copias (la otra estaba en
   `booking/contrato-flow.spec.ts`), con el agravante de que la puerta del contrato --flow-* se
   saltea en silencio a la cáscara que no figure en su lista. */

describe('registry de plantillas', () => {
  it('tiene las cinco plantillas con datos completos', () => {
    expect(CODIGOS_PLANTILLA).toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const codigo of CODIGOS_PLANTILLA) {
      const p = PLANTILLAS[codigo];
      expect(p.nombre.length).toBeGreaterThan(0);
      expect(p.fuentes.length).toBeGreaterThan(0);
      expect(['light', 'dark']).toContain(p.esquema);
    }
  });

  it('B es la única oscura', () => {
    const oscuras = CODIGOS_PLANTILLA.filter((c) => PLANTILLAS[c].esquema === 'dark');
    expect(oscuras).toEqual(['B']);
  });

  it('E reusa el par tipográfico de B (no agrega fuentes al catálogo)', () => {
    expect(PLANTILLAS.E.fuentes).toEqual(PLANTILLAS.B.fuentes);
  });

  it('lo que el catálogo no conoce cae en la DEFAULT, que hoy es C', () => {
    // La default dejó de ser A el 2026-08-16 (spec de la plantilla C básica, §5.1). Este test es el
    // que lo dice: si alguien la mueve de vuelta sin querer, acá se entera.
    expect(normalizarPlantilla('Z')).toBe('C');
    expect(normalizarPlantilla(null)).toBe('C');
    expect(normalizarPlantilla('')).toBe('C');
    expect(normalizarPlantilla(undefined)).toBe('C');
  });

  it('un código que existe pero no tiene cáscara también cae en C', () => {
    // 'D' está en el catálogo (el back la acepta) y no tiene cáscara: se dibuja la default.
    expect(shellDePlantilla('D')).toBe('C');
    expect(shellDePlantilla(null)).toBe('C');
  });

  it('C se llama Básica y no Tarjeta', () => {
    // El nombre viejo describía una plantilla de cards apiladas que el owner descartó. Ofrecerle al
    // dueño "Tipo app, para el pulgar" y darle otra cosa era el problema que abrió esta fase.
    expect(PLANTILLAS.C.nombre).toBe('Básica');
    expect(PLANTILLAS.C.descripcion).toBe('Sobria, el color justo');
  });

  it('arma la URL de Google Fonts con todas las familias', () => {
    const url = urlFuentes(['Anton', 'Inter Tight']);
    expect(url).toContain('family=Anton');
    expect(url).toContain('family=Inter+Tight');
    expect(url).toContain('display=swap');
  });

  /**
   * Este es el test caro del archivo: va a LEER `src/index.html`, saca el `href` del `<link>` de
   * css2 y lo pinea contra el registry. Se lee el archivo en vez de copiar la URL en un literal
   * porque una copia sólo pinea la copia: editando el `<link>` el test seguía verde, que es
   * exactamente el escenario que tiene que atajar ahora que `fuentes.ts` está descableado y esto es
   * lo único que vigila las tipografías. Si alguien toca los ejes de `urlFuentes`, o las familias de
   * la plantilla A, o la línea del HTML, salta.
   *
   * Ojo con "simplificar" los ejes a `wght@400;500;600;700;800` para todas las familias: Archivo es
   * variable con eje de ANCHO además del de peso, y `.display { font-stretch: 125% }` en
   * styles.scss vive de eso. Pidiendo sólo `wght`, Google devuelve `font-stretch: 100%` y el
   * display de toda plantilla que viva del trío de plataforma adelgaza.
   */
  it('la URL del trío de plataforma es, textual, la del <link> de index.html', () => {
    const html = leerFuente('src/index.html');
    const link = html.match(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
    expect(link).not.toBeNull(); // si el <link> de fuentes desapareció del HTML, esto avisa
    const enIndexHtml = link![1];

    expect(urlFuentes(FUENTES_PLATAFORMA)).toBe(enIndexHtml);
    // Hoy la plantilla A usa el mismo trío; si el rediseño la separa, este expect es el aviso.
    expect(urlFuentes(PLANTILLAS.A.fuentes)).toBe(enIndexHtml);
  });

  it('pide de cada familia sólo los pesos que Google publica', () => {
    // Anton tiene un único peso y Space Mono sólo 400/700: pedirles 500;600;800 devuelve 200 pero
    // sin esas caras, así que la URL queda mintiendo. Se piden exactos.
    expect(urlFuentes(['Anton'])).toContain('family=Anton:wght@400&');
    expect(urlFuentes(['Space Mono'])).toContain('family=Space+Mono:wght@400;700&');
  });

  it('sin familias no arma una URL vacía de css2', () => {
    expect(urlFuentes([])).toBe('');
  });

  /**
   * `normalizarPlantilla` contesta "¿existe?" y `shellDePlantilla` "¿qué puedo dibujar?". Un tenant
   * en D existe (el back ya acepta los cinco códigos) pero todavía no tiene cáscara, así que se
   * dibuja con la default (C desde el 2026-08-16) — y el host tiene que publicar 'C', no 'D', o el
   * `:host([data-tpl='C'])` no engancha.
   */
  it('las plantillas sin cáscara se dibujan con la default', () => {
    expect(CODIGOS_CON_SHELL).toEqual(['A', 'B', 'C', 'E']);
    expect(normalizarPlantilla('D')).toBe('D');
    expect(shellDePlantilla('D')).toBe('C');
    expect(shellDePlantilla('E')).toBe('E'); // E ya tiene cáscara propia
    expect(shellDePlantilla('b')).toBe('B');
    expect(shellDePlantilla('Z')).toBe('C');
    expect(shellDePlantilla(null)).toBe('C');
  });

  /** Todo código con cáscara tiene su carpeta en el mapa, y al revés: es la misma fuente. */
  it('el mapa de carpetas y la lista de códigos con cáscara son la misma cosa', () => {
    expect(Object.keys(DIR_SHELL)).toEqual([...CODIGOS_CON_SHELL]);
  });

  it('todo código con cáscara es un código del catálogo', () => {
    for (const codigo of CODIGOS_CON_SHELL) expect(CODIGOS_PLANTILLA).toContain(codigo);
  });

  /**
   * El `esquema` del registry NO es una etiqueta decorativa: es la única afirmación que el catálogo
   * hace sobre la colorimetría de una cáscara, y la galería del panel la muestra. Tiene que decir lo
   * que la cáscara PINTA hoy, no lo que va a pintar.
   *
   * Por eso el test no compara contra una constante: va a leer la hoja de cada cáscara y mide la
   * luminancia de su `--ink`. Tinta clara ⇒ la cáscara es oscura, y al revés. Si la hoja no declara
   * `--ink`, la cáscara hereda la tinta global de styles.scss (y entonces es clara, como la
   * plataforma). El día que alguien vuelva la B a fondo claro sin tocar el registry, esto salta.
   *
   * (Antes este test pineaba un campo `inkHex` del registry, que viajaba hasta `decidirTinta()` para
   * elegir el texto sobre el color del club. Ese campo se fue: ese texto cae sobre el acento, no
   * sobre la superficie, así que la cáscara no tenía nada que decidir ahí — ver tenant-colors.ts.)
   */
  it.each(CODIGOS_CON_SHELL)(
    'el esquema de la plantilla %s coincide con la tinta que pinta su cáscara',
    (codigo) => {
      const tintaGlobal = declaracionCss(leerFuente('src/styles.scss'), '--ink');
      expect(tintaGlobal).not.toBeNull(); // si styles.scss dejó de declararla, este test miente

      const hoja = leerFuente(`src/app/features/landing/shells/${DIR_SHELL[codigo]}/shell.scss`);
      const tintaQuePinta = declaracionCss(hoja, '--ink') ?? tintaGlobal!;

      // La forma ANTES de la luminancia: `esClara()` sólo lee `#rrggbb` y con cualquier otra cosa
      // devuelve false por NaN, lo que dejaría este test verde por la rama equivocada. Si mañana una
      // cáscara declara `--ink: rgb(238,242,248)`, `#eef` o un `color-mix()`, queremos que ESTO falle
      // y no que el tripwire se apague en silencio.
      expect(tintaQuePinta).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PLANTILLAS[codigo].esquema).toBe(esClara(tintaQuePinta) ? 'dark' : 'light');
    }
  );
});
