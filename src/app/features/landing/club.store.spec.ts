import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { agruparHorarios, ClubStore } from './club.store';
import { BookingService } from '../../core/api/booking.service';

describe('agruparHorarios', () => {
  it('agrupa días consecutivos con el mismo rango en una sola fila', () => {
    // diaSemana: 0=Lunes .. 6=Domingo (contrato de /public/config)
    const filas = agruparHorarios([
      { diaSemana: 0, horaInicio: '09:00', horaFin: '23:00' },
      { diaSemana: 1, horaInicio: '09:00', horaFin: '23:00' },
      { diaSemana: 2, horaInicio: '09:00', horaFin: '23:00' },
      { diaSemana: 5, horaInicio: '10:00', horaFin: '20:00' },
    ]);
    // Formato exacto de landing.ts:790-826: "a" entre nombres completos de día, "—" en el rango.
    expect(filas[0]).toEqual({ dias: 'Lunes a Miércoles', rango: '09:00 — 23:00', cerrado: false });
    expect(filas.some((f) => f.cerrado)).toBe(true);
  });

  it('marca cerrado el día sin horario', () => {
    const filas = agruparHorarios([{ diaSemana: 0, horaInicio: '09:00', horaFin: '23:00' }]);
    const cerrados = filas.filter((f) => f.cerrado);
    expect(cerrados.length).toBeGreaterThan(0);
    expect(cerrados[0].rango).toBe('Cerrado');
  });
});

describe('ClubStore', () => {
  it('estadoCarga termina en "error" cuando falla el fetch de /public/config', () => {
    const bookingDouble = { config: () => throwError(() => new Error('falló el fetch')) };
    TestBed.configureTestingModule({
      providers: [ClubStore, { provide: BookingService, useValue: bookingDouble }],
    });

    const store = TestBed.inject(ClubStore);
    store.cargar();

    expect(store.estadoCarga()).toBe('error');
    expect(store.config()).toBeNull();
  });
});
