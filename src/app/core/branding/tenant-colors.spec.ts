import { decidirTinta, inkOnAccent } from './tenant-colors';

const INK_OSCURA = '#11162b';
const INK_CLARA = '#eef2f8';

// Réplica independiente de la matemática WCAG de tenant-colors.ts (luminancia relativa + contraste),
// usada solo para verificar `decidirTinta` desde afuera: si esto importara las funciones privadas
// del módulo, un bug compartido entre `decidirTinta` y el test pasaría desapercibido.
function hexToRgbTest(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function linealTest(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminanciaTest([r, g, b]: [number, number, number]): number {
  return 0.2126 * linealTest(r) + 0.7152 * linealTest(g) + 0.0722 * linealTest(b);
}
function contrasteTest(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
/** Contraste WCAG del PEOR de los dos extremos del gradiente de `fondoHex` (el color base y su 82%,
 *  que es `--court-deep`) contra `tintaHex`. */
function peorContrasteTest(fondoHex: string, tintaHex: string): number {
  const rgb = hexToRgbTest(fondoHex);
  const deep: [number, number, number] = [rgb[0] * 0.82, rgb[1] * 0.82, rgb[2] * 0.82];
  const lTinta = luminanciaTest(hexToRgbTest(tintaHex));
  return Math.min(contrasteTest(luminanciaTest(rgb), lTinta), contrasteTest(luminanciaTest(deep), lTinta));
}

describe('decidirTinta · matriz de colores extremos', () => {
  // Umbral 4.5:1 (texto) para los colores que pueden alcanzarlo con dos tintas posibles.
  it.each([
    ['amarillo', '#FFD400'],
    ['blanco', '#FFFFFF'],
    ['negro', '#111111'],
  ])('%s alcanza 4.5:1 en el peor extremo del gradiente', (_nombre, color) => {
    expect(decidirTinta(color).ratio).toBeGreaterThanOrEqual(4.5);
  });

  // Un fucsia saturado NO llega a 4.5:1 contra ninguna de las dos tintas (blanco 3.45, oscura 3.57
  // en el peor extremo). No es un bug del cálculo sino un límite del color: por eso la regla de
  // diseño es que ningún shell pone texto de párrafo sobre --court crudo (ver spec §10).
  it('fucsia alcanza al menos 3:1, el umbral de texto grande y componentes', () => {
    expect(decidirTinta('#FF2D95').ratio).toBeGreaterThanOrEqual(3);
  });

  it('elige siempre la tinta con mejor peor-caso', () => {
    // Sobre amarillo gana la tinta oscura; sobre negro, el blanco. Los dos candidatos se recalculan
    // acá de forma independiente (peorContrasteTest, no decidirTinta) para que el test no pueda
    // pasar aceptando cualquiera de las dos.
    const d = decidirTinta('#FFD400');
    expect(d.usaBlanco).toBe(false);
    expect(d.ratio).toBeCloseTo(peorContrasteTest('#FFD400', INK_OSCURA));
    expect(decidirTinta('#111111').usaBlanco).toBe(true);
  });

  /**
   * El texto sobre el color del club cae sobre EL ACENTO, no sobre la superficie de la cáscara. Así
   * que los dos candidatos tienen que ser siempre blanco y una tinta oscura, aunque la cáscara sea
   * oscura: en una cáscara oscura, `--ink` es claro y ofrecerlo como candidato deja a un club de
   * primario claro sin ninguna opción legible (con #FFD400 daba 1.36:1).
   *
   * Hoy `decidirTinta` ya no recibe tinta de cáscara —el bug no se puede reintroducir sin volver a
   * agregarle un parámetro—, así que lo que se pinea acá es el otro lado: que la tinta que sí elige
   * es la oscura, y que INK_CLARA habría perdido contra blanco si hubiera seguido siendo candidata.
   */
  it('sobre un acento claro elige tinta oscura aunque la cáscara sea oscura', () => {
    expect(peorContrasteTest('#FFD400', INK_CLARA))
      .toBeLessThan(peorContrasteTest('#FFD400', '#ffffff'));
    const enCascaraOscura = decidirTinta('#FFD400');
    expect(enCascaraOscura.usaBlanco).toBe(false);
    expect(enCascaraOscura.ratio).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Y el CSS que sale de ahí tampoco puede depender de la cáscara: devolver `var(--ink)` lo resolvía
   * el contexto donde se escribe (el `<html>`), pero dejaba a la hoja mintiendo sobre qué tinta es.
   * La tinta legible sobre el acento es un hex oscuro literal, siempre.
   */
  it('la tinta legible sobre el acento es un hex oscuro literal, no var(--ink)', () => {
    expect(inkOnAccent('#FFD400')).toBe(INK_OSCURA);
  });

  it('cae en blanco (ratio 0) si el fondo no es parseable', () => {
    // El guard de decidirTinta: sin fondo válido no hay nada que medir y el default es blanco.
    expect(decidirTinta('no-es-un-color')).toEqual({ usaBlanco: true, ratio: 0 });
  });

  it('cae en blanco si el color no es parseable', () => {
    expect(inkOnAccent('no-es-un-color')).toBe('#fff');
    expect(inkOnAccent(null)).toBe('#fff');
  });
});
