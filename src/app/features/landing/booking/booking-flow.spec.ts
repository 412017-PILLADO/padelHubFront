import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { BookingService, PublicConfig } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';
import { BookingStore } from './booking.store';
import { BookingFlowComponent } from './booking-flow';

/** Doble del servicio: el componente no debe pegarle a la red para pintar la pantalla de éxito. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
  crearReserva: () => of(null as never),
  crearLinkSena: () => of({ initPoint: '' }),
};

/** Lo mínimo que lee la pantalla de éxito de la config: el texto de la política (que es lo que hace
 *  aparecer el link) y el whatsapp del complejo (que usa `whatsappSenaUrl`). */
const CONFIG_CON_POLITICA = {
  tenant: { nombre: 'Club', plantilla: 'A' },
  complejo: { id: 1, nombre: 'Club', whatsapp: null },
  politicaCancelacion: 'Cancelás hasta 12 horas antes sin costo.',
  canchas: [],
} as unknown as PublicConfig;

/**
 * El único cambio de comportamiento del refactor que sacó el flujo de `landing.html`: el botón de
 * "Política de cancelación" del bloque de seña ya no llama a un método de `Landing`, sino que emite
 * un output que la landing cablea al modal. Ningún e2e clickea ese link, así que la regresión se
 * cubre acá.
 */
describe('BookingFlowComponent · política de cancelación en la pantalla de éxito', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [BookingFlowComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: BookingService, useValue: bookingFalso },
        // En la app los provee `Landing`; acá el componente los toma de este injector.
        MessageService,
        ClubStore,
        BookingStore,
      ],
    });

    const fixture = TestBed.createComponent(BookingFlowComponent);
    const club = TestBed.inject(ClubStore);
    const booking = TestBed.inject(BookingStore);

    club.config.set(CONFIG_CON_POLITICA);
    // Turno recién reservado y pendiente de seña: es el único estado que muestra el link.
    booking.successData.set({
      cancha: 'Cancha 1',
      dia: 'Viernes 9 ago',
      hora: '20:00 hs',
      duracion: 90,
      primerNombre: 'Mateo',
      nombreCompleto: 'Mateo Pillado',
      pendiente: true,
      senaMonto: '5.000',
      senaAlias: 'club.padel.mp',
    });
    booking.success.set(true);
    fixture.detectChanges();
    return fixture;
  }

  it('emite abrirPolitica cuando se clickea el link', () => {
    const fixture = montar();
    const emisiones: void[] = [];
    fixture.componentInstance.abrirPolitica.subscribe((v) => emisiones.push(v));

    const link = fixture.nativeElement.querySelector('.politica-link.sena-politica');
    expect(link).not.toBeNull();

    link.click();
    expect(emisiones.length).toBe(1);
  });

  it('no muestra el link si el club no cargó una política', () => {
    const fixture = montar();
    TestBed.inject(ClubStore).config.set({
      ...CONFIG_CON_POLITICA,
      politicaCancelacion: null,
    } as PublicConfig);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.politica-link.sena-politica')).toBeNull();
  });
});
