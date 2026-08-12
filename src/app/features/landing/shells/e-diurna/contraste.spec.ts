import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { inkOnAccent } from '../../../../core/branding/tenant-colors';

/**
 * E es la hermana CLARA de B (spec §6), así que no hereda ninguno de los problemas de la capa
 * oscura — y tiene uno que ninguna plantilla anterior tuvo: **texto sobre el color del club a plena
 * saturación**, en el campo. Este archivo pinea las tres cuentas que deciden si E se puede mostrar a
 * un club cualquiera sin mirar la pantalla:
 *
 *   1. la tinta del campo (`--ink-on-accent`, que NO se calcula acá: se importa la función real);
 *   2. el anillo de foco propio de E, que es la única señal del recorrido por teclado;
 *   3. los bloques suaves del flujo (precio, seña), que son la tinta de acento sobre papel lavado.
 *
 * **Los valores NO están copiados a mano: se leen de las hojas** (y de `tenant-colors.ts`). Es la
 * lección que la fase B pagó cara: una versión de `b-nocturna/contraste.spec.ts` tenía las
 * constantes duplicadas, y entonces revertir un token dejaba los 16 tests en verde — un tripwire que
 * no puede fallar es peor que no tenerlo, porque se lee como cobertura. Acá las cuatro hojas
 * (`shell.scss`, `_tokens.scss`, `_vidrio.scss`, `src/styles.scss`) y el módulo de branding son la
 * fuente: si alguien baja un valor, el número que entra a la fórmula baja con él y el umbral falla.
 *
 * TRES COSAS QUE ESTE ARCHIVO NO PUEDE PROBAR, para que nadie lo lea como cobertura completa:
 *
 * 1. **El radial del secundario sobre el campo.** `.e-campo` es `--court` con un radial del
 *    secundario encima, así que debajo del título hay un degradado y el peor píxel no siempre es el
 *    primario crudo (con fucsia, el título mide 4,03 contra un `#d628a8` del degradé y 5,17 contra
 *    el primario). Eso se mide con píxeles reales, no con aritmética: los números están en el
 *    reporte del Task 8. Lo que se pinea acá es la cota del primario crudo, que es la que decide el
 *    caso peor de la MARCA (que no cae sobre el degradé en ningún ancho medido).
 * 2. **El logo de respaldo de Padel Hub sobre el campo.** Es un PNG (teal `#0490a3` sobre alfa), no
 *    un token: su contraste no sale de ninguna hoja. Medido en el reporte; WCAG 1.4.11 exime los
 *    logotipos, así que es un problema de marca y no de accesibilidad.
 * 3. **El anillo de `.ccard.any`.** Su regla vive en `booking-flow.scss` —hoja compartida— y se capa
 *    a sí misma con un `color-mix(… 45%, transparent)` que el token de la cáscara no puede
 *    atravesar. Medido en el reporte; arreglarlo mueve A, B, C y D.
 */

// ── Lectura de las hojas ─────────────────────────────────────────────────────
const DIR = 'src/app/features/landing/shells/e-diurna';

/**
 * Lee un archivo del repo y le saca los comentarios de bloque. La ruta va desde la raíz del proyecto
 * y NO relativa a este spec: el builder bundlea los specs a un temporal antes de correrlos, así que
 * `import.meta.url` apunta al bundle y no al árbol de fuentes. Si algún día el runner cambia de cwd,
 * esto TIRA (ENOENT) en vez de quedarse verde en silencio, que es lo que se quiere de un tripwire.
 *
 * Los comentarios se borran porque en estas hojas la prosa cita los mismos tokens que el parser
 * busca (`--court`, `--flow-soft-ink-accent`…) y un docblock no puede poder cambiar lo que el test
 * mide. De hecho el comentario de `_tokens.scss` tiene una TABLA con ratios: sin esto, cualquier
 * número de ahí adentro podría colarse en una medición.
 */
