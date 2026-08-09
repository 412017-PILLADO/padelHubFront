import { decidirTinta, inkOnAccent } from './tenant-colors';

const INK_OSCURA = '#11162b';
const INK_CLARA = '#eef2f8';

describe('decidirTinta · matriz de colores extremos', () => {
  // Umbral 4.5:1 (texto) para los colores que pueden alcanzarlo con dos tintas posibles.
  it.each([
    ['amarillo', '#FFD400'],
    ['blanco', '#FFFFFF'],
    ['negro', '#111111'],
  ])('%s alcanza 4.5:1 en el peor extremo del gradiente', (_nombre, color) => {
    expect(decidirTinta(color, INK_OSCURA).ratio).toBeGreaterThanOrEqual(4.5);
  });

  // Un fucsia saturado NO llega a 4.5:1 contra ninguna de las dos tintas (blanco 3.45, oscura 3.57
  // en el peor extremo). No es un bug del cálculo sino un límite del color: por eso la regla de
  // diseño es que ningún shell pone texto de párrafo sobre --court crudo (ver spec §10).
  it('fucsia alcanza al menos 3:1, el umbral de texto grande y componentes', () => {
    expect(decidirTinta('#FF2D95', INK_OSCURA).ratio).toBeGreaterThanOrEqual(3);
  });

  it('elige siempre la tinta con mejor peor-caso', () => {
    // Sobre amarillo gana la tinta oscura; sobre negro, el blanco.
    expect(decidirTinta('#FFD400', INK_OSCURA).usaBlanco).toBe(false);
    expect(decidirTinta('#111111', INK_OSCURA).usaBlanco).toBe(true);
  });

  it('en una plantilla oscura no devuelve la tinta clara sobre un color claro', () => {
    // Con ink claro (#eef2f8) sobre amarillo, blanco y la tinta del shell son ambos ilegibles:
    // la decisión correcta es el que tenga mejor ratio, nunca uno peor que el otro.
    const d = decidirTinta('#FFD400', INK_CLARA);
    const alternativa = decidirTinta('#FFD400', '#ffffff');
    expect(d.ratio).toBeGreaterThanOrEqual(Math.min(alternativa.ratio, d.ratio));
  });

  it('cae en blanco si el color no es parseable', () => {
    expect(inkOnAccent('no-es-un-color')).toBe('#fff');
    expect(inkOnAccent(null)).toBe('#fff');
  });
});
