import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * El anillo de foco de PLATAFORMA: el default de `--anillo-foco` que `styles.scss` declara en su
 * `:root`.
 *
 * Es el único de los tres valores del token que no tenía quien lo cuidara. Los otros dos —el de
 * `b-nocturna/_tokens.scss` y el de `e-diurna/_tokens.scss`— están pineados por el
 * `contraste.spec.ts` de su cáscara; éste, que es el que gobierna la columna de reserva de la A, la
 * C ENTERA, TODO EL PANEL DE ADMIN y los dos modales de la landing (que cuelgan de `<app-landing>`,
 * o sea fuera de toda cáscara, y por eso heredan siempre este default), sólo estaba defendido por un
 * comentario.
 *
 * Y el comentario dice algo que se puede romper sin que nada se entere: **el 50% es un TECHO
 * medido, no un gusto**. Alguien que lo redondee a 55% en un cleanup deja al club casi blanco en
 * 2,72:1 sobre `--paper` —abajo del 3:1 que WCAG 1.4.11 pide para componentes— en la A, en la C y
 * en el panel, con la suite entera en verde. Este archivo es ese techo hecho puerta.
 *
 * MISMO PATRÓN que los dos `contraste.spec.ts` de las cáscaras: los valores NO están copiados a
 * mano, se leen de la hoja. Si alguien sube el porcentaje, el número que entra a la fórmula sube con
 * él y el umbral falla. Un tripwire con las constantes duplicadas no vigila nada — es la lección que
 * la fase B pagó cara.
 *
 * LA DIRECCIÓN QUE ROMPE ES SUBIR EL PORCENTAJE, y vale anotarlo porque en B es al revés: este
 * anillo mezcla el club hacia la tinta del sistema (oscurece), así que MÁS porcentaje = más color
 * crudo del club = menos contraste sobre una superficie clara. En B, que mezcla hacia `#fff` sobre
 * un telón oscuro, bajar el porcentaje MEJORA. Quien venga a probar que esta puerta muerde tiene que
 * mover el valor hacia el color del club, no hacia el polo.
 *
 * TRES COSAS QUE ESTE ARCHIVO NO PUEDE PROBAR, para que nadie lo lea como cobertura completa:
 *
 * 1. **Las zonas que no son superficie de plataforma.** El afiche de la A (`.poster-brand`) está
 *    pintado con el color del club y pisa el token con `--ink-on-accent` en su propia hoja; acá se
 *    mide `--paper` y `--surface`, que son las dos superficies que el default gobierna de verdad.
 * 2. **Los controles cuyo foco no pasa por el token.** Los `pInputText` (los dos del flujo y el
 *    buscador del panel) matan el `outline` con más especificidad y ponen su propio anillo por
 *    `box-shadow`. Anotado en el reporte del Task 3.
 * 3. **`.ccard.is-selected` y `.ccard.any`**, que se tapan el anillo desde `booking-flow.scss` con
 *    más especificidad. Preexistentes, medidos y anotados en el mismo reporte.
 *
 * La aritmética WCAG está duplicada de los dos `contraste.spec.ts` a propósito, igual que ellos la
 * duplican entre sí: cada uno lee SUS hojas y no depende de un helper que otro pueda cambiar. Si
 * algún día se saca a un módulo compartido, hay que mover los tres a la vez.
 */

/**
 * Lee una hoja del repo y le saca los comentarios de bloque. La ruta va desde la raíz del proyecto y
 * NO relativa a este spec: el builder bundlea los specs a un temporal antes de correrlos, así que
 * `import.meta.url` apuntaría al bundle y no al árbol de fuentes. Si algún día el runner cambia de
 * cwd, esto TIRA (ENOENT) en vez de quedarse verde en silencio, que es lo que se quiere de un
 * tripwire.
 *
 * Los comentarios se borran porque el docblock del token TIENE LOS NÚMEROS ADENTRO ("51,7%", "55%",
 * "3,16:1"): sin esto, un porcentaje escrito en prosa podría colarse en una medición.
 *
 * ORDEN: primero se borran los `/* *\/` y RECIÉN AHÍ se busca un `//`, que este parser no saca. Al
 * revés, un `//` escrito adentro de un comentario de bloque (o una `url(//host/…)`) abortaría el
 * módulo entero y con él todos los tests.
 */
