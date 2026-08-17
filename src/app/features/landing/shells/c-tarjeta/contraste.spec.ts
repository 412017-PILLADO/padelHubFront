import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * LA AUDITORÍA DE CONTRASTE DE C, la básica. Cuatro cuentas, cada una pineada contra la hoja que la
 * declara:
 *
 *   1. EL FILO DEL CTA. `.confirm` es `background: var(--court)` crudo apoyado sobre el `--paper` de
 *      la página, y con tres de las seis paletas de la casa el control más importante del producto no
 *      tiene NINGUNA silueta contra su propia superficie (naranja del demo 2,07 · amarillo 1,32 ·
 *      casi blanco 1,08, contra el 3:1 que WCAG 1.4.11 le pide al límite de un componente).
 *   2. EL LOMO, que es la firma de C (ver el comentario largo junto a `--c-lomo-color` en
 *      shell.scss): la banda vertical del color del club, arrimada a la tinta hasta un piso medido de
 *      3:1 contra el papel con las seis paletas.
 *   3. QUE EL COLOR NO SEA MASA (spec §6.1): la hoja no puede llenar ninguna superficie grande con
 *      `--court`, y capa 2 no puede declarar ningún `--court*` propio — eso es trabajo de plataforma.
 *   4. LA TINTA DEL BLOQUE SUAVE (precio, aviso de seña): hasta esta tarea usaba `--court-deep`
 *      crudo y caía abajo de AA con cuatro de las seis paletas.
 *
 * Este archivo nació midiendo sólo el filo del CTA (los tres primeros describes de abajo son de esa
 * tarea) y esta tarea lo completa: hoy es la auditoría entera de C, no queda ninguna superficie propia
 * sin medir. Desde la Task 4 la cáscara es UNA SOLA COLUMNA sobre `--paper`, sin rail ni ninguna otra
 * caja de fondo — el `:host` es la única superficie que la hoja declara, así que el texto corriente y
 * el anillo de foco caen exactamente en el caso que `src/styles.spec.ts` ya mide contra las seis
 * paletas. Lo que ese archivo NO puede ver es lo que C pinta específicamente con el color del club, y
 * eso es lo que miden las cuatro cuentas de acá.
 *
 * **Los valores no están copiados a mano**: se leen de `_tokens.scss`, de `shell.scss`, del relleno
 * del botón en la hoja del flujo, de los hexes del `:root` de plataforma y de `tenant-colors.ts` (de
 * ahí sale `--court-soft`, que no vive en ninguna hoja de esta carpeta: lo escribe
 * `applyTenantColors` en tiempo de ejecución). Es la lección que la fase B pagó cara —una versión de
 * su `contraste.spec.ts` tenía las constantes duplicadas, y entonces revertir un token dejaba los
 * tests en verde: un tripwire que no puede fallar es peor que no tenerlo, porque se lee como
 * cobertura.
 *
 * La aritmética WCAG está duplicada de los otros cuatro `contraste.spec.ts` a propósito, igual que
 * ellos la duplican entre sí: cada uno lee SUS hojas y no depende de un helper que otro pueda
 * cambiar. Si algún día se saca a un módulo compartido, hay que mover los cinco a la vez.
 */

// ── Lectura de las hojas ─────────────────────────────────────────────────────
const DIR = 'src/app/features/landing/shells/c-tarjeta';

/**
 * Lee un archivo del repo y le saca los comentarios de bloque. La ruta va desde la raíz del proyecto
 * y NO relativa a este spec: el builder bundlea los specs a un temporal antes de correrlos, así que
 * `import.meta.url` apuntaría al bundle y no al árbol de fuentes. Si algún día el runner cambia de
 * cwd, esto TIRA (ENOENT) en vez de quedarse verde en silencio, que es lo que se quiere.
 *
 * Los comentarios se borran porque la prosa de estas hojas cita los mismos tokens que el parser busca
 * y tiene TABLAS de ratios adentro: sin esto, un número escrito en un docblock podría colarse en una
 * medición.
 */
