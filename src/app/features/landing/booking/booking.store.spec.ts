import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MessageService } from 'primeng/api';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { BookingService, PublicConfig, Slot } from '../../../core/api/booking.service';
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

/**
 * Config pública mínima y válida. Hace falta un payload REAL (y no `of(null)`) para que
 * `ClubStore.cargar()` llegue a `estadoCarga() === 'ok'`: recién ahí el effect del constructor del
 * store dispara `initDefaultDay()`, que es lo que mide el test del día por default.
 */
function configMinima(): PublicConfig {
  return {
    tenant: {
      nombre: 'Club Test', colorPrimario: '#112233', colorSecundario: null, fuente: '',
      logoUrl: null, mostrarPrecios: false, requiereTelefono: true, plantilla: 'A',
    },
    complejo: {
      id: 1, nombre: 'Club Test', direccion: null, telefono: null, whatsapp: null,
      mapaUrl: null, instagram: null,
    },
    pasoMinutos: 30,
    duracionesPermitidas: [60, 90],
    duracionDefault: 90,
    permitirOtrasDuraciones: true,
    requiereSena: false, senaMonto: null, senaAlias: null,
    autoasignacion: false, pagoOnline: false,
    politicaCancelacion: null,
    precioFranjas: [],
    canchas: [],
    horarios: [],
  };
}

/** Un slot mínimo: al store le alcanza con la hora para lo que miden estos tests. */
function slot(hora: string): Slot {
  return { hora, disponible: true, canchasLibres: [] };
}

describe('BookingStore · disponibilidad fuera de orden', () => {
  let store: BookingStore;
  let enVuelo: Subject<Slot[]>[];

  beforeEach(() => {
    enVuelo = [];
    // A diferencia del `bookingFalso` de arriba (que responde ya, con `of([])`), este entrega un
    // Subject por llamada y lo guarda: así el test decide el ORDEN en que contestan.
    const bookingDemorado = {
      config: () => of(configMinima()),
      disponibilidad: () => {
        const s = new Subject<Slot[]>();
        enVuelo.push(s);
        return s.asObservable();
      },
      crearReserva: () => of(null as never),
      crearLinkSena: () => of({ initPoint: '' }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: BookingService, useValue: bookingDemorado },
        MessageService,
        ClubStore,
        BookingStore,
      ],
    });
    store = TestBed.inject(BookingStore);
  });

  it('descarta la respuesta que llega tarde y deja la del día elegido', () => {
    store.selectDay(new Date(2026, 0, 10));
    store.selectDay(new Date(2026, 0, 11));
    expect(enVuelo).toHaveLength(2);

    // El día NUEVO contesta primero y el VIEJO después: es el orden que rompía la grilla.
    enVuelo[1].next([{ hora: '11:00', disponible: true, canchasLibres: [] } as unknown as Slot]);
    enVuelo[0].next([{ hora: '09:00', disponible: true, canchasLibres: [] } as unknown as Slot]);

    expect(store.slots().map((s) => s.hora)).toEqual(['11:00']);
  });

  it('el error de un pedido viejo no apaga el spinner del nuevo', () => {
    const toasts = vi.spyOn(TestBed.inject(MessageService), 'add');
    store.selectDay(new Date(2026, 0, 10));
    store.selectDay(new Date(2026, 0, 11));

    enVuelo[0].error(new Error('el pedido viejo falló tarde'));

    expect(store.loadingSlots()).toBe(true);
    expect(store.slotsLoaded()).toBe(false);
    // El toast también entra en la guarda: avisar "no pudimos cargar los turnos" por un día que el
    // visitante ya no tiene en pantalla es justamente lo que el comentario del brazo `error` nombra.
    expect(toasts).not.toHaveBeenCalled();
  });

  /**
   * La otra mitad de la misma carrera: `initDefaultDay()` calcula un DEFAULT (la primera de
   * hoy/mañana/pasado con disponibilidad) con un forkJoin de 3 sondas que sale del effect del
   * constructor. Los `.dur-chips` recién se pintan cuando resuelve la config, o sea DESPUÉS de que
   * ese forkJoin ya salió: el visitante (o Playwright) alcanza a clickear un día mientras las 3
   * sondas siguen en vuelo. Sin guarda, el forkJoin llegaba tarde y le pisaba el día Y la grilla.
   */
  it('el día por default no pisa el día que el visitante ya eligió', () => {
    // El effect espera `estadoCarga() === 'ok'`, así que hay que cargar la config y flushear el
    // effect (Angular difiere su primera corrida).
    TestBed.inject(ClubStore).cargar();
    TestBed.tick();
    expect(enVuelo).toHaveLength(3); // las 3 sondas de hoy/mañana/pasado, todavía sin contestar

    // El visitante elige un día mientras las sondas están en vuelo, y SU pedido contesta primero.
    store.selectDay(new Date(2026, 0, 11));
    expect(enVuelo).toHaveLength(4);
    enVuelo[3].next([slot('11:00')]);

    // Recién ahora contestan (y completan) las 3 sondas: el forkJoin emite tarde.
    for (const sonda of enVuelo.slice(0, 3)) {
      sonda.next([slot('07:00')]);
      sonda.complete();
    }

    expect(store.selectedDay()).toEqual(new Date(2026, 0, 11));
    expect(store.slots().map((s) => s.hora)).toEqual(['11:00']);
  });
});
