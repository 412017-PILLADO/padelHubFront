import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { CODIGOS_CON_SHELL, CODIGOS_PLANTILLA, DIR_SHELL, PLANTILLAS } from '../../../../../core/landing/plantillas';
import { ConfigStateService } from '../../config-state.service';
import { TabClubComponent } from './tab-club';

/**
 * El selector de plantillas del panel es lo ÚNICO que decide qué puede elegir un dueño de club, y
 * durante toda la fase E fue una lista escrita a mano: la E estaba construida, pasaba el e2e y no
 * llegaba a nadie porque el `<select>` ofrecía A, B y C nada más. Un catálogo que crece sin que el
 * selector crezca con él es un modo de falla silencioso — la suite entera en verde y la plantilla
 * nueva inalcanzable.
 *
 * Esta es esa obligación hecha puerta: la lista esperada sale del registry (`DIR_SHELL` →
 * `CODIGOS_CON_SHELL`) y no de acá, así que dar de alta una cáscara la mete sola en el selector o
 * pone esto en rojo. Escribir la lista a mano en el propio spec sería repetir el defecto un nivel
 * más abajo.
 *
 * `runInInjectionContext` en vez de `createComponent`: lo que se verifica es la lista que el
 * componente expone, no su template, y así no hace falta montar el estado entero de la pantalla.
 */
function crearTab(): TabClubComponent {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), MessageService, ConfigStateService],
  });
  return TestBed.runInInjectionContext(() => new TabClubComponent());
}

describe('el selector de plantillas del panel', () => {
  it('ofrece exactamente los códigos que hoy tienen cáscara', () => {
    const ofrecidos = crearTab().plantillas.map((p) => p.value);
    expect(ofrecidos).toEqual([...CODIGOS_CON_SHELL]);
  });

  it('no ofrece plantillas del catálogo que todavía no tienen cáscara', () => {
    // La D está en el catálogo porque el back la acepta, pero `shellDePlantilla()` la manda a la A:
    // un dueño que la eligiera vería la plantilla A y pensaría que se rompió algo.
    const ofrecidos = new Set(crearTab().plantillas.map((p) => p.value as string));
    const sinCascara = CODIGOS_PLANTILLA.filter((c) => !(c in DIR_SHELL));
    for (const codigo of sinCascara) {
      expect(ofrecidos.has(codigo), `el selector ofrece ${codigo}, que no tiene cáscara`).toBe(false);
    }
  });

  it('usa el nombre y la descripción del registry, sin copias a mano', () => {
    for (const p of crearTab().plantillas) {
      const ficha = PLANTILLAS[p.value];
      expect(p.label).toBe(`${p.value} · ${ficha.nombre}`);
      expect(p.hint).toBe(ficha.descripcion);
    }
  });
});
