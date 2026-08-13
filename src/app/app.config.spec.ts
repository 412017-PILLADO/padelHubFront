import { TestBed } from '@angular/core/testing';
import { PRIME_NG_CONFIG } from 'primeng/config';

import { appConfig } from './app.config';

/**
 * La plantilla B aclara el anillo de foco para que se vea sobre su telón nocturno: declara
 * `--anillo-foco` en `landing/shells/b-nocturna/_tokens.scss` y la regla `:focus-visible` GLOBAL de
 * `styles.scss` lo consume. Adentro de B hay una isla que NO es nocturna —el panel BLANCO del
 * datepicker, que `.cal.open` monta dentro del host—, y ahí ese anillo claro mediría 1,26:1 con un
 * club amarillo. Hoy no se pinta porque PrimeNG trae su propio `:focus-visible`
 * (`.p-datepicker-select-month:focus-visible`, 0,2,0) y le gana por ESPECIFICIDAD al
 * `:focus-visible` pelado de la hoja global (0,1,0).
 *
 * `cssLayer: true` en `providePrimeNG` da vuelta esa jerarquía de un renglón: mete las reglas de
 * PrimeNG en una cascade layer, y una regla EN capa pierde contra una regla SIN capa sin importar
 * especificidad ni orden. Es una opción que se agrega por un motivo legítimo y ajeno (domar la
 * especificidad de PrimeNG contra el CSS de la app), sin manera de sospechar que rompe un anillo de
 * foco tres carpetas más allá. Este test es esa sospecha, escrita.
 */
describe('app.config · providePrimeNG', () => {
  it('NO activa cssLayer: de eso depende el anillo de foco de la plantilla B', () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
    const config = TestBed.inject(PRIME_NG_CONFIG) as { theme?: { options?: { cssLayer?: unknown } } };

    expect(
      config.theme?.options?.cssLayer,
      'cssLayer mete a PrimeNG en una cascade layer y le hace PERDER contra el `:focus-visible` ' +
        'global de styles.scss, que pasaría a pintar el `--anillo-foco` claro de la plantilla B ' +
        'sobre el panel BLANCO del datepicker (1,26:1 con un club amarillo). Leé el comentario de ' +
        '`--anillo-foco` en landing/shells/b-nocturna/_tokens.scss antes de tocar esto: documenta ' +
        'el mecanismo y el arreglo (volver a declarar el token para `.cal`). Si se activa a ' +
        'propósito, primero el arreglo.',
    ).toBeUndefined();
  });
});
