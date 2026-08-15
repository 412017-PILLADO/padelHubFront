import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { inkOnAccent } from '../../../../core/branding/tenant-colors';

/**
 * EL ANILLO DE FOCO DEL AFICHE DE LA A, que hasta este archivo no lo cuidaba nadie.
 *
 * La A es la plantilla POR DEFECTO y es mitad y mitad: la columna derecha es superficie de
 * plataforma —y su anillo lo cuida `src/styles.spec.ts`—, pero el afiche (`.poster-brand`) está
 * pintado con el color del club a plena saturación y tiene **seis paradas de teclado adentro** (el
 * stub del mapa, los dos link-rows de contacto y los tres botones del `<app-landing-footer
 * class="pb-foot">`, que cuelga acá). Esa mitad la salva UNA sola línea de `shell.scss`:
 *
 *     .poster-brand { --anillo-foco: var(--ink-on-accent, #fff); }
 *
 * **Sin ella, las seis paradas vuelven a 1,02–1,31:1 con los seis clubes** — el peor caso que tenía
 * el producto antes del Task 3, un anillo del mismo color del fondo del que se deriva. La review de
 * rama borró esa línea y corrió la suite: **161 passed**. Ninguna puerta la veía:
 *
 *   · `src/styles.spec.ts` la **excluye explícitamente** (mide `--paper` y `--surface`, que son las
 *     superficies de plataforma, y dice por escrito que esta zona no entra);
 *   · B y E pinean el suyo en su `contraste.spec.ts` propio y A no tenía uno;
 *   · `contrato-flow` mira los `--flow-*`;
 *   · y el e2e no tiene una sola aserción de foco ni de contraste.
 *
 * Este archivo es esa línea hecha puerta, con el MISMO patrón que los dos `contraste.spec.ts` de las
 * cáscaras hermanas: **los valores no están copiados a mano**. El anillo se lee de `shell.scss`, los
 * dos extremos del degradé salen del `background` de la misma regla, la receta de `--court-deep`
 * sale de `tenant-colors.ts` y la tinta la calcula la FUNCIÓN REAL (`inkOnAccent`), no una copia.
 * Un tripwire con las constantes duplicadas no vigila nada — es la lección que la fase B pagó cara.
 *
 * POR QUÉ SE MIDEN LOS DOS EXTREMOS DEL DEGRADÉ Y NO UN PÍXEL DEL MEDIO. El afiche es
 * `linear-gradient(150deg, var(--court), var(--court-deep))` y `--court-deep` es el mismo color con
 * los tres canales por 0,82. En luz lineal, escalar los tres canales por un factor entre 0,82 y 1 es
 * monótono, así que la luminancia de cualquier punto del degradé queda ENTRE las de los dos
 * extremos: el peor contraste está siempre en una de las dos puntas. Medir las dos puntas es la
 * cota, no una muestra.
 *
 * DOS COSAS QUE ESTE ARCHIVO NO PUEDE PROBAR, para que nadie lo lea como cobertura completa:
 *
 * 1. **`.watermark`.** El texto gigante al 8% de `--ink-on-accent` aclara el fondo de la esquina
 *    inferior del afiche a 1280, y ahí el peor píxel real no es ninguno de los dos extremos. Está
 *    medido en el reporte del Task 4 y afecta al TEXTO del pie, no al anillo (que es de 2px con
 *    3px de offset y no cae sobre la marca de agua). El techo de esa esquina lo pone la capa 3.
 * 2. **La columna del flujo**, que es superficie de plataforma y hereda el default: es exactamente
 *    lo que `src/styles.spec.ts` mide, y por eso acá se pinea que esta cáscara NO declara el token
 *    en su `:host` (ver el último describe).
 *
 * La aritmética WCAG está duplicada de los otros dos `contraste.spec.ts` a propósito, igual que
 * ellos la duplican entre sí: cada uno lee SUS hojas y no depende de un helper que otro pueda
 * cambiar. Si algún día se saca a un módulo compartido, hay que mover los cuatro a la vez.
 */