function leerArchivo(ruta: string): string {
  return readFileSync(resolve(process.cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Una hoja, además, no puede tener comentarios `//`: este parser no los saca, así que código
 *  comentado con `//` entraría a las mediciones como si estuviera vivo. La guardia corre DESPUÉS de
 *  borrar los `/* *\/`, si no un `//` adentro de un comentario abortaría el módulo entero. */
function leerHoja(ruta: string): string {
  const css = leerArchivo(ruta);
  if (/(^|[^:])\/\//.test(css)) throw new Error(`${ruta} tiene comentarios //: el parser sólo saca /* */`);
  return css;
}
const HOJA_TOKENS = leerHoja(`${DIR}/_tokens.scss`);
const HOJA_SHELL = leerHoja(`${DIR}/shell.scss`);
/** Los tokens de PLATAFORMA: C no declara ninguno (spec §5.1), los consume. */
const HOJA_PLATAFORMA = leerHoja('src/styles.scss');
/**
 * La hoja del flujo, que es la que PINTA el CTA: la cáscara no lo toca por DOM. Va por `leerArchivo`
 * y no por `leerHoja` porque `booking-flow.scss` usa comentarios `//`, que son Sass idiomático en
 * este repo; de acá sólo se saca el cuerpo de `.confirm`, con un regex que exige la forma.
 */
const HOJA_FLUJO = leerArchivo('src/app/features/landing/booking/booking-flow.scss');

/** Último valor declarado para una propiedad, o `null`. El `\\s*:` es lo que evita que `--court`
 *  matchee `--court-soft`, que `border` matchee `border-radius`, y que los `var(--court)` (uso, no
 *  declaración) cuenten. */
function declaracion(css: string, prop: string): string | null {
  const hits = [...css.matchAll(new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'g'))];
  return hits.length ? hits[hits.length - 1][1].trim() : null;
}

/** Un `#rrggbb` declarado en la hoja. Tira si cambió de forma: un `rgb()` o un `color-mix()` darían
 *  NaN más adelante y el test pasaría en silencio. */
function hexDe(css: string, prop: string): string {
  const v = declaracion(css, prop);
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${prop} no es un #rrggbb literal: ${v}`);
  return v;
}

/**
 * Parsea `color-mix(in srgb, <A> <pct>%, <B>)`. El `(.+)\)` es GOLOSO a propósito: el segundo término
 * puede ser un `var(--ink)` con su propio paréntesis. La bandera `s` no es decorativa: un valor
 * partido en dos renglones —que es estilo de la casa— llega acá con un salto de línea adentro.
 */
function colorMix(decl: string | null, dondeDice: string): { a: string; pct: number; b: string } {
  const m = decl && /color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)/s.exec(decl);
  if (!m) throw new Error(`${dondeDice} ya no es un color-mix(in srgb, A pct%, B): ${decl}`);
  return { a: m[1].trim(), pct: Number(m[2]) / 100, b: m[3].trim() };
}

const PAPER = hexDe(HOJA_PLATAFORMA, '--paper');
const INK = hexDe(HOJA_PLATAFORMA, '--ink');

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
 * El `null` no es un caso degenerado que se pueda saltear: es el estado en el que C estuvo hasta esta
 * tarea, y lo que las cuentas de abajo miden entonces es el RELLENO del botón contra el papel —que es
 * literalmente el límite que el botón tiene cuando no dibuja ninguno—. O sea que volver el token a
 * `none` no deja este archivo en verde por falta de datos: lo pone rojo con 2,07 · 1,32 · 1,08.
 *
 * Sólo se sabe resolver la forma que tiene sentido acá; cualquier otra TIRA con el valor adentro del
 * mensaje. Un `#e11d48` a mano o una receta inventada tienen que hacer ruido y no colarse por una
 * rama que las mida mal.
 */
const FILO = (() => {
  if (FILO_DECL == null || FILO_DECL === 'none') return null;
  const m = /^(\S+)\s+solid\s+(color-mix\(.+\))$/s.exec(FILO_DECL);
  if (!m) throw new Error(
    `c-tarjeta/_tokens.scss declara \`--flow-cta-edge: ${FILO_DECL}\`, y este spec sólo sabe medir ` +
    `\`<grosor> solid color-mix(…)\` o \`none\`. Si el filo estrena otra forma, la cuenta que lo ` +
    `audite va acá adentro: el CTA está pintado con el color del club y no lo mide ninguna otra puerta.`);
  const receta = colorMix(m[2], 'c-tarjeta/_tokens.scss · --flow-cta-edge');
  if (receta.a !== 'var(--court)' || receta.b !== 'var(--ink)') throw new Error(
    `el filo de C ya no es el primario arrimado a la tinta de la página, sino ` +
    `\`color-mix(in srgb, ${receta.a} …%, ${receta.b})\`. El techo del 50% que este archivo pinea se ` +
    `midió para \`var(--court)\` contra \`var(--ink)\`; con otros polos hay que medirlo de nuevo.`);
  return { grosor: m[1], ...receta };
})();

/**
 * Las seis paletas de la casa, las mismas de `src/styles.spec.ts` y de los otros cuatro
 * `contraste.spec.ts`. Acá el que ata el techo es el **casi blanco**: sobre superficie clara el peor
 * club es el que más se parece al papel.
 */
const CLUBES: [string, string][] = [
  ['teal de plataforma', '#0a8a99'],
  ['naranja del demo', '#f89625'],
  ['amarillo', '#FFD400'],
  ['fucsia', '#FF2D95'],
  ['casi negro', '#111111'],
  ['casi blanco', '#ffffff'],
];

/** El mínimo de WCAG 1.4.11 para componentes de interfaz. El borde de un botón es uno. */
const UMBRAL = 3;

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
/**
 * `color-mix(in srgb, a <pct>%, b)`: en sRGB es la interpolación lineal de los canales, REDONDEADA a
 * 8 bits por canal antes de devolver — que es lo que el navegador pinta de verdad (un canal de color
 * no tiene fracciones de más). El redondeo no es cosmética: sin él, el lomo mide 3,2668:1 contra el
 * papel con el club casi blanco (→3,27); redondeando antes de medir mide 3,2605:1 (→3,26), que es el
 * número que documenta shell.scss junto al 50% de `--c-lomo-color`. Sin este redondeo el pin de acá y
 * el comentario de la hoja discreparían por 0,01 sin que nadie supiera por qué.
 */
function mezcla(a: Rgb, pct: number, b: Rgb): Rgb {
  return a.map((v, i) => Math.round(v * pct + b[i] * (1 - pct))) as Rgb;
}

/** Las superficies que NO llegan al umbral, con su ratio. Un `toEqual([])` contra esto dice en el
 *  mensaje cuál falló y por cuánto; un `toBeGreaterThan` por superficie, no. */
function porDebajoDe(umbral: number, tinta: Rgb, fondos: Record<string, Rgb>): string[] {
  return Object.entries(fondos)
    .map(([nombre, fondo]) => [nombre, contraste(tinta, fondo)] as const)
    .filter(([, ratio]) => ratio < umbral)
    .map(([nombre, ratio]) => `${nombre}: ${ratio.toFixed(2)}:1 (<${umbral})`);
}

/**
 * EL LÍMITE VISIBLE DEL CTA para un club dado, resuelto desde lo que declara la cáscara.
 *
 * Con filo es el color del filo; SIN filo es el relleno del propio botón, porque cuando no hay borde
 * el límite del componente ES el canto del relleno y eso es exactamente lo que WCAG 1.4.11 mide. Esa
 * rama es la que hace que este archivo tenga puerta y no sólo documentación.
 */
const filoDe = (club: string, pct = FILO?.pct ?? 0): Rgb =>
  FILO == null ? rgb(club) : mezcla(rgb(club), pct, rgb(INK));

describe('plantilla C · el filo del CTA le da al botón de confirmar un límite visible', () => {
  /**
   * La única superficie que el filo toca por afuera. C no le pone caja al flujo
   * (`--flow-surface: transparent`) y su `:host` es `--paper`, así que el botón está apoyado
   * directamente sobre el papel de la página. Desde la Task 4 la cáscara es una sola columna sin
   * rail: no queda ninguna otra superficie de fondo en la hoja, así que el papel es la única cota.
   */
  const PAPEL = { 'el papel de la página (:host)': rgb(PAPER) };

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} el CTA llega a 3:1 contra el papel de la página`, () => {
      expect(
        porDebajoDe(UMBRAL, filoDe(club), PAPEL),
        `El botón de confirmar de la C no tiene límite visible con un club ${nombre} (${club}). ` +
          `\`.confirm\` es \`background: var(--court)\` a sangre sobre el papel de la página, y el ` +
          `único token que puede ponerle borde es \`--flow-cta-edge\` en c-tarjeta/_tokens.scss: la ` +
          `cáscara no toca el CTA por DOM. WCAG 1.4.11 pide 3:1 para el límite de un componente.`,
      ).toEqual([]);
    });
  }

  it('el filo NO es decoración: sin él, 3 de las 6 paletas dejan al CTA sin silueta', () => {
    // Tripwire al revés, y el que justifica el archivo entero. El relleno se LEE de la hoja del
    // flujo: los tres números sólo valen mientras siga siendo el color CRUDO del club, así que si
    // alguien lo cambia esto se cae en vez de seguir citando una tabla de memoria. Y si algún día el
    // relleno pasara 3:1 con las seis, el filo pasaría a ser un adorno y habría que discutirlo.
    expect(RELLENO_CTA).toBe('var(--court)');
    const sinFilo = CLUBES.map(([, c]) => contraste(rgb(c), rgb(PAPER)));
    expect(sinFilo.filter((r) => r < UMBRAL).length).toBeGreaterThanOrEqual(3);
  });

  it('el 50% es un TECHO medido: el peor primario posible es el BLANCO', () => {
    // El primario se arrima a la tinta hasta que se lea, y el que ata es el más CLARO —el que más se
    // parece al papel—: `color-mix(#fff N%, --ink)` cruza el 3:1 contra `--paper` en N = 51,72%. 50 es
    // ese techo redondeado hacia abajo. Subirlo deja sin filo a los clubes de primario claro; bajarlo
    // apaga el matiz del club sin necesidad. La DIRECCIÓN importa: sobre superficie clara el lado
    // peligroso es el del color crudo, no el de la tinta, así que un test que sólo mirara "que no baje
    // de 3" no diría nada sobre qué lado hay que cuidar.
    expect(FILO, 'C no declara filo: no hay techo que pinear').not.toBeNull();
    expect(contraste(filoDe('#ffffff', FILO!.pct), rgb(PAPER))).toBeGreaterThanOrEqual(UMBRAL);
    expect(contraste(filoDe('#ffffff', 0.52), rgb(PAPER))).toBeLessThan(UMBRAL);
  });

  it('el filo no depende del secundario: en C el secundario es acento puntual (spec §6)', () => {
    // Dos motivos, y los dos importan. Uno es de rol: la spec le da al secundario de C acento
    // PUNTUAL, no estructura —el filo del CTA es de D—, así que un borde derivado del secundario le
    // daría acá un trabajo que no le toca. El otro es de robustez: `--court-2` sólo existe si el club
    // lo cargó (`applyTenantColors` lo BORRA del `:root` cuando no lo hay) y el tenant demo de la
    // plataforma no tiene, así que una receta con secundario necesita una rama de degradación. Con el
    // primario ese caso no existe en vez de estar resuelto.
    expect(FILO_DECL).not.toContain('--court-2');
  });

  it('el flujo consume el token, o el filo de la cáscara no llega al botón', () => {
    // Las cuentas de arriba miden un color; esto verifica que ese color se PINTE. Si `.confirm`
    // volviera a `border: none` fijo —como estaba antes de que el token existiera—, C podría declarar
    // el filo más contrastado del mundo y el botón seguiría a sangre.
    expect(BORDE_CTA).toBe('var(--flow-cta-edge, none)');
  });

  it('el spec sigue leyendo la superficie que C pinta de verdad', () => {
    // Toda la aritmética supone que el botón está apoyado sobre `--paper`: que el flujo no tiene caja
    // propia y que el host de la cáscara es el papel. Si C le diera superficie al flujo —una tarjeta
    // blanca, por ejemplo— el filo caería sobre otra cosa y estos números medirían un fondo que no se
    // pinta. (Blanco sería MÁS fácil, pero el que avisa tiene que ser el test y no la suerte.)
    // Desde la Task 5 (el lomo) `background` SÍ se declara dos veces en la hoja: la de `:host` (el
    // papel) y la del degradado de `:host::before` (la banda del borde). El `declaracion` genérico
    // toma el ÚLTIMO valor del archivo entero, así que hay que acotarlo al bloque `:host { … }` solo
    // —sin nested `{}` adentro, así que el primer `}` cierra el bloque— para seguir leyendo la
    // superficie que el botón pisa, y no el degradado del lomo.
    const HOST_BLOCK = /:host\s*\{([^}]*)\}/.exec(HOJA_SHELL)?.[1] ?? '';
    expect(declaracion(HOJA_TOKENS, '--flow-surface')).toBe('transparent');
    expect(declaracion(HOST_BLOCK, 'background')).toBe('var(--paper)');
    expect(/:host\s*\{[^}]*background:\s*var\(--paper\)/.test(HOJA_SHELL)).toBe(true);
  });

  it('C no declara los tokens de plataforma: los consume (spec §5.1)', () => {
    // Si la cáscara empezara a declarar `--paper` o `--ink`, los hexes que este archivo lee de
    // `styles.scss` dejarían de ser los que pinta. B los pisa —su esquema es nocturno— y C no.
    for (const prop of ['--paper', '--surface', '--ink', '--court']) {
      expect(declaracion(HOJA_SHELL, prop)).toBeNull();
      expect(declaracion(HOJA_TOKENS, prop)).toBeNull();
    }
  });
});

