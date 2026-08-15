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
 *    el reporte de la auditoría; arreglarlas pide un token nuevo del contrato `--flow-*`, que toca
 *    todas las cáscaras y no entra en un audit. Lo que SÍ se pinea acá es el anillo de foco: es la única
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

/**
 * LA HOJA DEL FLUJO, que es la que PINTA el botón de confirmar: la cáscara no lo toca por DOM, lo
 * viste por `--flow-cta-edge`. Es la única hoja que este archivo lee de FUERA de `DIR`, y va sin la
 * guardia de `//` a propósito: `booking-flow.scss` los usa (es Sass idiomático en este repo) y de acá
 * se saca una sola cosa muy acotada, el cuerpo de `.confirm`, con un regex que exige la forma.
 */
const HOJA_FLUJO = readFileSync(
  resolve(process.cwd(), 'src/app/features/landing/booking/booking-flow.scss'), 'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

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
 * El anillo de foco: `--anillo-foco: color-mix(in srgb, var(--court) N%, #fff)`.
 *
 * El anillo sale de `--anillo-foco`, token de capa 2, y ya NO de un `:host ::ng-deep :focus-visible`
 * en `shell.scss`: el `:focus-visible` global de `styles.scss` lo consume, así que la cáscara
 * declara el color y no vuelve a escribir la regla. Lo que este spec exige no cambió — cambió de
 * dónde se lee.
 *
 * El `:` pegado en `--anillo-foco\s*:` es lo que evita matchear un token que apenas lo prefije, y
 * `declaracion()` toma la ÚLTIMA declaración: si algún día la cáscara declara el token dos veces
 * (por ejemplo una zona propia, como hace `a-afiche` con su afiche), el que gana en el `:host` es
 * el que este spec tiene que medir.
 */
const ANILLO = colorMix(
  declaracion(HOJA_TOKENS, '--anillo-foco'),
  '_tokens.scss · el valor de `--anillo-foco`',
);

/**
 * El peor club para el contraste es el más CLARO, porque es el que más aclara las superficies:
 * `--paper` y `--surface` se derivan mezclándole el color del club a una base casi negra. Blanco
 * puro es el techo de esa familia, así que fija la cota superior de todas las superficies de B.
 */
const CLUB_PEOR = '#ffffff';

const CONFIRM = /\.confirm\s*\{([^}]*)\}/.exec(HOJA_FLUJO)?.[1] ?? '';
/** El relleno del CTA. Es `var(--court)` crudo, y es la razón por la que el filo tuvo que existir. */
const RELLENO_CTA = declaracion(CONFIRM, 'background');
/** Lo que el flujo hace con el token, o sea que el filo de la cáscara llega de verdad al borde. */
const BORDE_CTA = declaracion(CONFIRM, 'border');

/** El filo tal como lo declara esta cáscara: `<grosor> solid <color>`, o `none`. */
const FILO_DECL = declaracion(HOJA_TOKENS, '--flow-cta-edge');
/**
 * LA RECETA DEL FILO, o `null` si la cáscara declara `none`.
 *
 * El `null` no es un caso degenerado que se pueda saltear: es el estado en el que B estuvo hasta esta
 * tarea, y lo que las cuentas de abajo miden entonces es el RELLENO del botón contra el vidrio —que es
 * literalmente el límite que el botón tiene cuando no dibuja ninguno—. O sea que volver el token a
 * `none` no deja este archivo en verde por falta de datos: lo pone rojo con el 1,02 del club casi
 * negro.
 *
 * OJO CON EL SEGUNDO POLO: en B la mezcla va hacia `var(--ink)`, que acá es CLARO (#eef2f8, declarado
 * en `shell.scss`) y no el oscuro de plataforma. O sea que la misma receta que en A, C y E OSCURECE,
 * acá ACLARA — que es exactamente lo que hace falta sobre un telón nocturno. Es el mismo movimiento
 * que ya hacen los dos acentos de esta cáscara y su anillo de foco.
 */