// ── Lectura de las hojas ─────────────────────────────────────────────────────
const DIR = 'src/app/features/landing/shells/a-afiche';

/**
 * Lee un archivo del repo y le saca los comentarios de bloque. La ruta va desde la raíz del proyecto
 * y NO relativa a este spec: el builder bundlea los specs a un temporal antes de correrlos, así que
 * `import.meta.url` apuntaría al bundle y no al árbol de fuentes. Si algún día el runner cambia de
 * cwd, esto TIRA (ENOENT) en vez de quedarse verde en silencio, que es lo que se quiere.
 *
 * Los comentarios se borran porque el docblock del token de `shell.scss` tiene la TABLA de ratios
 * adentro (`1,02:1`, `19,17:1`, los seis hexes de club): sin esto, un número escrito en prosa se
 * podría colar en una medición.
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
const HOJA_SHELL = leerHoja(`${DIR}/shell.scss`);
/** Los tokens de PLATAFORMA. A no declara ninguno (spec §5.1): los consume. */
const HOJA_PLATAFORMA = leerHoja('src/styles.scss');
/** `--court-deep` no vive en ninguna hoja: lo escribe `applyTenantColors` en el `<html>`. */
const FUENTE_BRANDING = leerArchivo('src/app/core/branding/tenant-colors.ts');

/**
 * TODOS los cuerpos de una regla, acotados por llaves BALANCEADAS y en orden de aparición.
 *
 * Balanceado importa porque `shell.scss` tiene medias queries y un `[^}]*` se comería declaraciones
 * de otra regla. Y **todos** y no el primero porque `.poster-brand` aparece cinco veces en la hoja
 * (dos compactaciones por altura antes de la regla base, la base, `> *` y el `display: contents` de
 * mobile): en CSS, entre reglas de la misma especificidad **gana la última**, así que leer la
 * primera dejaría este archivo vencible con un bloque agregado más abajo. Es el mismo agujero que la
 * review encontró en el pin de opacidad del pie.
 */
function cuerposDeRegla(css: string, selector: string): string[] {
  const cuerpos: string[] = [];
  for (const m of css.matchAll(new RegExp(`(^|[\\s};{])${selector}\\s*\\{`, 'gm'))) {
    const inicio = css.indexOf('{', m.index);
    let nivel = 0;
    for (let i = inicio; i < css.length; i++) {
      if (css[i] === '{') nivel++;
      else if (css[i] === '}' && --nivel === 0) {
        cuerpos.push(css.slice(inicio + 1, i));
        break;
      }
    }
  }
  if (!cuerpos.length) throw new Error(`${selector} ya no existe como regla`);
  return cuerpos;
}

/** Último valor declarado para una propiedad en una lista de cuerpos, o `null`. El `\\s*:` es lo que
 *  evita que `--court` matchee `--court-deep`, y que los `var(--court)` (uso) cuenten. */
function declaracion(cuerpos: string[], prop: string): string | null {
  const hits = cuerpos.flatMap((c) => [...c.matchAll(new RegExp(`${prop}\\s*:\\s*([^;}]+)`, 'g'))]);
  return hits.length ? hits[hits.length - 1][1].trim() : null;
}

const AFICHE = cuerposDeRegla(HOJA_SHELL, '\\.poster-brand');
const HOST_A = cuerposDeRegla(HOJA_SHELL, ':host');

/**
 * LOS `--flow-*` CON LOS QUE A VISTE AL FLUJO. Este archivo no los leía hasta el filo del CTA: el
 * anillo del afiche vive en `shell.scss` y la columna derecha era "superficie de plataforma, la mide
 * styles.spec". Lo segundo sigue siendo cierto para el FONDO de la columna y dejó de serlo para el
 * botón de confirmar, que está pintado con el color del club y no con ninguna superficie de sistema.
 */
