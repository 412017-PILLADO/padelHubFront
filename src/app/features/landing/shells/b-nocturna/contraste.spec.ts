import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * B es la única plantilla oscura del producto (spec §6). Sus tokens de tinta son fijos —no dependen
 * del color del club—, así que su contraste se puede pinear acá sin browser.
 *
 * **Los valores NO están copiados a mano: se leen de las hojas.** Una versión anterior de este
 * archivo los tenía duplicados, y entonces revertir `--ink-faint` en `shell.scss` dejaba los 16
 * tests en verde — o sea que el tripwire no vigilaba nada, que es el único defecto que un tripwire
 * no puede tener. Ahora las tres hojas (`shell.scss`, `_tokens.scss`, `_vidrio.scss`) son la fuente:
 * si alguien baja un token, el número que entra a la fórmula baja con él y el umbral falla.
 * Es el mismo patrón con el que `core/landing/plantillas.spec.ts` pinea el registry contra las hojas.
 *
 * DOS COSAS QUE ESTE ARCHIVO NO PUEDE PROBAR, para que nadie lo lea como cobertura completa:
 *
 * 1. **El acento contra la superficie.** `--court` es del club, no de la cáscara. Con un club casi
 *    negro las reglas que usan `var(--court)` CRUDO dentro del panel (el numerito del paso, el
 *    ícono del check de éxito, el borde del aviso de seña) caen a ~1,05:1. Está medido y anotado en
 *    el reporte de la auditoría; arreglarlas pide un token nuevo del contrato `--flow-*`, que toca las
 *    tres cáscaras y no entra en un audit. Lo que SÍ se pinea acá es el anillo de foco: es la única
 *    de ese grupo que vive en la capa de B y por lo tanto se puede arreglar y proteger desde adentro.
 * 2. **El pie sobre el resplandor inferior.** El telón levanta el fondo del pie por encima de
 *    `--paper`, y cuánto depende del secundario del club. Eso se mide con pixeles reales, no con
 *    aritmética de tokens (números en el reporte).
 */

// ── Lectura de las hojas ─────────────────────────────────────────────────────
const DIR = 'src/app/features/landing/shells/b-nocturna';

/**
 * Lee una hoja del repo y le saca los comentarios. La ruta va desde la raíz del proyecto y NO
 * relativa a este spec: el builder bundlea los specs a un temporal antes de correrlos, así que
 * `import.meta.url` apunta al bundle y no al árbol de fuentes. Si algún día el runner cambia de cwd,
 * esto TIRA (ENOENT) en vez de quedarse verde en silencio, que es lo que se quiere de un tripwire.
 *
 * Los comentarios se borran porque en estas hojas la prosa cita los mismos tokens que el parser
 * busca (`--line-strong`, `--court`…) y un docblock no puede poder cambiar lo que el test mide.
 *
 * ORDEN: primero se borran los `/* *\/` y RECIÉN AHÍ se busca un `//`. Al revés —como estaba— un
 * `//` escrito DENTRO de un comentario de bloque (o una `url(//host/…)`) abortaba el módulo entero
 * y con él los 16 tests. El `//` es Sass idiomático en este repo (booking-flow.scss lo usa), así
 * que la guardia tiene que hablar sólo del código que el parser realmente va a leer.
 */
function leerHoja(archivo: string): string {
  const css = readFileSync(resolve(process.cwd(), DIR, archivo), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/(^|[^:])\/\//.test(css)) throw new Error(`${archivo} tiene comentarios //: el parser sólo saca /* */`);
  return css;
}
const HOJA_SHELL = leerHoja('shell.scss');
const HOJA_TOKENS = leerHoja('_tokens.scss');
const HOJA_VIDRIO = leerHoja('_vidrio.scss');

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
 * término puede ser un `var(--surface)` con su propio paréntesis.
 *
 * La bandera `s` no es decorativa: `declaracion()` devuelve todo hasta el `;`, o sea que un valor
 * partido en dos renglones —que es estilo de la casa, `_tokens.scss` los escribe así— llega acá con
 * un salto de línea adentro. Sin `s`, el `.` no lo cruza y el módulo TIRA por un reformateo que no
 * cambió ni un pixel.
 */
function colorMix(decl: string | null, dondeDice: string): { a: string; pct: number; b: string } {
  const m = decl && /color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)/s.exec(decl);
  if (!m) throw new Error(`${dondeDice} ya no es un color-mix(in srgb, A pct%, B): ${decl}`);
  return { a: m[1].trim(), pct: Number(m[2]) / 100, b: m[3].trim() };
}

