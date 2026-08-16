import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * EL FILO DEL CTA DE LA C, que es lo único que este archivo mide todavía.
 *
 * De las cuatro cáscaras, C era la última sin `contraste.spec.ts` propio: A, B y E tienen el suyo y
 * los tres nacieron igual —una decisión de color que no vigilaba nadie—. Acá el disparador es el
 * botón de confirmar: `.confirm` es `background: var(--court)` crudo apoyado sobre el `--paper` de la
 * página, y con tres de las seis paletas de la casa el control más importante del producto no tiene
 * NINGUNA silueta contra su propia superficie (naranja del demo 2,07 · amarillo 1,32 · casi blanco
 * 1,08, contra el 3:1 que WCAG 1.4.11 le pide al límite de un componente).
 *
 * ESTE ARCHIVO NO ES UNA AUDITORÍA DE C, y conviene decirlo para que nadie lo lea como cobertura:
 * mide el filo del CTA y nada más. C no pisa ninguna superficie de plataforma (su `:host` es `--paper`
 * y su rail `--surface`, los dos tokens del sistema), así que sus textos y su anillo de foco caen
 * exactamente en el caso que `src/styles.spec.ts` ya mide contra las seis paletas. Lo que ese archivo
 * NO puede ver es el CTA, porque el CTA no está pintado con una superficie de sistema: está pintado
 * con el color del club.
 *
 * **Los valores no están copiados a mano**: el filo se lee de `_tokens.scss`, el relleno del botón de
 * la hoja del flujo y los hexes del `:root` de plataforma. Es la lección que la fase B pagó cara —una
 * versión de su `contraste.spec.ts` tenía las constantes duplicadas, y entonces revertir un token
 * dejaba los tests en verde: un tripwire que no puede fallar es peor que no tenerlo, porque se lee
 * como cobertura.
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
/** `color-mix(in srgb, a <pct>%, b)`: en sRGB es la interpolación lineal de los canales. */
function mezcla(a: Rgb, pct: number, b: Rgb): Rgb {
  return a.map((v, i) => v * pct + b[i] * (1 - pct)) as Rgb;
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
    // Desde la Task 4 `background` sólo se declara una vez en toda la hoja (en `:host`): sin rail no
    // queda otra superficie que pise el papel, así que el último y el único valor coinciden.
    expect(declaracion(HOJA_TOKENS, '--flow-surface')).toBe('transparent');
    expect(declaracion(HOJA_SHELL, 'background')).toBe('var(--paper)');
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