const HOJA_TOKENS = leerHoja(`${DIR}/_tokens.scss`);
const HOST_TOKENS = cuerposDeRegla(HOJA_TOKENS, ':host');
/**
 * La hoja del flujo, que es la que PINTA el CTA: la cáscara no lo toca por DOM. Va por `leerArchivo`
 * y no por `leerHoja` porque `booking-flow.scss` usa comentarios `//`, que son Sass idiomático en
 * este repo; de acá sólo se saca el cuerpo de `.confirm`, con un regex que exige la forma.
 */
const HOJA_FLUJO = leerArchivo('src/app/features/landing/booking/booking-flow.scss');
const CONFIRM = /\.confirm\s*\{([^}]*)\}/.exec(HOJA_FLUJO)?.[1] ?? '';
/** El relleno del CTA. Es `var(--court)` crudo, y es la razón por la que el filo tuvo que existir. */
const RELLENO_CTA = declaracion([CONFIRM], 'background');
/** Lo que el flujo hace con el token, o sea que el filo de la cáscara llega de verdad al borde. */
const BORDE_CTA = declaracion([CONFIRM], 'border');

/** El filo tal como lo declara esta cáscara: `<grosor> solid <color>`, o `none`. */
const FILO_DECL = declaracion(HOST_TOKENS, '--flow-cta-edge');
/**
 * LA RECETA DEL FILO, o `null` si la cáscara declara `none`.
 *
 * El `null` no es un caso degenerado que se pueda saltear: es el estado en el que A estuvo hasta
 * esta tarea, y lo que las cuentas de abajo miden entonces es el RELLENO del botón contra el papel
 * —que es literalmente el límite que el botón tiene cuando no dibuja ninguno—. O sea que borrar el
 * token no deja este archivo en verde por falta de datos: lo pone rojo con 2,07 · 1,32 · 1,08.
 *
 * Sólo se sabe resolver la forma que tiene sentido acá; cualquier otra TIRA con el valor adentro del
 * mensaje. Un `#e11d48` a mano o una receta inventada tienen que hacer ruido y no colarse por una
 * rama que las mida mal.
 */
const FILO = (() => {
  if (FILO_DECL == null || FILO_DECL === 'none') return null;
  const m = /^(\S+)\s+solid\s+(color-mix\(.+\))$/s.exec(FILO_DECL);
  if (!m) throw new Error(
    `a-afiche/_tokens.scss declara \`--flow-cta-edge: ${FILO_DECL}\`, y este spec sólo sabe medir ` +
    `\`<grosor> solid color-mix(…)\` o \`none\`. Si el filo estrena otra forma, la cuenta que lo ` +
    `audite va acá adentro: el CTA está pintado con el color del club y no lo mide ninguna otra puerta.`);
  const receta = colorMix(m[2], 'a-afiche/_tokens.scss · --flow-cta-edge');
  if (receta.a !== 'var(--court)' || receta.b !== 'var(--ink)') throw new Error(
    `el filo de A ya no es el primario arrimado a la tinta de la página, sino ` +
    `\`color-mix(in srgb, ${receta.a} …%, ${receta.b})\`. El techo del 50% que este archivo pinea se ` +
    `midió para \`var(--court)\` contra \`var(--ink)\`; con otros polos hay que medirlo de nuevo.`);
  return { grosor: m[1], ...receta };
})();

/** El anillo de la ZONA afiche, tal como lo declara `shell.scss`. */
const ANILLO_AFICHE = declaracion(AFICHE, '--anillo-foco');

/** El default de plataforma, `color-mix(in srgb, var(--court) N%, var(--ink))`, leído del `:root`. */
function colorMix(decl: string | null, dondeDice: string): { a: string; pct: number; b: string } {
  const m = decl && /color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)/s.exec(decl);
  if (!m) throw new Error(`${dondeDice} ya no es un color-mix(in srgb, A pct%, B): ${decl}`);
  return { a: m[1].trim(), pct: Number(m[2]) / 100, b: m[3].trim() };
}
const ROOT = cuerposDeRegla(HOJA_PLATAFORMA, ':root');
const ANILLO_PLATAFORMA = colorMix(
  declaracion(ROOT, '--anillo-foco'), 'styles.scss · :root · `--anillo-foco`');

