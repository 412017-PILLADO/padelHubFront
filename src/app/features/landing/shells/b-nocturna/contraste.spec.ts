/**
 * B es la única plantilla oscura del producto (spec §6). Sus tokens de tinta son fijos —no dependen
 * del color del club—, así que su contraste se puede pinear acá sin browser.
 *
 * Los valores tienen que coincidir con los que declara `shell.scss`. Si alguien los cambia sin
 * mirar el contraste, este test lo frena.
 *
 * DOS COSAS QUE ESTE ARCHIVO NO PUEDE PROBAR, para que nadie lo lea como cobertura completa:
 *
 * 1. **El acento contra la superficie.** `--court` es del club, no de la cáscara. Con un club casi
 *    negro las reglas que usan `var(--court)` CRUDO dentro del panel (el numerito del paso, el
 *    ícono del check de éxito, el borde del aviso de seña) caen a ~1,05:1. Está medido y anotado en
 *    el reporte del Task 8; arreglarlas pide un token nuevo del contrato `--flow-*`, que toca las
 *    tres cáscaras y no entra en un audit. Lo que SÍ se pinea acá es el anillo de foco: es la única
 *    de ese grupo que vive en la capa de B y por lo tanto se puede arreglar y proteger desde adentro.
 * 2. **El pie sobre el resplandor inferior.** El telón levanta el fondo del pie por encima de
 *    `--paper`, y cuánto depende del secundario del club. Eso se mide con pixeles reales, no con
 *    aritmética de tokens (números en el reporte).
 */

// ── Las tintas y las recetas de superficie que declara shell.scss ────────────
const INK = '#eef2f8';
const INK_DIM = '#b7c0d4';
const INK_FAINT = '#8d97ad';
/** Las bases oscuras de `--paper` y `--surface`, antes de mezclarles el color del club. */
const BASE_PAPER = '#07090f';
const BASE_SURFACE = '#121826';
/** Alfa del vidrio del panel: `--surface` al 72% sobre el papel (ver `_vidrio.scss`). */
const ALFA_VIDRIO = 0.72;
/** % de blanco de `--line-strong`, el borde que identifica chips, horarios y `.ghost-btn`. */
const LINE_STRONG_PCT = 0.36;

/**
 * El peor club para el contraste es el más CLARO, porque es el que más aclara las superficies:
 * `--paper` y `--surface` se derivan mezclándole el color del club a una base casi negra. Blanco
 * puro es el techo de esa familia, así que fija la cota superior de todas las superficies de B.
 */
const CLUB_PEOR = '#ffffff';

// ── Aritmética WCAG ──────────────────────────────────────────────────────────
type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
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

/** Las superficies de B para un color de club dado, tal como las deriva `shell.scss`. */
function superficiesDe(club: string): Record<string, Rgb> {
  const paper = mezcla(rgb(club), 0.13, rgb(BASE_PAPER));
  const surface = mezcla(rgb(club), 0.1, rgb(BASE_SURFACE));
  return {
    '--paper (el telón)': paper,
    '--surface (chips, horarios, recap)': surface,
    'el vidrio del panel de reserva': sobre(surface, ALFA_VIDRIO, paper),
    // `--flow-soft-surface` de `_tokens.scss`: el color del club al 18% sobre `--surface`.
    'el bloque suave (seña, check, precio)': mezcla(rgb(club), 0.18, surface),
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
      .map(([nombre, fondo]) => [nombre, contraste(sobre([255, 255, 255], LINE_STRONG_PCT, fondo), fondo)] as const)
      .filter(([, ratio]) => ratio < 3)
      .map(([nombre, ratio]) => `${nombre}: ${ratio.toFixed(2)}:1`);
    expect(fallan).toEqual([]);
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
  /** `color-mix(in srgb, var(--court) 60%, #fff)`, tal cual lo declara shell.scss. */
  const anilloDe = (club: string) => mezcla(rgb(club), 0.6, [255, 255, 255]);
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