const FILO = (() => {
  if (FILO_DECL == null || FILO_DECL === 'none') return null;
  const m = /^(\S+)\s+solid\s+(color-mix\(.+\))$/s.exec(FILO_DECL);
  if (!m) throw new Error(
    `b-nocturna/_tokens.scss declara \`--flow-cta-edge: ${FILO_DECL}\`, y este spec sólo sabe medir ` +
    `\`<grosor> solid color-mix(…)\` o \`none\`. Si el filo estrena otra forma, la cuenta que lo ` +
    `audite va acá adentro: el CTA está pintado con el color del club y no lo mide ninguna otra puerta.`);
  const receta = colorMix(m[2], '_tokens.scss · --flow-cta-edge');
  if (receta.a !== 'var(--court)' || receta.b !== 'var(--ink)') throw new Error(
    `el filo de B ya no es el primario arrimado a la tinta de la nocturna, sino ` +
    `\`color-mix(in srgb, ${receta.a} …%, ${receta.b})\`. El techo del 64,21% que este archivo pinea ` +
    `se midió para \`var(--court)\` contra el \`--ink\` de B; con otros polos hay que medirlo de nuevo.`);
  return { grosor: m[1], ...receta };
})();

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
/**
 * EL FILO DEL CTA · el límite visible del botón de confirmar.
 *
 * B ERA "EL CASO DEFENDIBLE" Y LA MEDICIÓN LA DESMINTIÓ, con una sola paleta de las seis. El relleno
 * de `.confirm` es `--court` crudo y el vidrio del panel se DERIVA del mismo club (`--paper` y
 * `--surface` son el club mezclado contra una base casi negra), así que las dos cosas se mueven
 * juntas: con cinco clubes el botón tiene silueta de sobra —teal 4,02 · fucsia 4,85 · amarillo 10,30 ·
 * casi blanco 13,70— y con un club CASI NEGRO el vidrio queda en `#0f141e`, el relleno en `#111111` y
 * el botón desaparece: **1,02:1**, contra el 3:1 que WCAG 1.4.11 le pide al límite de un componente.
 *
 * Es el mismo agujero que A, C y E tenían sobre superficie clara, con el club en el otro extremo del
 * eje: allá lo perdían los clubes pálidos contra el papel, acá lo pierde el oscuro contra el telón. Y
 * es más difícil de ver leyendo la hoja, porque en B el fondo no es una constante — sube y baja con el
 * club, y el peor caso es justo donde relleno y fondo convergen.
 *
 * EL FILO ES EL PRIMARIO ARRIMADO A `--ink`, la misma FORMA que en las otras tres cáscaras y el
 * mismo 50%. Lo que cambia es a dónde tira la tinta: el `--ink` de B es CLARO (#eef2f8), así que la
 * mezcla ACLARA en vez de oscurecer. Eso es lo que hace que una sola frase —"el color del club,
 * arrimado a la tinta de esta plantilla hasta que se lea"— sirva para las cuatro: cada esquema pone su
 * tinta y la mezcla va sola para el lado que hace falta.
 */