/** Un `#rrggbb` del `:root` de plataforma. Tira si cambió de forma: un `rgb()` daría NaN después. */
function hexDelRoot(prop: string): string {
  const v = declaracion(ROOT, prop);
  if (!v || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) throw new Error(`:root · ${prop} no es un hex: ${v}`);
  return v;
}
const INK = hexDelRoot('--ink');
/** El papel de la columna derecha: A no le pone fondo, así que se ve el del host de la landing. */
const PAPER = hexDelRoot('--paper');
/** El club, la punta oscura y la tinta que se pintan cuando el tenant NO cargó color. */
const COURT_DEFAULT = hexDelRoot('--court');
const COURT_DEEP_DEFAULT = hexDelRoot('--court-deep');
const INK_ON_ACCENT_DEFAULT = hexDelRoot('--ink-on-accent');

/** La receta de `--court-deep` para un club REAL: `color-mix(in srgb, ${c} 82%, #000)`. */
function derivadoDelClub(prop: string): { pct: number; b: string } {
  const m = new RegExp(`${prop}'\\]\\s*=\\s*\`color-mix\\(in srgb,\\s*\\$\\{c\\}\\s*([\\d.]+)%,\\s*(#[0-9a-f]{3,6})\\)\``, 'i')
    .exec(FUENTE_BRANDING);
  if (!m) throw new Error(`tenant-colors.ts ya no deriva ${prop} con un color-mix literal`);
  return { pct: Number(m[1]) / 100, b: m[2] };
}
const COURT_DEEP = derivadoDelClub('--court-deep');

/**
 * Las seis paletas con las que el Task 3 auditó el anillo — las mismas de `src/styles.spec.ts`. El
 * que ata el techo acá NO es el casi blanco (ése es el de las superficies claras) sino el **fucsia**:
 * es el único de los seis donde `inkOnAccent` tiene que elegir entre dos tintas que las dos raspan.
 */
const CLUBES: [string, string][] = [
  ['teal de plataforma', '#0a8a99'],
  ['naranja del demo', '#f89625'],
  ['amarillo', '#FFD400'],
  ['fucsia', '#FF2D95'],
  ['casi negro', '#111111'],
  ['casi blanco', '#ffffff'],
];

/** El mínimo de WCAG 1.4.11 para componentes de interfaz. El anillo de foco es uno. */
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

