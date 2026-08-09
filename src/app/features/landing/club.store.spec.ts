import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { agruparHorarios, ClubStore } from './club.store';
import { BookingService, PublicConfig } from '../../core/api/booking.service';

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

/** Config pública mínima y válida para los tests de `cargar()`. */
function fakeConfig(overrides: Partial<PublicConfig> = {}): PublicConfig {
  return {
    tenant: {
      nombre: 'Club Test',
      colorPrimario: '#112233',
      colorSecundario: null,
      fuente: 'Inter',
      logoUrl: null,
      mostrarPrecios: true,
      requiereTelefono: true,
      plantilla: 'A',
    },
    complejo: {
      id: 1,
      nombre: 'Padel Rio',
      direccion: 'Calle Falsa 123',
      telefono: null,
      whatsapp: null,
      mapaUrl: null,
      instagram: null,
    },
    pasoMinutos: 30,
    duracionesPermitidas: [60, 90, 120],
    duracionDefault: 90,
    permitirOtrasDuraciones: true,
    requiereSena: false,
    senaMonto: null,
    senaAlias: null,
    autoasignacion: false,
    pagoOnline: false,
    politicaCancelacion: null,
    precioFranjas: [],
    canchas: [],
    horarios: [],
    ...overrides,
  };
}

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

  it('cargar(): camino feliz — estadoCarga termina en "ok", config queda seteada y se aplican branding + SEO', () => {
    const cfg = fakeConfig();
    const bookingDouble = { config: () => of(cfg) };
    TestBed.configureTestingModule({
      providers: [ClubStore, { provide: BookingService, useValue: bookingDouble }],
    });

    const store = TestBed.inject(ClubStore);
    store.cargar();

    expect(store.estadoCarga()).toBe('ok');
    expect(store.config()).toEqual(cfg);
    // applySeo(): title + meta description por club (ver club.store.ts).
    expect(TestBed.inject(Title).getTitle()).toBe('Padel Rio — Reservá tu cancha');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toContain('Padel Rio');
    // applyBranding(): el color del tenant queda escrito en el :root (ver applyTenantColors).
    expect(document.documentElement.style.getPropertyValue('--court')).toBe('#112233');
  });

  it('cargar() es idempotente: llamarlo dos veces no vuelve a pedir la config', () => {
    const cfg = fakeConfig();
    const configSpy = vi.fn(() => of(cfg));
    const bookingDouble = { config: configSpy };
    TestBed.configureTestingModule({
      providers: [ClubStore, { provide: BookingService, useValue: bookingDouble }],
    });

    const store = TestBed.inject(ClubStore);
    store.cargar();
    store.cargar();

    expect(configSpy).toHaveBeenCalledTimes(1);
  });
});