function leerHoja(ruta: string): string {
  const css = readFileSync(resolve(process.cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/(^|[^:])\/\//.test(css)) throw new Error(`${ruta} tiene comentarios //: el parser sólo saca /* */`);
  return css;
}
const HOJA = leerHoja('src/styles.scss');

/**
 * El cuerpo de una regla, acotado por llaves BALANCEADAS (mismo conteo que usa
 * `booking/contrato-flow.spec.ts` para los mixins). Acotar importa: `styles.scss` tiene medias
 * queries y reglas anidadas, y un `[^}]*` se cortaría en la primera llave que encuentre o se comería
 * declaraciones de otra regla. Lo que este archivo mide es el `:root`, no "la hoja".
 */
function cuerpoDeRegla(css: string, selector: string): string {
  const abre = css.search(new RegExp(`(^|[\\s};])${selector}\\s*\\{`, 'm'));
  if (abre === -1) throw new Error(`styles.scss ya no tiene una regla \`${selector}\``);
  const inicio = css.indexOf('{', abre);
  let nivel = 0;
  for (let i = inicio; i < css.length; i++) {
    if (css[i] === '{') nivel++;
    else if (css[i] === '}' && --nivel === 0) return css.slice(inicio + 1, i);
  }
  throw new Error(`la regla \`${selector}\` de styles.scss no cierra llave`);
}
const ROOT = cuerpoDeRegla(HOJA, ':root');

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
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`:root · ${prop} no es un #rrggbb literal: ${v}`);
  return v;
}

/**
 * Parsea `color-mix(in srgb, <A> <pct>%, <B>)`. El `(.+)\)` es GOLOSO a propósito: el segundo
 * término es un `var(--ink)` con su propio paréntesis. La bandera `s` no es decorativa: un valor
 * partido en dos renglones —estilo de la casa— llega acá con un salto de línea adentro, y sin `s`
 * el módulo tiraría por un reformateo que no movió un pixel.
 */
function colorMix(decl: string | null, dondeDice: string): { a: string; pct: number; b: string } {
  const m = decl && /color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)/s.exec(decl);
  if (!m) throw new Error(`${dondeDice} ya no es un color-mix(in srgb, A pct%, B): ${decl}`);
  return { a: m[1].trim(), pct: Number(m[2]) / 100, b: m[3].trim() };
}

// ── Los valores del `:root`, leídos de la hoja ───────────────────────────────
const PAPER = hexDe(ROOT, '--paper');
const SURFACE = hexDe(ROOT, '--surface');
const INK = hexDe(ROOT, '--ink');
/** `--anillo-foco: color-mix(in srgb, var(--court) N%, var(--ink))`. */
const ANILLO = colorMix(declaracion(ROOT, '--anillo-foco'), 'styles.scss · :root · `--anillo-foco`');

/**
 * Las seis paletas con las que se auditó el anillo en el Task 3 — las mismas de los
 * `contraste.spec.ts` de las cáscaras más el naranja del tenant demo, que es el único club REAL de
 * la lista y el que da el peor número de los que hay hoy en producción.
 *
 * El que ata el techo es el CASI BLANCO: sobre superficie clara, cuanto más claro el club más claro
 * el anillo y menos se despega. Es el polo contrario al de B, donde el que manda es el casi negro.
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

/** `#rgb` o `#rrggbb` a canales. La hoja escribe las dos formas (`#fff` y `#f4f6fb`). */
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

/**
 * Las dos superficies CLARAS de plataforma. Son las que este default gobierna: la columna de reserva
 * de la A, la C entera, el panel y los modales están pintados con una de las dos.
 */
const SUPERFICIES: Record<string, Rgb> = {
  '--paper (el fondo del panel y de las landings claras)': rgb(PAPER),
  '--surface (tarjetas, chips, modales)': rgb(SURFACE),
};

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