/** Las dos puntas del degradé del afiche para un club dado, que es todo el fondo que hay. */
function extremosDelAfiche(club: string): Record<string, Rgb> {
  return {
    [`la punta clara del degradé (--court, ${club})`]: rgb(club),
    [`la punta oscura del degradé (--court-deep, ${club})`]:
      mezcla(rgb(club), COURT_DEEP.pct, rgb(COURT_DEEP.b)),
  };
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
 * el límite del componente ES el canto del relleno y eso es exactamente lo que WCAG 1.4.11 mide.
 * Esa rama es la que hace que este bloque tenga puerta y no sólo documentación.
 */
const filoDe = (club: string, pct = FILO?.pct ?? 0): Rgb =>
  FILO == null ? rgb(club) : mezcla(rgb(club), pct, rgb(INK));

/** El peor ratio de una tinta sobre las dos puntas del afiche. */
const peorEnElAfiche = (tinta: Rgb, club: string) =>
  Math.min(...Object.values(extremosDelAfiche(club)).map((f) => contraste(tinta, f)));

/** El anillo que el default de plataforma le daría al afiche, para un club dado. */
const anilloDePlataforma = (club: string) => mezcla(rgb(club), ANILLO_PLATAFORMA.pct, rgb(INK));

/**
 * EL ANILLO QUE EL AFICHE PINTA DE VERDAD, resuelto desde lo que declara la hoja.
 *
 * Esto es lo que hace que los seis tests de umbral midan la HOJA y no una fórmula escrita acá. Si
 * `.poster-brand` deja de declarar el token —el borrado con el que la review probó el agujero—, la
 * zona hereda el default de plataforma y los seis se ponen rojos con el número real (1,02–2,24:1),
 * no sólo el guard de forma. Un spec que se quede en verde salvo por un test de forma se lee como
 * cobertura y no lo es.
 *
 * Sólo se saben resolver las dos formas que tienen sentido acá; cualquier otra TIRA con el valor
 * adentro del mensaje, que es lo correcto para un tripwire: un `#e11d48` a mano, o un `color-mix`
 * inventado por la cáscara, tienen que hacer ruido y no pasar por una de estas dos ramas.
 */
function anilloDelAfiche(club: string): Rgb {
  if (ANILLO_AFICHE == null) return anilloDePlataforma(club);
  const m = /^var\(\s*--ink-on-accent\s*(?:,\s*(#[0-9a-f]{3,6})\s*)?\)$/i.exec(ANILLO_AFICHE);
  if (!m) throw new Error(
    `a-afiche/shell.scss · \`.poster-brand\` declara \`--anillo-foco: ${ANILLO_AFICHE}\`, y este ` +
    `spec sólo sabe medir \`var(--ink-on-accent, …)\` (la tinta de la capa 3) o la ausencia de la ` +
    `declaración (el default de plataforma). Si el afiche estrena una receta propia, la cuenta que ` +
    `la audite va acá adentro — el afiche NO es superficie de plataforma.`);
  // La capa 3 escribe `--ink-on-accent` en el `<html>` siempre que el tenant tenga color; el
  // fallback del `var()` sólo se pinta cuando no lo tiene, y ese caso lo cubre su propio test.
  return rgb(inkOnAccent(club));
}

describe('plantilla A · el anillo de foco del afiche sobrevive a cualquier color de club', () => {
  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} llega a 3:1 sobre las dos puntas del degradé`, () => {
      expect(
        porDebajoDe(UMBRAL, anilloDelAfiche(club), extremosDelAfiche(club)),
        `El afiche de la A (\`.poster-brand\` en a-afiche/shell.scss) deja al usuario de teclado ` +
          `sin ver dónde está parado con un club ${nombre} (${club}), en las SEIS paradas que viven ` +
          `adentro del afiche (el stub del mapa, los dos link-rows de contacto y los tres botones ` +
          `del pie). El afiche no es superficie de plataforma: está pintado con el color del club, ` +
          `así que el anillo tiene que ser \`--ink-on-accent\` —la tinta que la capa 3 ya calculó ` +
          `contra los dos extremos del degradé— y no el default de \`styles.scss\`, que con estos ` +
          `seis clubes da 1,02–2,24:1 acá adentro.`,
      ).toEqual([]);
    });
  }

  it('sin color de tenant, el afiche de plataforma también pasa', () => {
    // El caso del fallback: sin club cargado no hay `--court` ni `--ink-on-accent` escritos en el
    // `<html>`, así que el afiche se pinta con los tres literales del `:root` de styles.scss. Es lo
    // que ve cualquiera que entre a un tenant recién dado de alta.
    expect(
      porDebajoDe(UMBRAL, rgb(INK_ON_ACCENT_DEFAULT), {
        [`--court del :root (${COURT_DEFAULT})`]: rgb(COURT_DEFAULT),
        [`--court-deep del :root (${COURT_DEEP_DEFAULT})`]: rgb(COURT_DEEP_DEFAULT),
      }),
    ).toEqual([]);
  });

  it('el default de plataforma NO alcanza acá: es el motivo por el que la zona lo pisa', () => {
    // Tripwire al revés, y el más importante del archivo: si el default de `styles.scss` pasara
    // 3:1 sobre el afiche, la declaración de `.poster-brand` se quedaría sin motivo y habría que
    // borrarla. Hoy no pasa con NINGUNO de los seis (1,02 con el casi negro, 2,24 con el casi
    // blanco): ninguna mezcla contra la tinta del sistema arregla un fondo del color del club —
    // con un club casi negro el afiche ya ES casi negro y oscurecer el anillo lo hunde más.
    const queSalvaElDefault = CLUBES.filter(
      ([, club]) => peorEnElAfiche(anilloDePlataforma(club), club) >= UMBRAL,
    ).map(([nombre]) => nombre);
    expect(queSalvaElDefault).toEqual([]);
  });

  it('el anillo del afiche mejora el peor caso del producto, que es para lo que existe', () => {
    // 1,02:1 (club casi negro: el anillo literalmente del color del fondo) contra 3,63 (fucsia, que
    // es el que ata el techo acá). El promedio no dice nada; el que manda es el peor.
    const conElToken = Math.min(...CLUBES.map(([, c]) => peorEnElAfiche(anilloDelAfiche(c), c)));
    const conElDefault = Math.min(
      ...CLUBES.map(([, c]) => peorEnElAfiche(anilloDePlataforma(c), c)));
    expect(conElToken).toBeGreaterThan(conElDefault);
    expect(conElToken).toBeGreaterThanOrEqual(UMBRAL);
  });
});

