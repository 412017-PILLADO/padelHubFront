import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { BookingService } from '../../../../core/api/booking.service';
import { ClubStore } from '../../club.store';
import { BookingStore } from '../../booking/booking.store';
import { PLANTILLAS, urlFuentes } from '../../../../core/landing/plantillas';
import { ShellBComponent } from './shell';

/** Doble del servicio: la cáscara no debe pegarle a la red para montarse. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
};

/**
 * B es la primera cáscara con par tipográfico propio (spec §6.2), y por lo tanto la primera que
 * enchufa `cargarFuentes()`. Sin este test, que la cáscara dejara de pedir su hoja no rompe nada
 * visible en los e2e: la landing seguiría dibujándose, pero con la tipografía de plataforma.
 */
describe('ShellB · tipografía por plantilla', () => {
  it('pide la hoja de Anton/Inter Tight/JetBrains Mono al montarse', () => {
    TestBed.configureTestingModule({
      imports: [ShellBComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        // En la app los provee `Landing`; acá la cáscara los toma de este injector.
        MessageService,
        ClubStore,
        BookingStore,
        { provide: BookingService, useValue: bookingFalso },
      ],
    });
    TestBed.createComponent(ShellBComponent);

    const doc = TestBed.inject(DOCUMENT);
    const esperada = urlFuentes(PLANTILLAS.B.fuentes);
    // Se comparan los `href` a mano en vez de con `link[href="…"]`: el motor de selectores de jsdom
    // (nwsapi) NO matchea un valor de atributo que contenga `&`, y la URL de css2 lleva uno por
    // familia. Verificado aparte: con `&` da null aunque el atributo sea idéntico; sin `&`, matchea.
    const hojas = Array.from(doc.head.querySelectorAll('link')).map((l) => l.getAttribute('href'));
    expect(hojas).toContain(esperada);
  });
});