/** El anillo que sale de la receta de la hoja para un color de club dado. */
const anilloDe = (club: string, pct = ANILLO.pct) => mezcla(rgb(club), pct, rgb(INK));
/** El peor ratio de un color sobre las dos superficies. */
const peorRatio = (tinta: Rgb) => Math.min(...Object.values(SUPERFICIES).map((f) => contraste(tinta, f)));
/** ¿Ese porcentaje aguanta el umbral con las seis paletas sobre las dos superficies? */
const aguanta = (pct: number) => CLUBES.every(([, club]) => peorRatio(anilloDe(club, pct)) >= UMBRAL);

/**
 * Hasta dónde se puede subir el porcentaje antes de que el primer club se caiga del umbral, en pasos
 * de 0,01 puntos. Se busca desde 0 hacia arriba y se corta en la PRIMERA falla, no "el mayor
 * porcentaje que pasa" a secas: lo segundo supondría que el conjunto de porcentajes buenos es un
 * intervalo, y si algún día no lo fuera, un agujero en el medio quedaría escondido detrás de un
 * techo alto.
 *
 * Al 0% el anillo es `--ink` pelado, que sobre superficie clara es lo más contrastado que hay: el
 * intervalo bueno arranca ahí y este número es donde termina. No depende del valor declarado, así
 * que el mensaje de falla dice el techo REAL aunque la hoja ya esté por encima.
 */
function techoDelPorcentaje(): number {
  let ultimo = -0.0001;
  for (let p = 0; p <= 1.00005; p += 0.0001) {
    if (!aguanta(p)) break;
    ultimo = p;
  }
  return ultimo;
}
const TECHO = techoDelPorcentaje();
const pct = (p: number) => `${(p * 100).toFixed(2)}%`;

describe('plataforma · el anillo de foco por defecto sobrevive a cualquier color de club', () => {
  for (const [nombre, club] of CLUBES) {
    it(`con un club ${nombre} llega a 3:1 sobre las superficies claras de plataforma`, () => {
      expect(
        porDebajoDe(UMBRAL, anilloDe(club), SUPERFICIES),
        `El default de \`--anillo-foco\` del \`:root\` de styles.scss (hoy ${pct(ANILLO.pct)}) deja ` +
          `al usuario de teclado sin ver dónde está parado con un club ${nombre} (${club}), en la ` +
          `plantilla A, en la C y en TODO el panel. El porcentaje es un TECHO, no un gusto: más ` +
          `porcentaje = más color crudo del club = menos contraste sobre superficie clara. Con ` +
          `estas seis paletas el máximo que aguanta es ${pct(TECHO)}. Bajalo, no bajes el umbral. ` +
          `Una cáscara cuya superficie NO es clara pisa el token en SU hoja, nunca acá.`,
      ).toEqual([]);
    });
  }

  it('el porcentaje declarado no pasa el techo medido con las seis paletas', () => {
    // Es el mismo hecho que los seis tests de arriba, dicho en un número: sirve para que el que
    // venga a mover el valor lea cuánto margen hay sin tener que recalcularlo. Hoy: declarado 50%,
    // techo 51,72% (lo ata el club casi blanco sobre `--paper`, que es la más OSCURA de las claras
    // y por lo tanto de la que menos se despega un anillo oscurecido).
    expect(
      ANILLO.pct,
      `styles.scss declara \`--anillo-foco\` al ${pct(ANILLO.pct)} y el techo medido es ` +
        `${pct(TECHO)}: con al menos una de las seis paletas el anillo queda abajo de ${UMBRAL}:1 ` +
        `sobre \`--paper\` o \`--surface\`. Los seis tests de acá arriba dicen cuál.`,
    ).toBeLessThanOrEqual(TECHO);
  });

  it('el token no hunde a ningún club que el `--court` crudo ya salvaba', () => {
    // El criterio NO es "nunca peor que el crudo", y vale escribir por qué: con un club casi negro
    // (#111111) el crudo da 17,46 sobre `--paper` y el anillo 17,05, o sea que baja. No es un
    // defecto — `--ink` (#11162b) es más claro y más azul que ese club, así que mezclar contra la
    // tinta del sistema lo aclara una pizca. A esa altura la diferencia no la ve nadie y es el
    // precio de tener UNA fórmula para los seis clubes en vez de un caso especial por color.
    //
    // Lo que sí sería un defecto es que el token tirara abajo del umbral a un club que el crudo
    // pasaba: eso sería romper el caso que vino a arreglar.
    const rotos = CLUBES.filter(
      ([, club]) => peorRatio(rgb(club)) >= UMBRAL && peorRatio(anilloDe(club)) < UMBRAL,
    ).map(([nombre]) => nombre);
    expect(rotos).toEqual([]);
  });

  it('el token mejora el peor caso del producto, que es para lo que existe', () => {
    // 1,00:1 (club casi blanco sobre `--surface`: el anillo literalmente del color del fondo) contra
    // 3,16:1. El promedio no dice nada acá; el que manda es el peor.
    const peorConElToken = Math.min(...CLUBES.map(([, club]) => peorRatio(anilloDe(club))));
    const peorConElCrudo = Math.min(...CLUBES.map(([, club]) => peorRatio(rgb(club))));
    expect(peorConElToken).toBeGreaterThan(peorConElCrudo);
  });

  it('con al menos un color de club el `--court` crudo es invisible', () => {
    // Tripwire al revés: si el color del club pelado pasara 3:1 con las seis paletas, el token se
    // quedaría sin motivo y habría que borrarlo. Hoy no pasa ni cerca: el casi blanco da 1,00:1
    // sobre `--surface` (el anillo literalmente del color del fondo) y el naranja del demo, 2,07.
    expect(Math.min(...CLUBES.map(([, club]) => peorRatio(rgb(club))))).toBeLessThan(UMBRAL);
  });
});