// ── Las tintas y las recetas de superficie, leídas de las hojas ──────────────
const INK = hexDe(HOJA_SHELL, '--ink');
const INK_DIM = hexDe(HOJA_SHELL, '--ink-dim');
const INK_FAINT = hexDe(HOJA_SHELL, '--ink-faint');
/** `--paper: color-mix(in srgb, var(--court) N%, <base oscura>)`. */
const PAPER = colorMix(declaracion(HOJA_SHELL, '--paper'), 'shell.scss · --paper');
/** `--surface`, misma forma. */
const SURFACE = colorMix(declaracion(HOJA_SHELL, '--surface'), 'shell.scss · --surface');
/** `--line-strong: color-mix(in srgb, #fff N%, transparent)`, el borde de chips y horarios. */
const LINE_STRONG = colorMix(declaracion(HOJA_SHELL, '--line-strong'), 'shell.scss · --line-strong');
/** El vidrio del panel: `$superficie: color-mix(in srgb, var(--surface) N%, transparent)`. */
const VIDRIO = colorMix(declaracion(HOJA_VIDRIO, '\\$superficie'), '_vidrio.scss · $superficie');
/** El bloque suave: `--flow-soft-surface: color-mix(in srgb, var(--court) N%, var(--surface))`. */
const SUAVE = colorMix(declaracion(HOJA_TOKENS, '--flow-soft-surface'), '_tokens.scss · --flow-soft-surface');
/**
 * El anillo de foco: `outline: 2px solid color-mix(in srgb, var(--court) N%, #fff)`.
 *
 * El selector va ANCLADO a `:host ::ng-deep :focus-visible` y no a un `:focus-visible` suelto. La
 * razón: la salida documentada en shell.scss —para cuando el empate con el foco propio de PrimeNG
 * se dé vuelta— es una regla dedicada `.cal :focus-visible` que vuelve a oscurecer el anillo sobre
 * el panel blanco del datepicker. Un regex sin anclar toma el PRIMER bloque que matchee: si esa
 * regla se escribiera más arriba en la hoja, este spec pasaría a medir el anillo del calendario
 * contra las superficies oscuras de B y seguiría verde. Es el único de los parsers de este archivo
 * que podía fallar en SILENCIO en vez de tirar.
 */
const ANILLO = colorMix(
  /:host\s+::ng-deep\s+:focus-visible\s*\{[^}]*?outline\s*:\s*([^;]+);/.exec(HOJA_SHELL)?.[1] ?? null,
  'shell.scss · el outline del `:host ::ng-deep :focus-visible`',
);

/**
 * El peor club para el contraste es el más CLARO, porque es el que más aclara las superficies:
 * `--paper` y `--surface` se derivan mezclándole el color del club a una base casi negra. Blanco
 * puro es el techo de esa familia, así que fija la cota superior de todas las superficies de B.
 */
const CLUB_PEOR = '#ffffff';

// ── Aritmética WCAG ──────────────────────────────────────────────────────────
type Rgb = [number, number, number];

/** `#rgb` o `#rrggbb` a canales. Las hojas escriben las dos formas (`#fff` y `#07090f`). */
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

