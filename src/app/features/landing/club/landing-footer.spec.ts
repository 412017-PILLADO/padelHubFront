import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BookingService, PublicConfig } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';
import { LandingFooterComponent } from './landing-footer';

/** Doble del servicio: el pie no debe pegarle a la red para pintarse. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
};

const CONFIG_CON_POLITICA = {
  tenant: { nombre: 'Club', plantilla: 'A' },
  complejo: { id: 1, nombre: 'Costa Pádel' },
  politicaCancelacion: 'Cancelás hasta 12 horas antes sin costo.',
  canchas: [],
} as unknown as PublicConfig;

/**
 * El cambio de comportamiento del refactor que unificó los tres pies: los links ya no llaman a un
 * método de `Landing`, sino que emiten outputs que la landing cablea a los modales. El e2e
 * `arrepentimiento.spec.ts` cubre el de arrepentimiento de punta a punta; el de la política no lo
 * clickea nadie, así que la regresión de los dos se cubre acá.
 */
describe('LandingFooterComponent · links del pie', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [LandingFooterComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: BookingService, useValue: bookingFalso },
        // En la app lo provee `Landing`; acá el componente lo toma de este injector.
        ClubStore,
      ],
    });

    const fixture = TestBed.createComponent(LandingFooterComponent);
    TestBed.inject(ClubStore).config.set(CONFIG_CON_POLITICA);
    fixture.detectChanges();
    return fixture;
  }

  it('emite abrirArrepentimiento cuando se clickea el link', () => {
    const fixture = montar();
    const emisiones: void[] = [];
    fixture.componentInstance.abrirArrepentimiento.subscribe((v) => emisiones.push(v));

    fixture.nativeElement.querySelector('.arrep-link').click();
    expect(emisiones.length).toBe(1);
  });

  it('emite abrirPolitica cuando se clickea el link', () => {
    const fixture = montar();
    const emisiones: void[] = [];
    fixture.componentInstance.abrirPolitica.subscribe((v) => emisiones.push(v));

    fixture.nativeElement.querySelector('.politica-link').click();
    expect(emisiones.length).toBe(1);
  });

  it('no muestra el link de política si el club no cargó una', () => {
    const fixture = montar();
    TestBed.inject(ClubStore).config.set({
      ...CONFIG_CON_POLITICA,
      politicaCancelacion: null,
    } as PublicConfig);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.politica-link')).toBeNull();
    // El de arrepentimiento es exigencia legal (Res. 424/2020): está siempre.
    expect(fixture.nativeElement.querySelector('.arrep-link')).not.toBeNull();
  });

  it('muestra el © con el nombre del club', () => {
    const fixture = montar();
    expect(fixture.nativeElement.querySelector('.foot-copy').textContent).toContain('Costa Pádel');
  });
});
