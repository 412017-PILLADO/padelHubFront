import { TestBed } from '@angular/core/testing';
import { PRIME_NG_CONFIG } from 'primeng/config';

import { appConfig } from './app.config';

/**
 * El anillo de foco de la plantilla B (`landing/shells/b-nocturna/shell.scss`) empata en
 * ESPECIFICIDAD con el `:focus-visible` propio de PrimeNG, y el empate lo gana PrimeNG por ORDEN de
 * inyección: su tema entra al `<head>` en runtime, después de los estilos de componente. De eso
 * depende que el anillo claro de B no se pinte encima del panel BLANCO del datepicker, donde
 * mediría 1,26:1 con un club amarillo.
 *
 * `cssLayer: true` en `providePrimeNG` da vuelta ese empate de un renglón: mete las reglas de
 * PrimeNG en una cascade layer, y una regla EN capa pierde contra una regla SIN capa sin importar
 * el orden. Es una opción que se agrega por un motivo legítimo y ajeno (domar la especificidad de
 * PrimeNG contra el CSS de la app), sin manera de sospechar que rompe un anillo de foco tres
 * carpetas más allá. Este test es esa sospecha, escrita.
 */
describe('app.config · providePrimeNG', () => {
  it('NO activa cssLayer: de eso depende el anillo de foco de la plantilla B', () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
    const config = TestBed.inject(PRIME_NG_CONFIG) as { theme?: { options?: { cssLayer?: unknown } } };

    expect(
      config.theme?.options?.cssLayer,
      'cssLayer mete a PrimeNG en una cascade layer y le hace PERDER el empate con el ' +
        '`:host ::ng-deep :focus-visible` de landing/shells/b-nocturna/shell.scss, que pasaría a ' +
        'pintar su anillo claro sobre el panel BLANCO del datepicker (1,26:1 con un club amarillo). ' +
        'Leé ese bloque de shell.scss antes de tocar esto: documenta el empate y el arreglo (una ' +
        'regla propia para `.cal :focus-visible`). Si se activa a propósito, primero el arreglo.',
    ).toBeUndefined();
  });
});