/**
 * EL FILO DEL CTA · el límite visible del botón de confirmar.
 *
 * `.confirm` es el control más importante del producto y hasta esta tarea no tenía NINGÚN límite en A:
 * `--flow-cta-edge` valía `none`, así que el botón era una mancha de `--court` crudo sobre el papel
 * de la columna. Con tres de las seis paletas de la casa eso deja al botón sin silueta —naranja del
 * demo 2,07 · amarillo 1,32 · casi blanco 1,08, contra el 3:1 que WCAG 1.4.11 le pide al límite de
 * un componente— y lo único que lo delata es el texto de adentro.
 *
 * El filo es el PRIMARIO ARRIMADO A LA TINTA DE LA PÁGINA: el relleno del propio botón oscurecido,
 * o sea un canto de sí mismo y no una estructura agregada. Es la misma forma que ya usan el anillo de
 * la E y los dos acentos de la B, y es deliberado que NO use `--court-2`: un club
 * puede no tener secundario cargado (el tenant demo de la plataforma no tiene), y derivar el filo del
 * primario —que siempre existe, incluso sin tenant, porque el `:root` de plataforma lo declara— deja
 * el caso resuelto por construcción en vez de por una rama de degradación.
 *
 * LO QUE ESTE BLOQUE NO PUEDE PROBAR: la cara de ADENTRO del filo, contra el relleno del botón. El
 * filo se deriva del relleno, así que esa cara es floja por diseño (2,18 con el teal en reposo, 1,02
 * con un club casi negro) y no tiene piso posible: cualquier receta que garantice la silueta contra
 * una superficie clara tiene que acercarse a la tinta, y acercarse a la tinta la aleja de un relleno
 * oscuro. La que WCAG pide es la de AFUERA, que es la que le devuelve el límite al botón.
 */