function leerArchivo(ruta: string): string {
  return readFileSync(resolve(process.cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Una hoja de estilos, además, no puede tener comentarios `//`: este parser no los saca, así que
 * código comentado con `//` entraría a las mediciones como si estuviera vivo.
 *
 * ORDEN: la guardia corre DESPUÉS de borrar los `/* *\/`. Al revés, un `//` escrito dentro de un
 * comentario de bloque (o una `url(//host/…)`) abortaría el módulo entero y con él todos los tests.
 * El `//` es Sass idiomático en este repo (booking-flow.scss lo usa), así que la guardia tiene que
 * hablar sólo del código que el parser realmente va a leer.
 */
function leerHoja(ruta: string): string {
  const css = leerArchivo(ruta);
  if (/(^|[^:])\/\//.test(css)) throw new Error(`${ruta} tiene comentarios //: el parser sólo saca /* */`);
  return css;
}
const HOJA_SHELL = leerHoja(`${DIR}/shell.scss`);
const HOJA_TOKENS = leerHoja(`${DIR}/_tokens.scss`);
const HOJA_VIDRIO = leerHoja(`${DIR}/_vidrio.scss`);
/** Los tokens de PLATAFORMA: E no declara ni `--paper` ni `--surface` ni `--ink` (spec §5.1). */
const HOJA_PLATAFORMA = leerHoja('src/styles.scss');
/**
 * El módulo de branding se lee SIN la guardia de `//`: es TypeScript y los tiene a montones. No es
 * una hoja de estilos, y de acá se saca una sola cosa muy específica (la receta de `--court-soft`),
 * con un regex que exige la forma completa.
 */
const FUENTE_BRANDING = leerArchivo('src/app/core/branding/tenant-colors.ts');

/** Último valor declarado para una propiedad, o `null`. El `\\s*:` es lo que evita que `--ink`
 *  matchee `--ink-dim`, y que los `var(--ink)` (uso, no declaración) cuenten. */
function declaracion(css: string, prop: string): string | null {
  const hits = [...css.matchAll(new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'g'))];
  return hits.length ? hits[hits.length - 1][1].trim() : null;
}

/** Un `#rrggbb` declarado en la hoja. Tira si la hoja cambió de forma: un `rgb()`, un `#eef` o un
 *  `color-mix()` darían NaN más adelante y el test pasaría en silencio. */
function hexDe(css: string, prop: string): string {
  const v = declaracion(css, prop);
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${prop} no es un #rrggbb literal: ${v}`);
  return v;
}

/**
 * Parsea `color-mix(in srgb, <A> <pct>%, <B>)`. El `(.+)\)` es GOLOSO a propósito: el segundo
 * término puede ser un `var(--ink)` con su propio paréntesis.
 *
 * La bandera `s` no es decorativa: `declaracion()` devuelve todo hasta el `;`, o sea que un valor
 * partido en dos renglones —que es estilo de la casa— llega acá con un salto de línea adentro. Sin
 * `s`, el `.` no lo cruza y el módulo TIRA por un reformateo que no cambió ni un pixel.
 */
function colorMix(decl: string | null, dondeDice: string): { a: string; pct: number; b: string } {
  const m = decl && /color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)/s.exec(decl);
  if (!m) throw new Error(`${dondeDice} ya no es un color-mix(in srgb, A pct%, B): ${decl}`);
  return { a: m[1].trim(), pct: Number(m[2]) / 100, b: m[3].trim() };
}

// ── Las recetas, leídas de las hojas ────────────────────────────────────────
/** Tokens de plataforma sobre los que E se apoya sin declararlos. */
const PAPER = hexDe(HOJA_PLATAFORMA, '--paper');
const SURFACE = hexDe(HOJA_PLATAFORMA, '--surface');
const INK = hexDe(HOJA_PLATAFORMA, '--ink');
const INK_DIM = hexDe(HOJA_PLATAFORMA, '--ink-dim');

/** El vidrio del panel: `$superficie: color-mix(in srgb, var(--surface) N%, transparent)`. */
const VIDRIO = colorMix(declaracion(HOJA_VIDRIO, '\\$superficie'), '_vidrio.scss · $superficie');
/** La tinta de acento de los bloques suaves: `color-mix(in srgb, var(--court) N%, var(--ink))`. */
const SUAVE_ACENTO = colorMix(
  declaracion(HOJA_TOKENS, '--flow-soft-ink-accent'), '_tokens.scss · --flow-soft-ink-accent');
/** `--court-soft`, que NO vive en ninguna hoja: lo escribe `applyTenantColors` en el `<html>`. */
const COURT_SOFT = (() => {
  const m = /--court-soft'\]\s*=\s*`color-mix\(in srgb,\s*\$\{c\}\s*([\d.]+)%,\s*(#[0-9a-f]{3,6})\)`/i
    .exec(FUENTE_BRANDING);
  if (!m) throw new Error('tenant-colors.ts ya no deriva --court-soft con un color-mix literal');
  return { pct: Number(m[1]) / 100, b: m[2] };
})();

/**
 * El anillo de foco: `outline: 2px solid color-mix(in srgb, var(--court) N%, #000)`.
 *
 * El selector va ANCLADO a `:host ::ng-deep :focus-visible` y no a un `:focus-visible` suelto. La
 * razón es la misma que en B: un regex sin anclar toma el PRIMER bloque que matchee, así que una
 * regla dedicada escrita más arriba en la hoja (por ejemplo un `.cal :focus-visible` para el panel
 * del datepicker) repuntaría en silencio lo que este archivo mide, y los tests seguirían verdes
 * midiendo otro anillo. Es el único de los parsers de este archivo que podía fallar en SILENCIO en
 * vez de tirar.
 *
 * `outline\\s*:` con el `:` pegado es lo que evita que matchee `outline-offset:`.
 */
const ANILLO = colorMix(
  /:host\s+::ng-deep\s+:focus-visible\s*\{[^}]*?outline\s*:\s*([^;]+);/.exec(HOJA_SHELL)?.[1] ?? null,
  'shell.scss · el outline del `:host ::ng-deep :focus-visible`',
);

/** El cuerpo del nombre del club en el campo, en px. `1.5rem` con el `font-size: 16px` del `:root`. */
const REM = Number(/:root\s*\{[^}]*font-size\s*:\s*(\d+)px/.exec(HOJA_PLATAFORMA)?.[1] ?? NaN);
function pxDe(css: string, regla: string, dondeDice: string): number {
  const bloque = new RegExp(`${regla}\\s*\\{[^}]*?font-size\\s*:\\s*([^;]+);`).exec(css)?.[1];
  if (!bloque) throw new Error(`${dondeDice} ya no declara font-size`);
  // `1.5rem` o el piso de un `clamp(1.9rem, 6vw, 3.4rem)`: el que manda para el umbral es el MENOR.
  const rems = [...bloque.matchAll(/([\d.]+)rem/g)].map((m) => Number(m[1]));
  const pxs = [...bloque.matchAll(/([\d.]+)px/g)].map((m) => Number(m[1]));
  const todos = [...rems.map((r) => r * REM), ...pxs];
  if (!todos.length || todos.some(Number.isNaN)) throw new Error(`${dondeDice}: font-size ilegible: ${bloque}`);
  return Math.min(...todos);
}
const PX_MARCA = pxDe(HOJA_SHELL, '\\.e-brandname', 'shell.scss · .e-brandname');
const PX_TITULO = pxDe(HOJA_SHELL, '\\.e-title', 'shell.scss · .e-title');

/**
 * Los cinco extremos con los que se juzga el white-label. Los cuatro primeros son los del plan; el
 * blanco es el que fija la cota: sobre superficies CLARAS —que es todo lo que E tiene— el peor club
 * es el más claro, al revés que en B, donde el peor era el casi negro sobre el telón oscuro.
 */
const CLUBES: [string, string][] = [
  ['teal de plataforma', '#0a8a99'],
  ['fucsia', '#FF2D95'],
  ['amarillo', '#FFD400'],
  ['casi negro', '#111111'],
  ['casi blanco', '#ffffff'],
];

// ── Aritmética WCAG ──────────────────────────────────────────────────────────
type Rgb = [number, number, number];

/** `#rgb` o `#rrggbb` a canales. Las hojas escriben las dos formas (`#fff` y `#f4f6fb`). */
function rgb(hex: string): Rgb {
  const c = hex.trim().replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`no es un hex parseable: ${hex}`);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminancia([r, g, b]: Rgb): number {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function contraste(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** `color-mix(in srgb, a <pct>%, b)`: en sRGB es la interpolación lineal de los canales. */
function mezcla(a: Rgb, pct: number, b: Rgb): Rgb {
  return a.map((v, i) => v * pct + b[i] * (1 - pct)) as Rgb;
}
/** `a` con opacidad `alfa` compuesto sobre `b`. Sobre sRGB opaco es la misma cuenta que `mezcla`. */
const sobre = mezcla;

/**
 * Las superficies CLARAS de E para un color de club dado. El vidrio aparece dos veces porque el
 * panel está a caballo del borde del campo (la firma de E, spec §6): la mitad de abajo cae sobre el
 * papel y la de arriba sobre el color del club, y esa segunda es la que cambia con el club.
 */
function superficiesDe(club: string): Record<string, Rgb> {
  return {
    '--paper (el pie y el fondo)': rgb(PAPER),
    '--surface (las tarjetas de info)': rgb(SURFACE),
    'el vidrio sobre el papel (mitad de abajo del panel)': sobre(rgb(SURFACE), VIDRIO.pct, rgb(PAPER)),
    'el vidrio sobre el campo (mitad montada)': sobre(rgb(SURFACE), VIDRIO.pct, rgb(club)),
    'el bloque suave (precio, seña)': mezcla(rgb(club), COURT_SOFT.pct, rgb(COURT_SOFT.b)),
  };
}

/**
 * Devuelve las superficies que NO llegan al umbral, con su ratio. Un `toEqual([])` contra esto dice
 * en el mensaje de error cuál falló y por cuánto; un `toBeGreaterThan` por superficie, no.
 */
function porDebajoDe(umbral: number, tinta: Rgb, fondos: Record<string, Rgb>): string[] {
  return Object.entries(fondos)
    .map(([nombre, fondo]) => [nombre, contraste(tinta, fondo)] as const)
    .filter(([, ratio]) => ratio < umbral)
    .map(([nombre, ratio]) => `${nombre}: ${ratio.toFixed(2)}:1 (<${umbral})`);
}

describe('plantilla E · el texto sobre el campo de color', () => {
  /** El umbral que aplica según el cuerpo: WCAG llama "grande" a >=24px (18pt) — Anton tiene una
   *  sola cara de 400, así que la excepción de 18,66px en bold no está disponible en E. */
  const umbralDe = (px: number) => (px >= 24 ? 3 : 4.5);

  it('el nombre del club es texto GRANDE, que es lo que lo salva con el club teal', () => {
    // No es una preferencia tipográfica: a 17,92px el umbral es 4,5 y el techo del teal es 4,11.
    expect(PX_MARCA).toBeGreaterThanOrEqual(24);
    expect(PX_TITULO).toBeGreaterThanOrEqual(24);
  });

  it('4,11:1 es el TECHO del club teal, no un valor que se pueda subir', () => {
    // Este test existe para que nadie "arregle" el de arriba tocando la tinta: las dos candidatas
    // son blanco y la tinta oscura del sistema, y `inkOnAccent` ya elige la mejor. Si alguna vez
    // este expect falla es porque apareció una tinta mejor — y entonces el cuerpo puede bajar.
    //
    // Lo que se mide acá es LA TINTA ELEGIDA, no el techo físico del teal, y la diferencia importa:
    // sobre el teal CRUDO la tinta oscura da 4,35 —mejor que los 4,11 del blanco—, pero
    // `decidirTinta` puntúa el peor de `--court` y `--court-deep`, y ahí la oscura se cae a 3,13.
    // El campo de E nunca pinta `--court-deep`, así que una tinta específica de superficie plana
    // llegaría a 4,35: sigue debajo de 4,5, o sea que el arreglo por cuerpo hace falta igual.
    // Por eso el expect es `< 4.5` y no `== 4.11`: lo que se afirma es "no alcanza", no un valor.
    const teal = rgb('#0a8a99');
    const conLaTintaElegida = contraste(rgb(inkOnAccent('#0a8a99')), teal);
    expect(conLaTintaElegida).toBeLessThan(4.5);
    expect(conLaTintaElegida).toBeGreaterThanOrEqual(3);
  });

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} la marca y el título pasan su umbral sobre el color crudo`, () => {
      const tinta = rgb(inkOnAccent(club));
      const fondo = { [`el campo (--court crudo, ${club})`]: rgb(club) };
      expect(porDebajoDe(umbralDe(PX_MARCA), tinta, fondo)).toEqual([]);
      expect(porDebajoDe(umbralDe(PX_TITULO), tinta, fondo)).toEqual([]);
    });
  }

  it('la tinta del campo la decide la capa 3 y la cáscara no la pisa', () => {
    // Si `.e-campo` volviera a poner `var(--ink)` —que es lo que decía el andamio— los tests de
    // arriba seguirían midiendo `inkOnAccent` y la pantalla mostraría otra cosa.
    expect(HOJA_SHELL).toMatch(/\.e-campo\s*\{[^}]*color\s*:\s*var\(--ink-on-accent/);
  });
});

describe('plantilla E · el vidrio montado sobre el campo', () => {
  it('la tinta del flujo llega a 4,5:1 sobre la franja de vidrio que muerde el color', () => {
    // Es la firma de E: el encabezado del flujo (`--ink`) cae sobre vidrio apoyado en `--court`, no
    // sobre el color crudo, y por eso la spec §10 no se viola. El que manda es el club casi negro,
    // que es el que más oscurece esa franja. Si alguien baja el alfa del vidrio, esto avisa.
    const fallan = CLUBES
      .map(([n, club]) => [n, contraste(rgb(INK), sobre(rgb(SURFACE), VIDRIO.pct, rgb(club)))] as const)
      .filter(([, r]) => r < 4.5)
      .map(([n, r]) => `${n}: ${r.toFixed(2)}:1`);
    expect(fallan).toEqual([]);
  });
});

describe('plantilla E · el anillo de foco sobrevive a cualquier color de club', () => {
  /** El `outline` del `:focus-visible` de shell.scss, con su % y su segundo término leídos de ahí. */
  const anilloDe = (club: string) => mezcla(rgb(club), ANILLO.pct, rgb(ANILLO.b));
  const peorRatio = (tinta: Rgb, club: string) =>
    Math.min(...Object.values(superficiesDe(club)).map((f) => contraste(tinta, f)));

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} llega a 3:1 sobre las cinco superficies`, () => {
      expect(porDebajoDe(3, anilloDe(club), superficiesDe(club))).toEqual([]);
    });

    it(`con un club ${nombre} nunca es peor que el anillo de plataforma`, () => {
      // El de plataforma (`styles.scss`) es `var(--court)` crudo. Oscurecerlo hacia el negro no
      // puede empeorar ninguna superficie clara: si algún día lo hiciera, la regla de shell.scss
      // estaría rompiendo el caso que venía a arreglar.
      expect(peorRatio(anilloDe(club), club)).toBeGreaterThanOrEqual(peorRatio(rgb(club), club));
    });
  }

  it('con al menos un color de club el anillo de plataforma es invisible', () => {
    // Tripwire al revés: si `var(--court)` crudo pasara 3:1 con los cinco, la excepción de
    // encapsulación de shell.scss se quedaría sin motivo y habría que borrarla. Hoy no pasa: con
    // amarillo da 1,40 sobre el vidrio y con el naranja del demo, 2,19.
    expect(Math.min(...CLUBES.map(([, club]) => peorRatio(rgb(club), club)))).toBeLessThan(3);
  });
});

describe('plantilla E · los bloques suaves del flujo', () => {
  const suaveDe = (club: string) => mezcla(rgb(club), COURT_SOFT.pct, rgb(COURT_SOFT.b));

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} el texto del bloque suave pasa AA (4,5)`, () => {
      // `--flow-soft-ink` (texto corriente de la seña) y `--flow-soft-ink-accent` (el precio y el
      // título de la seña, 12,8-16px en bold: AA pide 4,5, no 3).
      const fondo = { [`--court-soft con ${club}`]: suaveDe(club) };
      expect(porDebajoDe(4.5, rgb(INK_DIM), fondo)).toEqual([]);
      expect(porDebajoDe(4.5, mezcla(rgb(club), SUAVE_ACENTO.pct, rgb(INK)), fondo)).toEqual([]);
    });
  }

  it('el acento del bloque suave sigue siendo el color del club y no la tinta pelada', () => {
    // Arrimarlo a la tinta hasta que se lea es correcto; reemplazarlo por la tinta sería perder el
    // white-label. Con dos clubes de matices opuestos el resultado tiene que seguir siendo distinto.
    const conFucsia = mezcla(rgb('#FF2D95'), SUAVE_ACENTO.pct, rgb(INK));
    const conTeal = mezcla(rgb('#0a8a99'), SUAVE_ACENTO.pct, rgb(INK));
    expect(conFucsia.map(Math.round)).not.toEqual(conTeal.map(Math.round));
    expect(SUAVE_ACENTO.pct).toBeGreaterThan(0.2);
  });
});

/**
 * Las seis recetas que este archivo lee. Si una cambia de FORMA (deja de ser un `color-mix(in
 * srgb, …)`, o `--paper` pasa a `rgb()`), los parsers de arriba tiran al cargar el módulo —
 * ruidoso, que es lo correcto. Este describe cubre el otro caso: que la forma siga siendo la misma
 * pero el término contra el que se mezcla deje de ser el que las fórmulas suponen.
 */
describe('plantilla E · el spec sigue leyendo las hojas que cree leer', () => {
  it('el vidrio del panel es `--surface` con alfa sobre lo que haya atrás', () => {
    expect([VIDRIO.a, VIDRIO.b]).toEqual(['var(--surface)', 'transparent']);
  });

  it('el anillo de foco oscurece el color del club hacia el negro', () => {
    // Si algún día se mezclara hacia otra cosa, los tests de umbral seguirían pasando con el número
    // equivocado: `mezcla(club, pct, negro)` estaría mintiendo. Y el POLO importa: hacia el blanco
    // —que es lo correcto en la nocturna— este anillo desaparecería sobre el papel de E.
    expect([ANILLO.a, ANILLO.b.toLowerCase()]).toEqual(['var(--court)', '#000']);
  });

  it('el acento del bloque suave mezcla el club contra la tinta de la plantilla', () => {
    expect([SUAVE_ACENTO.a, SUAVE_ACENTO.b]).toEqual(['var(--court)', 'var(--ink)']);
  });

  it('el bloque suave es `--court-soft`, que es opaco', () => {
    // Opaco importa: si dejara de serlo, el bloque vería el vidrio del panel debajo y todas las
    // cuentas de este archivo estarían midiendo un fondo que no existe.
    expect(declaracion(HOJA_TOKENS, '--flow-soft-surface')).toBe('var(--court-soft)');
    expect(COURT_SOFT.b.toLowerCase()).toBe('#fff');
  });

  it('E no declara las superficies de plataforma: las consume (spec §5.1)', () => {
    // La capa 2 nunca declara `--court`, y en E tampoco `--paper`/`--surface`/`--ink`: si empezara a
    // hacerlo, los hexes que este archivo lee de `styles.scss` dejarían de ser los que pinta.
    for (const prop of ['--court', '--paper', '--surface', '--ink', '--ink-dim']) {
      expect(declaracion(HOJA_SHELL, prop)).toBeNull();
      expect(declaracion(HOJA_TOKENS, prop)).toBeNull();
    }
  });

  it('el `font-size: 16px` del `:root` es lo que convierte los rem a px', () => {
    expect(REM).toBe(16);
  });
});
