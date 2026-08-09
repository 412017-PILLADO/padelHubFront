import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BookingService } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';
import { BookingStore } from './booking.store';

/** Doble del servicio: el store no debe pegarle a la red para validar el formulario. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
  crearReserva: () => of(null as never),
  crearLinkSena: () => of({ initPoint: '' }),
};

describe('BookingStore · validación del formulario', () => {
  let store: BookingStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: BookingService, useValue: bookingFalso },
        // En la app lo provee el propio componente `Landing` (para el <p-toast>); acá va suelto
        // porque el store lo inyecta para los toasts de error del flujo de reserva.
        MessageService,
        ClubStore,
        BookingStore,
      ],
    });
    store = TestBed.inject(BookingStore);
  });

  it('no deja confirmar sin cancha elegida', () => {
    store.nombre.set('Mateo');
    store.whatsapp.set('3515123456');
    expect(store.canConfirm()).toBe(false);
    // El motivo queda en null a propósito: el paso de datos recién se abre con la cancha elegida
    // (formOpen = canchaDone), así que "te falta la cancha" nunca se muestra como hint.
    expect(store.confirmBlockedReason()).toBeNull();
  });

  it('rechaza un nombre de menos de 2 caracteres', () => {
    store.nombre.set('M');
    store.selectedCancha.set(store.ANY);
    expect(store.canConfirm()).toBe(false);
  });

  it('habilita confirmar con nombre, teléfono y cancha', () => {
    store.nombre.set('Mateo');
    store.whatsapp.set('3515123456');
    store.selectedCancha.set(store.ANY);
    expect(store.canConfirm()).toBe(true);
    expect(store.confirmBlockedReason()).toBeNull();
  });

  it('explica el motivo recién cuando el campo inválido ya fue tocado', () => {
    store.selectedCancha.set(store.ANY);
    store.nombre.set('M');
    expect(store.confirmBlockedReason()).toBe('Completá tu nombre y WhatsApp.');
    store.nombreTouched.set(true);
    expect(store.confirmBlockedReason()).toBe('Ingresá tu nombre (mínimo 2 letras).');
  });
});