describe('plantilla A · el filo del CTA le da al botón de confirmar un límite visible', () => {
  /** La única superficie que el filo toca por afuera: A no le pone fondo a la columna del flujo. */
  const PAPEL = { 'el papel de la columna del flujo': rgb(PAPER) };

  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} el CTA llega a 3:1 contra el papel de la columna`, () => {
      expect(
        porDebajoDe(UMBRAL, filoDe(club), PAPEL),
        `El botón de confirmar de la A no tiene límite visible con un club ${nombre} (${club}). ` +
          `\`.confirm\` es \`background: var(--court)\` a sangre sobre el papel de la columna, y el ` +
          `único token que puede ponerle borde es \`--flow-cta-edge\` en a-afiche/_tokens.scss: la ` +
          `cáscara no toca el CTA por DOM. WCAG 1.4.11 pide 3:1 para el límite de un componente.`,
      ).toEqual([]);
    });
  }

  it('el filo NO es decoración: sin él, 3 de las 6 paletas dejan al CTA sin silueta', () => {
    // Tripwire al revés, y el que justifica todo el bloque. El relleno se LEE de la hoja del flujo:
    // los tres números de arriba sólo valen mientras siga siendo el color CRUDO del club, así que si
    // alguien lo cambia esto se cae en vez de seguir citando una tabla de memoria. Y si algún día el
    // relleno pasara 3:1 con las seis, el filo pasaría a ser un adorno y habría que discutirlo.
    expect(RELLENO_CTA).toBe('var(--court)');
    const sinFilo = CLUBES.map(([, c]) => contraste(rgb(c), rgb(PAPER)));
    expect(sinFilo.filter((r) => r < UMBRAL).length).toBeGreaterThanOrEqual(3);
  });

  it('el 50% es un TECHO medido: el peor primario posible es el BLANCO', () => {
    // El primario se arrima a la tinta hasta que se lea, y el que ata es el más CLARO —el que más se
    // parece al papel—: `color-mix(#fff N%, --ink)` cruza el 3:1 contra `--paper` en N = 51,72%. 50
    // es ese techo redondeado hacia abajo. Subirlo deja sin filo a los clubes de primario claro;
    // bajarlo apaga el matiz del club sin necesidad. La DIRECCIÓN importa: sobre superficie clara el
    // lado peligroso es el del color crudo, no el de la tinta.
    expect(FILO, 'A no declara filo: no hay techo que pinear').not.toBeNull();
    expect(contraste(filoDe('#ffffff', FILO!.pct), rgb(PAPER))).toBeGreaterThanOrEqual(UMBRAL);
    expect(contraste(filoDe('#ffffff', 0.52), rgb(PAPER))).toBeLessThan(UMBRAL);
  });

  it('el filo no depende del secundario, así que el tenant demo no tiene caso aparte', () => {
    // `--court-2` sólo existe si el club cargó un secundario: `applyTenantColors` lo BORRA del
    // `:root` cuando no lo hay, y el tenant demo de la plataforma es justamente así. Derivar el filo
    // del PRIMARIO evita la rama de degradación entera —no hay "sin secundario el filo cae a X" que
    // medir— y por eso está pineado: es la simplificación que se ve más natural de deshacer.
    expect(FILO_DECL).not.toContain('--court-2');
  });

  it('el flujo consume el token, o el filo de la cáscara no llega al botón', () => {
    // Las cuentas de arriba miden un color; esto verifica que ese color se PINTE. Si `.confirm`
    // volviera a `border: none` fijo —como estaba antes de que el token existiera—, A podría declarar
    // el filo más contrastado del mundo y el botón seguiría a sangre.
    expect(BORDE_CTA).toBe('var(--flow-cta-edge, none)');
  });
});

/**
 * Lo que este archivo le lee a las hojas. Si algo cambia de FORMA, los parsers de arriba tiran al
 * cargar el módulo — ruidoso, que es lo correcto. Este describe cubre el otro caso: que la forma
 * siga siendo la misma pero lo que se mide deje de ser lo que se pinta.
 */
