import { urlPreviewLanding } from './preview-url';

/**
 * EL SRC DEL IFRAME DE LA GALERÍA, y la razón de que sea una función pura con tests propios: la
 * spec §7 dice "iframe a `/?plantilla=…` (mismo origen)" y eso es cierto en PRODUCCIÓN y falso en
 * DESARROLLO.
 *
 * El tenant se resuelve por SUBDOMINIO (`core/tenant/tenant.ts`) y la ruta '' tiene
 * `canMatch: tenantHostMatch`. En producción el panel vive en `<slug>.padel-hub.com.ar/admin`, así
 * que `/` ES la landing del club. En desarrollo el panel vive en `localhost:4400/admin`, sin
 * subdominio: ahí `/` no matchea la landing del club y cae en la landing de MARKETING, o sea que el
 * preview mostraría el producto en vez del club. Con un `src` relativo eso no se descubre hasta
 * abrirlo, y se descubre como "qué raro que se ve así".
 */
describe('urlPreviewLanding · el src del iframe de preview', () => {
  it('en PRODUCCIÓN, con subdominio de tenant, se queda en el mismo origen', () => {
    // El dominio base se pasa a mano porque los tests corren con el `environment` de desarrollo
    // (`baseDomain: 'localhost'`). Sin ese parámetro, el caso de producción —el único que la spec
    // §7 describe— sería IMPOSIBLE de verificar: un host de producción daría `null` acá adentro y
    // el iframe se iría a otro host. Es lo que motivó el parámetro, no al revés.
    const url = new URL(
      urlPreviewLanding(
        'https://costapadel.padel-hub.com.ar/admin/config?tab=club',
        { plantilla: 'B', color: '#ff2d95' },
        'padel-hub.com.ar',
      ),
    );
    expect(url.origin).toBe('https://costapadel.padel-hub.com.ar');
    expect(url.pathname).toBe('/');
  });

  it('en PRODUCCIÓN, desde el apex, no se queda en el apex', () => {
    // `padel-hub.com.ar/` es marketing. Si el panel alguna vez se sirviera desde ahí, el preview
    // tiene que irse igual al subdominio del club en vez de mostrar el sitio del producto.
    const url = new URL(
      urlPreviewLanding(
        'https://padel-hub.com.ar/admin',
        { plantilla: 'B', color: '#ff2d95' },
        'padel-hub.com.ar',
      ),
    );
    expect(url.hostname).not.toBe('padel-hub.com.ar');
    expect(url.hostname.endsWith('.padel-hub.com.ar')).toBe(true);
  });

  it('en el apex de DESARROLLO salta al subdominio del tenant de dev', () => {
    // Acá está el bug que esta función existe para no tener: `localhost:4400/` es marketing.
    const url = new URL(urlPreviewLanding('http://localhost:4400/admin/config', {
      plantilla: 'A',
      color: '#0a8a99',
    }));
    expect(url.hostname).toBe('demo.localhost');
    expect(url.port).toBe('4400');
  });

  it('conserva el protocolo y el puerto del panel', () => {
    const url = new URL(
      urlPreviewLanding('http://demo.localhost:4400/admin', { plantilla: 'C', color: '#111111' }),
    );
    expect(url.protocol).toBe('http:');
    expect(url.port).toBe('4400');
  });

  it('escribe los params que la landing sabe leer', () => {
    const url = new URL(
      urlPreviewLanding('http://demo.localhost:4400/admin', {
        plantilla: 'E',
        color: '#ffd400',
        colorSec: '#ff2d95',
      }),
    );
    expect(url.searchParams.get('plantilla')).toBe('E');
    expect(url.searchParams.get('color')).toBe('#ffd400');
    expect(url.searchParams.get('color2')).toBe('#ff2d95');
    // Sin esto aparece el selector flotante de venta adentro del iframe (ver ClubStore).
    expect(url.searchParams.get('panel')).toBe('1');
  });

  it('sin secundario NO escribe color2, para que gane el del tenant', () => {
    const url = new URL(
      urlPreviewLanding('http://demo.localhost:4400/admin', { plantilla: 'A', color: '#111111' }),
    );
    expect(url.searchParams.has('color2')).toBe(false);
  });
});