describe('plantilla B · el filo del CTA le da al botón de confirmar un límite visible', () => {
  /** Barra de COMPONENTE: un borde no es texto (WCAG 1.4.11). */
  const PISO = 3;
  /** Los cinco extremos del plan más el naranja del demo, que es el club que la plataforma shippea. */
  const CLUBES: [string, string][] = [
    ['teal de plataforma', '#0a8a99'],
    ['naranja del demo', '#f89625'],
    ['fucsia', '#FF2D95'],
    ['amarillo', '#FFD400'],
    ['casi negro', '#111111'],
    ['casi blanco', '#ffffff'],
  ];
  /**
   * El vidrio del panel de reserva, que es la superficie sobre la que el CTA está apoyado. Se saca de
   * `superficiesDe()` por NOMBRE en vez de recalcularlo: si esa receta cambia, este bloque la sigue.
   */
  const vidrioDe = (club: string) => ({
    'el vidrio del panel de reserva': superficiesDe(club)['el vidrio del panel de reserva'],
  });
  /** El filo, o —sin filo— el relleno del propio botón, que es el único límite que le queda. */
  const filoDe = (club: string, pct = FILO?.pct ?? 0): Rgb =>
    FILO == null ? rgb(club) : mezcla(rgb(club), pct, rgb(INK));

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} el CTA llega a 3:1 contra el vidrio del panel`, () => {
      expect(
        porDebajoDe(PISO, filoDe(club), vidrioDe(club)),
        `El botón de confirmar de la B no tiene límite visible con un club ${nombre} (${club}). En la ` +
          `nocturna el relleno del CTA (\`var(--court)\` crudo) y el vidrio del panel se derivan del ` +
          `MISMO color de club, así que con un club oscuro convergen y el botón se funde con el telón. ` +
          `El único token que puede ponerle borde es \`--flow-cta-edge\` en b-nocturna/_tokens.scss.`,
      ).toEqual([]);
    });
  }

  it('el filo NO es decoración: con el club casi negro el CTA no tiene silueta propia', () => {
    // Tripwire al revés, y el hallazgo que trajo a B a este arreglo. Es UNA paleta de las seis y no
    // tres como en las claras, y por eso el test dice cuál: si algún día el vidrio dejara de derivarse
    // del club —o el relleno dejara de ser el color crudo— el filo de B pasaría a ser un adorno y
    // habría que discutirlo. El relleno se LEE de la hoja del flujo para que eso no se afirme de
    // memoria.
    expect(RELLENO_CTA).toBe('var(--court)');
    const sinSilueta = CLUBES
      .filter(([, c]) => contraste(rgb(c), superficiesDe(c)['el vidrio del panel de reserva']) < PISO)
      .map(([nombre]) => nombre);
    expect(sinSilueta).toEqual(['casi negro']);
  });

  it('el 50% está bajo el techo medido, y acá el que ata es el club casi NEGRO', () => {
    // La cota se da vuelta respecto de las cáscaras claras: allá el techo lo pone el club más claro
    // (el que más se parece al papel) y acá el más oscuro (el que más se parece al telón). Con el club
    // casi negro el 3:1 se cruza en N = 64,21%; el 50% queda abajo con margen (4,76) y es el mismo
    // número que declaran las otras cuatro. La DIRECCIÓN importa y es la INVERSA de A/C/E: acá el lado
    // peligroso es el del color crudo también, pero "crudo" significa oscuro y no pálido.
    expect(FILO, 'B no declara filo: no hay techo que pinear').not.toBeNull();
    const vidrioNegro = superficiesDe('#111111')['el vidrio del panel de reserva'];
    expect(contraste(filoDe('#111111', FILO!.pct), vidrioNegro)).toBeGreaterThanOrEqual(PISO);
    expect(contraste(filoDe('#111111', 0.65), vidrioNegro)).toBeLessThan(PISO);
  });

  it('el filo se mezcla contra la tinta CLARA de B, o aclarar sería hundir', () => {
    // El corazón de por qué B no puede copiar el valor de A y C tal cual: si el segundo polo fuera el
    // `--ink` oscuro de plataforma, con un club casi negro el filo se iría MÁS al negro y el 1,02 se
    // volvería peor todavía. `INK` acá se lee de `shell.scss`, que es donde B pisa el token.
    expect(hexDe(HOJA_SHELL, '--ink')).toBe(INK);
    expect(luminancia(rgb(INK))).toBeGreaterThan(0.5);
    expect(FILO?.b).toBe('var(--ink)');
  });

  it('el flujo consume el token, o el filo de la cáscara no llega al botón', () => {
    // Las cuentas de arriba miden un color; esto verifica que ese color se PINTE.
    expect(BORDE_CTA).toBe('var(--flow-cta-edge, none)');
  });
});

describe('plantilla B · el anillo de foco sobrevive a cualquier color de club', () => {
  /** Los cuatro extremos del plan más el blanco, que es el techo de las superficies. */
  const CLUBES: [string, string][] = [
    ['teal de plataforma', '#0a8a99'],
    ['fucsia', '#FF2D95'],
    ['amarillo', '#FFD400'],
    ['casi negro', '#111111'],
    ['casi blanco', '#ffffff'],
  ];
  /** El valor de `--anillo-foco` de `_tokens.scss`, con su % y su segundo término leídos de ahí. */
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
