import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ClubStore } from './club.store';

/**
 * Los params de preview que el panel necesita para que su iframe no mienta. `?plantilla=` y
 * `?color=` ya existían (la herramienta de venta); estos dos son nuevos y nacen de dos agujeros
 * concretos, no de completitud:
 *
 *  - sin `?color2=`, un dueño que está editando el secundario ve en el preview el secundario VIEJO,
 *    o sea que el preview miente sobre la mitad de la marca justo mientras la está tocando;
 *  - sin `?panel=1`, el selector flotante de venta aparece adentro del iframe y deja elegir una
 *    plantilla de la que el formulario del panel nunca se entera — se vería una y se guardaría otra.
 *
 * La herramienta de venta no se toca: sin `?panel=1` todo sigue igual, y eso también se verifica acá.
 */
function storeConUrl(query: string): ClubStore {
  history.replaceState(null, '', `/${query}`);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideHttpClient(), ClubStore],
  });
  return TestBed.inject(ClubStore);
}

describe('ClubStore · los params del preview del panel', () => {
  it('?color2= pisa el secundario, con el mismo formato que ?color=', () => {
    const store = storeConUrl('?color=%23ff2d95&color2=%23ffd400');
    expect(store.previewColor()).toBe('#ff2d95');
    expect(store.previewColorSec()).toBe('#ffd400');
  });

  it('un ?color2= malformado se ignora en vez de romper la landing', () => {
    expect(storeConUrl('?color2=rojo').previewColorSec()).toBeNull();
    expect(storeConUrl('?color2=%23zzz').previewColorSec()).toBeNull();
  });

  it('?panel=1 apaga el selector flotante de venta', () => {
    expect(storeConUrl('?plantilla=B&panel=1').previewSinSelector()).toBe(true);
  });

  it('sin ?panel=1 el selector sigue estando: la herramienta de venta no se toca', () => {
    expect(storeConUrl('?plantilla=B').previewSinSelector()).toBe(false);
  });
});
