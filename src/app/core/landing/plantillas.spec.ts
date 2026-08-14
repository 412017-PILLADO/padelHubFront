import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CODIGOS_CON_SHELL,
  CODIGOS_PLANTILLA,
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

/** Carpeta de la cáscara de cada código con shell, para ir a leer su hoja real. */
const DIR_SHELL: Readonly<Record<string, string>> = {
  A: 'a-afiche',
  B: 'b-nocturna',
  C: 'c-tarjeta',
};

describe('registry de plantillas', () => {
  it('tiene las cinco plantillas con datos completos', () => {
    expect(CODIGOS_PLANTILLA).toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const codigo of CODIGOS_PLANTILLA) {
      const p = PLANTILLAS[codigo];
      expect(p.nombre.length).toBeGreaterThan(0);
      expect(p.fuentes.length).toBeGreaterThan(0);
      expect(['light', 'dark']).toContain(p.esquema);
      expect(p.inkHex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('B es la única oscura', () => {
    const oscuras = CODIGOS_PLANTILLA.filter((c) => PLANTILLAS[c].esquema === 'dark');
    expect(oscuras).toEqual(['B']);
  });

  it('E reusa el par tipográfico de B (no agrega fuentes al catálogo)', () => {
    expect(PLANTILLAS.E.fuentes).toEqual(PLANTILLAS.B.fuentes);
  });

  it('normaliza cualquier basura a la plantilla A', () => {
    expect(normalizarPlantilla('b')).toBe('B');
    expect(normalizarPlantilla('Z')).toBe('A');
    expect(normalizarPlantilla(null)).toBe('A');
    expect(normalizarPlantilla('')).toBe('A');
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
   * display de las tres plantillas adelgaza.
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
   * dibuja con la A — y el host tiene que publicar 'A', no 'D', o el `:host([data-tpl='A'])` de
   * landing.scss no engancha y el afiche pierde su clamp de viewport.
   */
  it('las plantillas sin cáscara se dibujan con la A', () => {
    expect(CODIGOS_CON_SHELL).toEqual(['A', 'B', 'C']);
    expect(normalizarPlantilla('D')).toBe('D');
    expect(shellDePlantilla('D')).toBe('A');
    expect(shellDePlantilla('E')).toBe('A');
    expect(shellDePlantilla('b')).toBe('B');
    expect(shellDePlantilla('Z')).toBe('A');
    expect(shellDePlantilla(null)).toBe('A');
  });

  it('todo código con cáscara es un código del catálogo', () => {
    for (const codigo of CODIGOS_CON_SHELL) expect(CODIGOS_PLANTILLA).toContain(codigo);
  });

  /**
   * El `inkHex` del registry NO es una preferencia estética: `ClubStore.applyBranding()` se lo pasa
   * a `applyTenantColors()`, que con él decide si el texto sobre el color del club va blanco o va
   * `var(--ink)`. O sea que tiene que ser la tinta que la cáscara PINTA hoy, no la que va a pintar.
   *
   * Mentirle es un bug de contraste, no un detalle: con la B declarada clara mientras su hoja sigue
   * en `color: var(--ink)`, un club con primario claro (#FFD400) pasaba de 8.31:1 a 1.43:1 —
   * blanco sobre amarillo— en chips, slots seleccionados y los botones de seña.
   *
   * Por eso el test no compara contra una constante: va a leer la hoja de cada cáscara. Si la hoja
   * no declara `--ink`, la cáscara hereda la tinta global de styles.scss. El día que
   * `b-nocturna/shell.scss` se vuelva oscura de verdad y declare la suya, este test falla y le
   * recuerda a alguien que hay que volver `PLANTILLAS.B.inkHex` a INK_CLARA.
   */
  it.each(CODIGOS_CON_SHELL)(
    'el inkHex de la plantilla %s es la tinta con la que pinta su cáscara',
    (codigo) => {
      const tintaGlobal = declaracionCss(leerFuente('src/styles.scss'), '--ink');
      expect(tintaGlobal).not.toBeNull(); // si styles.scss dejó de declararla, este test miente

      const hoja = leerFuente(`src/app/features/landing/shells/${DIR_SHELL[codigo]}/shell.scss`);
      const tintaQuePinta = declaracionCss(hoja, '--ink') ?? tintaGlobal!;

      expect(PLANTILLAS[codigo].inkHex.toLowerCase()).toBe(tintaQuePinta.toLowerCase());
    }
  );
});
