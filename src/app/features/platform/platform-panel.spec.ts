import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  CODIGOS_CON_SHELL,
  CODIGOS_PLANTILLA,
  DIR_SHELL,
  PLANTILLA_DEFAULT,
  PLANTILLAS,
} from '../../core/landing/plantillas';
import { PlatformPanelComponent } from './platform-panel';

/**
 * El panel de plataforma es por donde se dan de alta los clubes, así que su selector de plantillas
 * decide con qué diseño nace cada cliente nuevo. Tenía la misma lista escrita a mano que ya se
 * corrigió en el panel del dueño —era la 5ta copia— y estaba vieja de las dos puntas: ofrecía sólo
 * A/B/C (la E, construida y andando, no se podía elegir desde acá) y describía a la C con el rail
 * lateral que el rediseño le sacó.
 *
 * Las dos puertas de abajo son la misma obligación que la de `tab-club.spec.ts`, en la otra pantalla
 * que elige plantilla. La lista esperada sale del registry, nunca de acá.
 */
function crearPanel(): PlatformPanelComponent {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return TestBed.runInInjectionContext(() => new PlatformPanelComponent());
}

describe('el selector de plantillas del panel de plataforma', () => {
  it('ofrece exactamente los códigos que hoy tienen cáscara', () => {
    expect(crearPanel().plantillas.map((p) => p.value)).toEqual([...CODIGOS_CON_SHELL]);
  });

  it('no ofrece plantillas del catálogo que todavía no tienen cáscara', () => {
    const ofrecidos = new Set(crearPanel().plantillas.map((p) => p.value as string));
    for (const codigo of CODIGOS_PLANTILLA.filter((c) => !(c in DIR_SHELL))) {
      expect(ofrecidos.has(codigo), `el selector ofrece ${codigo}, que no tiene cáscara`).toBe(false);
    }
  });

  it('usa el nombre y la descripción del registry, sin copias a mano', () => {
    for (const p of crearPanel().plantillas) {
      const ficha = PLANTILLAS[p.value];
      expect(p.label).toBe(`${p.value} · ${ficha.nombre}`);
      expect(p.hint).toBe(ficha.descripcion);
    }
  });
});

/**
 * La default de producto, del lado del alta por UI.
 *
 * Es la puerta que faltaba y por eso se coló el defecto: "C es la default" estaba escrito sólo en el
 * fallback de `normalizarPlantilla()`, que se aplica a un valor desconocido — y el alta nunca manda
 * uno desconocido, manda el del form. Con el form en 'A', ningún club nuevo salía en C por más que
 * el registry dijera lo contrario.
 */
describe('el alta de un club', () => {
  it('arranca con la plantilla por defecto del producto preseleccionada', () => {
    expect(crearPanel().fPlantilla()).toBe(PLANTILLA_DEFAULT);
  });

  it('vuelve a la default al resetear el form, y no a un código escrito a mano', () => {
    const panel = crearPanel();
    panel.fPlantilla.set('B');
    // `resetForm` es privado: se ejerce por el camino real, que es cerrar y reabrir el alta tras
    // crear. Lo que importa es que el próximo club no herede la elección del anterior.
    (panel as unknown as { resetForm: () => void }).resetForm();
    expect(panel.fPlantilla()).toBe(PLANTILLA_DEFAULT);
  });
});
