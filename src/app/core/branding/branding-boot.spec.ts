import { brandingCacheKey, guardarMarcaCacheada, leerMarcaCacheada } from './branding-boot';

describe('caché de marca', () => {
  beforeEach(() => localStorage.clear());

  it('separa la marca por plantilla', () => {
    expect(brandingCacheKey('demo', 'A')).not.toBe(brandingCacheKey('demo', 'B'));
  });

  it('no devuelve la marca de otra plantilla del mismo club', () => {
    guardarMarcaCacheada('demo', 'A', { vars: { '--court': '#111' }, logoUrl: null });
    expect(leerMarcaCacheada('demo', 'B')).toBeNull();
    expect(leerMarcaCacheada('demo', 'A')?.vars['--court']).toBe('#111');
  });
});
