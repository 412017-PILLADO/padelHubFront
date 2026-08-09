import {
  CODIGOS_CON_SHELL,
  CODIGOS_PLANTILLA,
  FUENTES_PLATAFORMA,
  PLANTILLAS,
  normalizarPlantilla,
  shellDePlantilla,
  urlFuentes,
} from './plantillas';

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
   * Este es el test caro del archivo: `index.html` sirve HOY este `<link>` textual, y acá se pinea
   * contra el registry. Si alguien toca los ejes de `urlFuentes`, o las familias de la plantilla A,
   * o la línea del HTML, salta.
   *
   * Ojo con "simplificar" los ejes a `wght@400;500;600;700;800` para todas las familias: Archivo es
   * variable con eje de ANCHO además del de peso, y `.display { font-stretch: 125% }` en
   * styles.scss vive de eso. Pidiendo sólo `wght`, Google devuelve `font-stretch: 100%` y el
   * display de las tres plantillas adelgaza.
   */
  it('la URL del trío de plataforma es, textual, la del <link> de index.html', () => {
    const enIndexHtml =
      'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900' +
      '&family=Hanken+Grotesk:wght@400;500;600;700;800' +
      '&family=Space+Mono:wght@400;700&display=swap';
    expect(urlFuentes(FUENTES_PLATAFORMA)).toBe(enIndexHtml);
    // Hoy la plantilla A usa el mismo trío; si el rediseño la separa, este expect es el aviso.
    expect(urlFuentes(PLANTILLAS.A.fuentes)).toBe(enIndexHtml);
  });

  it('pide de cada familia sólo los pesos que Google publica', () => {
    // Anton tiene un único peso y Space Mono sólo 400/700: pedirles 500;600;800 devuelve 200 pero
    // sin esas caras, así que la URL queda mintiendo. Se piden exactos.
    expect(urlFuentes(['Anton'])).toContain('family=Anton:wght@400&');
    expect(urlFuentes(['Space Mono'])).toContain('family=Space+Mono:wght@400;700&');
  });

  it('sin familias no arma una URL vacía de css2', () => {
    expect(urlFuentes([])).toBe('');
  });

  /**
   * `normalizarPlantilla` contesta "¿existe?" y `shellDePlantilla` "¿qué puedo dibujar?". Un tenant
   * en D existe (el back ya acepta los cinco códigos) pero todavía no tiene cáscara, así que se
   * dibuja con la A — y el host tiene que publicar 'A', no 'D', o el `:host([data-tpl='A'])` de
   * landing.scss no engancha y el afiche pierde su clamp de viewport.
   */
  it('las plantillas sin cáscara se dibujan con la A', () => {
    expect(CODIGOS_CON_SHELL).toEqual(['A', 'B', 'C']);
    expect(normalizarPlantilla('D')).toBe('D');
    expect(shellDePlantilla('D')).toBe('A');
    expect(shellDePlantilla('E')).toBe('A');
    expect(shellDePlantilla('b')).toBe('B');
    expect(shellDePlantilla('Z')).toBe('A');
    expect(shellDePlantilla(null)).toBe('A');
  });

  it('todo código con cáscara es un código del catálogo', () => {
    for (const codigo of CODIGOS_CON_SHELL) expect(CODIGOS_PLANTILLA).toContain(codigo);
  });
});