// ── El resto de la auditoría: el lomo, la masa y el bloque suave ────────────────────────────────

/**
 * El módulo de branding se lee SIN la guardia de `//`: es TypeScript y los tiene a montones, así que
 * pasa por `leerArchivo` y no por `leerHoja`. No es una hoja de estilos, y de acá se saca una sola
 * cosa muy específica (la receta de `--court-soft`), con un regex que exige la forma completa.
 */
const FUENTE_BRANDING = leerArchivo('src/app/core/branding/tenant-colors.ts');

/** Un derivado del color del club que NO vive en ninguna hoja de esta carpeta: lo escribe
 *  `applyTenantColors` en tiempo de ejecución, no una hoja que este spec pueda leer con `leerHoja`. */
function derivadoDelClub(prop: string): { pct: number; b: string } {
  const m = new RegExp(`${prop}'\\]\\s*=\\s*\`color-mix\\(in srgb,\\s*\\$\\{c\\}\\s*([\\d.]+)%,\\s*(#[0-9a-f]{3,6})\\)\``, 'i')
    .exec(FUENTE_BRANDING);
  if (!m) throw new Error(`tenant-colors.ts ya no deriva ${prop} con un color-mix literal`);
  return { pct: Number(m[1]) / 100, b: m[2] };
}
/** `--flow-soft-surface: var(--court-soft)` en _tokens.scss: el fondo del bloque suave es el color
 *  del club lavado, `color-mix(in srgb, <club> 12%, #fff)`. */