/**
 * Las tres cosas que este archivo le lee a la hoja. Si una cambia de FORMA (el token deja de ser un
 * `color-mix`, o `--paper` pasa a `rgb()`), los parsers de arriba tiran al cargar el módulo —
 * ruidoso, que es lo correcto. Este describe cubre el otro caso: que la forma siga siendo la misma
 * pero lo que se mide deje de ser lo que se pinta.
 */
describe('plataforma · el spec sigue leyendo la hoja que cree leer', () => {
  it('el anillo mezcla el color del club hacia la tinta del sistema', () => {
    // El POLO importa: hacia `#fff` —que es lo correcto en la nocturna— este anillo desaparecería
    // sobre el papel, y las cuentas de arriba seguirían dando bien porque estarían mezclando contra
    // otra cosa. Y el primer término tiene que ser el club: si fuera un hex fijo, el white-label se
    // habría perdido sin que ningún umbral se moviera.
    expect([ANILLO.a, ANILLO.b]).toEqual(['var(--court)', 'var(--ink)']);
  });

  it('`--paper` es la superficie clara más oscura, que es la que ata el techo', () => {
    // Toda la aritmética de arriba supone esto. Si apareciera una superficie de plataforma más
    // oscura que `--paper`, el techo real sería MENOR que el que este archivo calcula y el spec
    // estaría midiendo el caso fácil.
    expect(luminancia(rgb(PAPER))).toBeLessThan(luminancia(rgb(SURFACE)));
  });

  it('el `:root` declara el token UNA sola vez: el que se mide es el que gobierna', () => {
    // `declaracion()` toma la última, así que una segunda declaración más abajo en la misma hoja
    // sería la que pinta y no necesariamente la que este archivo mide.
    expect([...HOJA.matchAll(/--anillo-foco\s*:/g)]).toHaveLength(1);
  });

  it('la regla global de foco CONSUME el token: sin eso, medirlo no prueba nada', () => {
    // Es la guardia contra el verde vacío. Si alguien vuelve a escribir `outline: … var(--court)` en
    // la regla `:focus-visible`, el token queda declarado y sin uso y todos los tests de arriba
    // seguirían pasando mientras la pantalla vuelve al bug que el Task 3 arregló.
    const foco = cuerpoDeRegla(HOJA, ':focus-visible');
    expect(declaracion(foco, 'outline')).toMatch(/var\(--anillo-foco\)/);
  });
});
