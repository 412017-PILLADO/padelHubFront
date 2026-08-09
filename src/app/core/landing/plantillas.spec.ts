import { CODIGOS_PLANTILLA, PLANTILLAS, normalizarPlantilla, urlFuentes } from './plantillas';

describe('registry de plantillas', () => {
  it('tiene las cinco plantillas con datos completos', () => {
    expect(CODIGOS_PLANTILLA).toEqual(['A', 'B', 'C', 'D', 'E']);
    for (const codigo of CODIGOS_PLANTILLA) {
      const p = PLANTILLAS[codigo];
      expect(p.nombre.length).toBeGreaterThan(0);
      expect(p.fuentes.length).toBeGreaterThan(0);
      expect(['light', 'dark']).toContain(p.esquema);
      expect(p.inkHex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('B es la única oscura', () => {
    const oscuras = CODIGOS_PLANTILLA.filter((c) => PLANTILLAS[c].esquema === 'dark');
    expect(oscuras).toEqual(['B']);
  });

  it('E reusa el par tipográfico de B (no agrega fuentes al catálogo)', () => {
    expect(PLANTILLAS.E.fuentes).toEqual(PLANTILLAS.B.fuentes);
  });

  it('normaliza cualquier basura a la plantilla A', () => {
    expect(normalizarPlantilla('b')).toBe('B');
    expect(normalizarPlantilla('Z')).toBe('A');
    expect(normalizarPlantilla(null)).toBe('A');
    expect(normalizarPlantilla('')).toBe('A');
  });

  it('arma la URL de Google Fonts con todas las familias', () => {
    const url = urlFuentes(['Anton', 'Inter Tight']);
    expect(url).toContain('family=Anton');
    expect(url).toContain('family=Inter+Tight');
    expect(url).toContain('display=swap');
  });

  /**
   * El `<link>` global que sacamos de index.html pedía Archivo con el eje de ANCHO
   * (`wdth,wght@100..125,400..900`), que es de lo que vive `.display { font-stretch: 125% }` en
   * styles.scss. Pidiendo sólo `wght`, Google devuelve `font-stretch: 100%` y el display de las tres
   * plantillas adelgaza. Por eso los ejes van por familia y no fijos — ver EJES_POR_FAMILIA.
   */
  it('la URL de la plantilla A es la misma que traía el <link> global de index.html', () => {
    expect(urlFuentes(PLANTILLAS.A.fuentes)).toBe(
      'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900' +
        '&family=Hanken+Grotesk:wght@400;500;600;700;800' +
        '&family=Space+Mono:wght@400;700&display=swap'
    );
  });

  it('pide de cada familia sólo los pesos que Google publica', () => {
    // Anton tiene un único peso y Space Mono sólo 400/700: pedirles 500;600;800 devuelve 200 pero
    // sin esas caras, así que la URL queda mintiendo. Se piden exactos.
    expect(urlFuentes(['Anton'])).toContain('family=Anton:wght@400&');
    expect(urlFuentes(['Space Mono'])).toContain('family=Space+Mono:wght@400;700&');
  });
});