const COURT_SOFT = derivadoDelClub('--court-soft');

/**
 * Las seis paletas de la casa, en hex plano. Son las mismas de `.superpowers/sdd/medir-lomo-c.mjs`
 * —el script que midió el 50% de `--c-lomo-color`— y no la tupla `CLUBES` de más arriba: esa tupla se
 * armó para el filo del CTA con otros ejemplos de "naranja" y "casi blanco" (`#f89625`/`#ffffff`). El
 * hex exacto que representa a cada matiz no importa —ninguna de las seis es una cuenta de
 * producción, son extremos del white-label—, pero el 3,26 que documenta shell.scss se midió con
 * ÉSTOS, así que hay que usar los mismos para que el pin de acá y el comentario de la hoja sigan de
 * acuerdo.
 */
const SEIS_CLUBES = ['#0a8a99', '#f97316', '#ffd400', '#fafafa', '#111111', '#ff2d95'];

describe('C · el lomo, que es la firma', () => {
  /** `--c-lomo-color: color-mix(in srgb, var(--court) N%, var(--ink))`, leído de la hoja. */
  const LOMO = colorMix(declaracion(HOJA_SHELL, '--c-lomo-color'), 'shell.scss · --c-lomo-color');

  it('se ve con las SEIS paletas, incluida la del club casi blanco', () => {
    // Es la restricción dura de la plantilla: si el lomo desaparece, C se queda sin lo único que la
    // hace C. Le pasó al campo de la plantilla D con este mismo club y la hundió.
    for (const club of SEIS_CLUBES) {
      const r = contraste(mezcla(rgb(club), LOMO.pct, rgb(INK)), rgb(PAPER));
      expect(r, `el lomo desaparece con el club ${club}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('el porcentaje de la hoja es un TECHO: cinco puntos más y se cae', () => {
    // Sin esto el test de arriba pasaría con cualquier valor conservador, y nadie se enteraría de
    // que el lomo perdió color de más. Acá se afirma que el valor elegido está en el límite: al 55%
    // el peor caso (casi blanco) mide 2,83:1, ya debajo del piso de WCAG 1.4.11.
    const peorMas = Math.min(
      ...SEIS_CLUBES.map((c) => contraste(mezcla(rgb(c), LOMO.pct + 0.05, rgb(INK)), rgb(PAPER))),
    );
    expect(peorMas, 'el porcentaje no está en el techo: se puede subir sin romper').toBeLessThan(3);
  });

  it('el lomo NO se dibuja con el color crudo del club', () => {
    // La forma de romper esto sin querer es "simplificar" el color-mix a un var(--court) pelado.
    expect(declaracion(HOJA_SHELL, '--c-lomo-color')).toContain('color-mix');
    expect(declaracion(HOJA_SHELL, '--c-lomo-color')).not.toMatch(/^\s*var\(--court\)\s*$/);
  });
});

describe('C · el color no es masa (spec §6.1)', () => {
  it('la hoja no llena ninguna superficie grande con el color del club', () => {
    // Es EL contrato que separa a C de E. Las únicas apariciones de --court en la hoja de C son el
    // lomo y su degradado; si aparece un `background: var(--court)` a secas, C se volvió otra cosa.
    expect(HOJA_SHELL).not.toMatch(/background:\s*var\(--court\)\s*;/);
  });

  it('C declara su superficie y su tinta, y NUNCA un --court* (capa 2)', () => {
    expect(HOJA_SHELL).not.toMatch(/^\s*--court[a-z0-9-]*\s*:/m);
  });
});

describe('C · la tinta del bloque suave, que estaba abajo de AA', () => {
  /** `--flow-soft-ink-accent: color-mix(in srgb, var(--court) N%, var(--ink))`, leído de la hoja. */
  const SUAVE_INK = colorMix(
    declaracion(HOJA_TOKENS, '--flow-soft-ink-accent'), '_tokens.scss · --flow-soft-ink-accent');

  it('llega a 4,5:1 con las seis paletas', () => {
    // Antes era `--court-deep` crudo: 2,98:1 con el naranja del club del demo, y el precio es lo que
    // el visitante viene a leer.
    for (const club of SEIS_CLUBES) {
      const fondo = mezcla(rgb(club), COURT_SOFT.pct, rgb(COURT_SOFT.b));
      const r = contraste(mezcla(rgb(club), SUAVE_INK.pct, rgb(INK)), fondo);
      expect(r, `la tinta del bloque suave falla con el club ${club}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
