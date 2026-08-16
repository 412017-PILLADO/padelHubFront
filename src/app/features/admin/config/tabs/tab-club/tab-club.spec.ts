import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { inkOnAccent } from '../../../../../core/branding/tenant-colors';
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
    // La D está en el catálogo porque el back la acepta, pero `shellDePlantilla()` la manda a la C:
    // un dueño que la eligiera vería la plantilla C y pensaría que se rompió algo.
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

/**
 * La galería (spec §7). Los tests de arriba miran la LISTA que el componente expone; éstos miran lo
 * que el dueño del club realmente ve y toca, que es lo único que cambia con esta pantalla: hasta
 * ahora elegía leyendo "B · Nocturna — Oscura, luz de cancha" y teniendo que imaginarse el resto.
 *
 * Acá sí se monta el componente entero (`createComponent`), porque lo que se verifica es el DOM.
 */
describe('la galería de plantillas del panel', () => {
  function montarTab() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TabClubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        MessageService,
        ConfigStateService,
      ],
    });
    const fixture = TestBed.createComponent(TabClubComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('YA NO hay un <select> de plantillas', () => {
    // La razón de ser de toda la pantalla. Si el select sobrevive, se agregó una galería AL LADO en
    // vez de reemplazarlo, y el dueño queda con dos controles que dicen lo mismo y se pueden
    // contradecir.
    const host = montarTab().nativeElement as HTMLElement;
    expect(host.querySelector('.plantilla-sel')).toBeNull();
    expect(host.querySelector('select')).toBeNull();
  });

  it('dibuja una miniatura por cáscara existente, y ninguna más', () => {
    const host = montarTab().nativeElement as HTMLElement;
    const thumbs = [...host.querySelectorAll('plantilla-thumb')];
    expect(thumbs.map((t) => t.getAttribute('data-tpl'))).toEqual([...CODIGOS_CON_SHELL]);
  });

  it('cada miniatura es un radio de verdad, para poder elegir con el teclado', () => {
    // Una grilla de <div> con (click) deja al dueño sin teclado y sin lector de pantalla. Los radios
    // nativos traen las flechas, el agrupamiento y el nombre accesible sin escribir un handler.
    const host = montarTab().nativeElement as HTMLElement;
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(CODIGOS_CON_SHELL.length);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
  });

  it('elegir una miniatura llama a setMarcaPlantilla, que es lo que ya sabía guardar', () => {
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector<HTMLInputElement>('input[type="radio"][value="B"]')!.click();
    fixture.detectChanges();

    expect(estado.marcaPlantilla()).toBe('B');
    expect(estado.dirty()).toBe(true);
  });

  it('con una plantilla guardada SIN cáscara, marca la que se dibuja de verdad', () => {
    // Caso real, no hipotético: el tenant `demo` quedó guardado en 'D', la plantilla que el owner
    // descartó y que ya no tiene cáscara. Con el valor crudo ninguna de las cuatro matcheaba y la
    // galería salía SIN NADA SELECCIONADO, mientras la landing pública dibujaba la default (C desde
    // el 2026-08-16). El panel no le decía al dueño qué está viendo su jugador. Lo encontró el e2e,
    // con la base real.
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    estado.marcaPlantilla.set('D');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const marcadas = [...host.querySelectorAll('.gal-item.sel plantilla-thumb')];
    expect(marcadas, 'ninguna miniatura quedó marcada').toHaveLength(1);
    expect(marcadas[0].getAttribute('data-tpl')).toBe('C');
  });

  it('mostrar el fallback NO reescribe la plantilla guardada', () => {
    // Marcar la A no puede persistir la A: reescribirle al dueño un dato por haber entrado a mirar
    // la pantalla sería peor que el bug que esto arregla.
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    estado.marcaPlantilla.set('D');
    fixture.detectChanges();

    expect(estado.marcaPlantilla()).toBe('D');
    expect(estado.dirty()).toBe(false);
  });

  it('la grilla publica el color DEL FORMULARIO, no el guardado', () => {
    // El dueño arrastra el color picker y las cuatro miniaturas se repintan al instante. Si tomaran
    // el color del :root (el que aplicó BrandingService al cargar la pantalla), mostrarían el color
    // VIEJO hasta guardar — o sea que la galería contestaría la pregunta equivocada.
    const fixture = montarTab();
    TestBed.inject(ConfigStateService).setMarcaColor('#ff2d95');
    fixture.detectChanges();

    const grilla = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.galeria')!;
    expect(grilla.style.getPropertyValue('--court').trim()).toBe('#ff2d95');
  });

  it('la tinta sobre el color sale de inkOnAccent y no de un hardcode', () => {
    // Un club amarillo con texto blanco encima es ilegible, y las miniaturas de A y de E ponen texto
    // sobre la masa de color. Es la MISMA función pura que decide la tinta del producto real.
    const fixture = montarTab();
    const estado = TestBed.inject(ConfigStateService);
    for (const color of ['#ffd400', '#111111', '#ffffff']) {
      estado.setMarcaColor(color);
      fixture.detectChanges();
      const grilla = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.galeria')!;
      expect(grilla.style.getPropertyValue('--ink-on-accent').trim()).toBe(inkOnAccent(color));
    }
  });
});