/** Las superficies de B para un color de club dado, con las recetas leídas de las hojas. */
function superficiesDe(club: string): Record<string, Rgb> {
  const paper = mezcla(rgb(club), PAPER.pct, rgb(PAPER.b));
  const surface = mezcla(rgb(club), SURFACE.pct, rgb(SURFACE.b));
  return {
    '--paper (el telón)': paper,
    '--surface (chips, horarios, recap)': surface,
    'el vidrio del panel de reserva': sobre(surface, VIDRIO.pct, paper),
    'el bloque suave (seña, check, precio)': mezcla(rgb(club), SUAVE.pct, surface),
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

describe('plantilla B · contraste de la capa oscura', () => {
  /** Las tres superficies fijas de B en su versión más clara. El bloque suave no es fija: depende
   *  del club, y con un club claro se va a gris medio (ver el reporte). */
  const PEOR = (() => {
    const { ['el bloque suave (seña, check, precio)']: _suave, ...fijas } = superficiesDe(CLUB_PEOR);
    return fijas;
  })();

  it('la tinta principal supera 7:1 (AAA para texto normal) en las tres superficies', () => {
    expect(porDebajoDe(7, rgb(INK), PEOR)).toEqual([]);
  });

  it('la tinta secundaria supera 4.5:1 (AA para texto normal) en las tres superficies', () => {
    expect(porDebajoDe(4.5, rgb(INK_DIM), PEOR)).toEqual([]);
  });

  it('la tinta terciaria supera 4.5:1: no lleva sólo captions, también `.step-hint`', () => {
    // El brief la pineaba en 3:1 ("captions y el © del pie"). No alcanza: `--ink-faint` también
    // pinta `.step-hint`, que es un <p> de texto corrido ("Elegí el horario para ver las canchas"),
    // y las etiquetas de fecha de los chips. Texto chico → AA pide 4.5. El token se subió de
    // #8b95ab (4,45:1 sobre `--surface`) a #8d97ad para llegar; el umbral no se bajó.
    expect(porDebajoDe(4.5, rgb(INK_FAINT), PEOR)).toEqual([]);
  });

  it('la escalera de tintas no se aplana: ink > ink-dim > ink-faint', () => {
    // Subir un token para pasar un umbral no puede comerse la jerarquía que hace legible la página.
    const [ink, dim, faint] = [INK, INK_DIM, INK_FAINT].map((h) => luminancia(rgb(h)));
    expect([ink > dim, dim > faint]).toEqual([true, true]);
  });

  it('`--line-strong` llega a 3:1: es lo único que identifica a chips y horarios', () => {
    // Sus rellenos son `--surface`, que contra el vidrio del panel da ~1,02:1 — el borde de 1px es
    // el único límite visible del control (WCAG 1.4.11). Al 24% daba 2,17:1.
    const fallan = Object.entries(PEOR)
      .map(([nombre, fondo]) => [nombre, contraste(sobre(rgb(LINE_STRONG.a), LINE_STRONG.pct, fondo), fondo)] as const)
      .filter(([, ratio]) => ratio < 3)
      .map(([nombre, ratio]) => `${nombre}: ${ratio.toFixed(2)}:1`);
    expect(fallan).toEqual([]);
  });
});

/**
 * Las siete recetas que este archivo le lee a las hojas. Si una cambia de FORMA (deja de ser un
 * `color-mix(in srgb, …)`, o `--ink` pasa a `rgb()`), los parsers de arriba tiran al cargar el
 * módulo — ruidoso, que es lo correcto. Este describe cubre el otro caso: que la forma siga siendo
 * la misma pero el término contra el que se mezcla deje de ser el que las fórmulas suponen.
 */
describe('plantilla B · el spec sigue leyendo las hojas que cree leer', () => {
  it('`--paper` y `--surface` mezclan el color del club contra una base oscura literal', () => {
    // Las fórmulas de acá asumen que el club entra como primer término y la base es un hex opaco.
    expect([PAPER.a, SURFACE.a]).toEqual(['var(--court)', 'var(--court)']);
    expect([PAPER.b, SURFACE.b].every((b) => /^#[0-9a-f]{6}$/i.test(b))).toBe(true);
  });

  it('el vidrio del panel es `--surface` con alfa sobre el papel', () => {
    expect([VIDRIO.a, VIDRIO.b]).toEqual(['var(--surface)', 'transparent']);
  });

  it('el bloque suave es el color del club sobre `--surface`', () => {
    expect([SUAVE.a, SUAVE.b]).toEqual(['var(--court)', 'var(--surface)']);
  });

  it('`--line-strong` y el anillo de foco se mezclan hacia el blanco', () => {
    // Si algún día se mezclaran hacia otra cosa, los dos tests de umbral seguirían pasando con el
    // número equivocado: `sobre(rgb(LINE_STRONG.a), …)` y `mezcla(…, blanco)` estarían mintiendo.
    expect(LINE_STRONG.a.toLowerCase()).toBe('#fff');
    expect([ANILLO.a, ANILLO.b.toLowerCase()]).toEqual(['var(--court)', '#fff']);
    expect(LINE_STRONG.b).toBe('transparent');
  });
});

/**
 * El anillo de foco es la única regla de acento-sobre-superficie que vive en la capa de B
 * (`shell.scss`), así que es la única que se puede proteger desde acá. Sin él, un club casi negro
 * deja el recorrido por teclado sin ninguna señal: 1,02:1, un halo negro sobre fondo negro.
 */
describe('plantilla B · el anillo de foco sobrevive a cualquier color de club', () => {
  /** Los cuatro extremos del plan más el blanco, que es el techo de las superficies. */
  const CLUBES: [string, string][] = [
    ['teal de plataforma', '#0a8a99'],
    ['fucsia', '#FF2D95'],
    ['amarillo', '#FFD400'],
    ['casi negro', '#111111'],
    ['casi blanco', '#ffffff'],
  ];
  /** El `outline` del `:focus-visible` de shell.scss, con su % y su segundo término leídos de ahí. */
  const anilloDe = (club: string) => mezcla(rgb(club), ANILLO.pct, rgb(ANILLO.b));
  const peorRatio = (tinta: Rgb, club: string) =>
    Math.min(...Object.values(superficiesDe(club)).map((f) => contraste(tinta, f)));

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} llega a 3:1 sobre las cuatro superficies`, () => {
      expect(porDebajoDe(3, anilloDe(club), superficiesDe(club))).toEqual([]);
    });

    it(`con un club ${nombre} nunca es peor que el anillo de plataforma`, () => {
      // El de plataforma (`styles.scss`) es `var(--court)` crudo. Aclararlo hacia el blanco no puede
      // empeorar ninguna de las cuatro superficies: si algún día lo hiciera, la regla de shell.scss
      // estaría rompiendo el caso que venía a arreglar.
      expect(peorRatio(anilloDe(club), club)).toBeGreaterThanOrEqual(peorRatio(rgb(club), club));
    });
  }

  it('con al menos un color de club el anillo de plataforma es invisible', () => {
    // Tripwire al revés: si `var(--court)` crudo pasara 3:1 con los cinco, la excepción de
    // encapsulación de shell.scss se quedaría sin motivo y habría que borrarla.
    expect(Math.min(...CLUBES.map(([, club]) => peorRatio(rgb(club), club)))).toBeLessThan(3);
  });
});