describe('plantilla A · el spec sigue leyendo la hoja que cree leer', () => {
  it('`.poster-brand` declara el anillo, y es la tinta de la capa 3 y no un color propio', () => {
    // ESTA ES LA LÍNEA QUE LA REVIEW BORRÓ Y NADIE EXTRAÑÓ. Las cuentas de arriba miden
    // `inkOnAccent(club)`; si la hoja dejara de declarar el token —o lo declarara con otra cosa,
    // por ejemplo un `#fff` fijo— seguirían dando los mismos números y la pantalla mostraría el
    // default de plataforma sobre el color del club, que es el peor caso del producto.
    //
    // El `#fff` de adentro es el FALLBACK del `var()`, no un color elegido: es lo que se pinta
    // mientras la capa 3 no escribió `--ink-on-accent` en el `<html>` — el mismo valor que el
    // `:root` declara, así que el test de arriba lo cubre.
    expect(
      ANILLO_AFICHE,
      'a-afiche/shell.scss ya no declara `--anillo-foco` en `.poster-brand`. Sin esa línea las ' +
        'seis paradas de teclado del afiche vuelven a 1,02–1,31:1 con los seis clubes y NINGUNA ' +
        'otra puerta lo ve: styles.spec.ts excluye esta zona por escrito, y el e2e no mide foco.',
    ).toBe('var(--ink-on-accent, #fff)');
  });

  it('el anillo va en la ZONA y no en el `:host`: la columna del flujo es de plataforma', () => {
    // La asimetría es la correcta y es fácil de romper "ordenando": A es mitad afiche pintado con
    // el color del club y mitad superficie de plataforma. Mudar el token al `:host` —que es lo que
    // hacen B y E, porque ellas SÍ son de un solo color— teñiría también el `<app-booking-flow>`
    // de la columna derecha, que tiene que seguir con el default claro (el que mide styles.spec).
    expect(declaracion(HOST_A, '--anillo-foco')).toBeNull();
  });

  it('el afiche sigue siendo el degradé entre las dos puntas que se miden', () => {
    // Toda la aritmética de arriba supone que el fondo del afiche va de `--court` a `--court-deep`
    // y nada más. Si apareciera una tercera parada, o un color plano distinto, el peor píxel
    // podría dejar de estar en una de las dos puntas.
    const fondo = declaracion(AFICHE, 'background');
    expect(fondo).toMatch(/^linear-gradient\([^,]+,\s*var\(--court\)\s*,\s*var\(--court-deep\)\)$/);
  });

  it('el afiche escribe su texto con la MISMA tinta que el anillo', () => {
    // Es lo que hace que el anillo se lea como parte del afiche y no como un injerto, y también lo
    // que garantiza que no haga falta una segunda cuenta: la tinta ya está auditada contra el
    // degradé por la capa 3 (`decidirTinta` puntúa el PEOR de los dos extremos).
    expect(declaracion(AFICHE, 'color')).toBe('var(--ink-on-accent, #fff)');
  });

  it('la punta oscura del afiche es el club por 0,82 hacia el negro', () => {
    // Si `applyTenantColors` cambiara el porcentaje o el polo, `extremosDelAfiche` estaría midiendo
    // un fondo que no se pinta — y `inkOnAccent` elegiría la tinta contra otro extremo que el que
    // este archivo evalúa.
    expect(COURT_DEEP.b.toLowerCase()).toBe('#000');
    expect(COURT_DEEP.pct).toBeGreaterThan(0.5);
    expect(COURT_DEEP.pct).toBeLessThan(1);
  });

  it('el default de plataforma mezcla el club hacia la tinta del sistema', () => {
    // El tripwire de "el default no alcanza acá" lo simula con esta fórmula: si cambiara de forma o
    // de polo, estaría comparando contra algo que no es el default.
    expect([ANILLO_PLATAFORMA.a, ANILLO_PLATAFORMA.b]).toEqual(['var(--court)', 'var(--ink)']);
  });

  it('A no declara los tokens de plataforma: los consume (spec §5.1)', () => {
    // Si la cáscara empezara a declarar `--court` o `--ink`, los hexes que este archivo lee de
    // `styles.scss` dejarían de ser los que pinta.
    for (const prop of ['--court', '--court-deep', '--ink', '--ink-on-accent']) {
      expect(declaracion([HOJA_SHELL], prop)).toBeNull();
    }
  });
});
