import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AgendaConfig } from '../../../core/api/agenda-config.service';
import { Turno } from '../../../core/api/turnos.service';
import { PanelComponent } from './panel';

/**
 * La grilla del panel (canchas × franjas) es la vista con la que el dueño se para en el mostrador.
 * Su modo de falla peligroso no es romperse: es **descartar** un turno en silencio y quedar prolija.
 * Pasó de verdad — la grilla armaba sus columnas con las canchas ACTIVO de la config y ubicaba cada
 * turno buscando su columna por NOMBRE, así que un turno sobre una cancha desactivada (la baja
 * conserva las reservas a propósito) no encontraba columna y desaparecía, mientras el contador del
 * costado seguía diciendo "2 turnos".
 *
 * Estos tests miran el `grid()` derivado en vez del DOM: lo que se está fijando es la regla —todo
 * turno del día se dibuja— y no cómo se ve.
 */

const CANCHA_BASE = {
  orden: 1,
  techada: false,
  tipoPared: 'CRISTAL',
  precioHora: null,
  color: '#111111',
  estado: 'ACTIVO',
};

function config(over: Partial<AgendaConfig> = {}): AgendaConfig {
  return {
    nombreComplejo: 'Club',
    pasoMinutos: 30,
    duraciones: [60, 90],
    duracionDefault: 90,
    permitirOtrasDuraciones: true,
    precioModo: 'POR_CANCHA',
    precioHoraGeneral: null,
    requiereSena: false,
    senaMonto: null,
    senaAlias: null,
    politicaCancelacion: null,
    autoasignacion: false,
    breakOn: false,
    breakFrom: '13:00',
    breakTo: '14:00',
    week: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
      diaSemana,
      open: true,
      from: '08:00',
      to: '23:00',
    })),
    bloqueos: [],
    canchas: [
      { ...CANCHA_BASE, id: 1, nombre: 'Cancha 1', orden: 1 },
      { ...CANCHA_BASE, id: 2, nombre: 'Cancha 2', orden: 2 },
    ],
    precioFranjas: [],
    contacto: { direccion: null, telefono: null, whatsapp: null, mapaUrl: null, instagram: null },
    ...over,
  } as AgendaConfig;
}

function turno(over: Partial<Turno> = {}): Turno {
  return {
    id: 1,
    hora: '10:00',
    fin: '11:30',
    duracionMinutos: 90,
    clienteNombre: 'Cliente',
    clienteWhatsapp: '3511234567',
    canchaId: 1,
    canchaNombre: 'Cancha 1',
    estado: 'CONFIRMADO',
    ...over,
  };
}

/** Monta el panel sin dejarlo pegarle al back: se le inyectan la config y los turnos a mano. */
function panelCon(cfg: AgendaConfig, turnos: Turno[]): PanelComponent {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      // El constructor del panel dispara sus cargas: acá quedan atrapadas y sin resolver, así que
      // el estado que ven los tests es sólo el que se le inyecta a mano.
      provideHttpClientTesting(),
      provideRouter([]),
      MessageService,
      ConfirmationService,
    ],
  });
  const panel = TestBed.runInInjectionContext(() => new PanelComponent());
  // `agenda` es privado a propósito (lo llena `loadAgenda`); el test lo escribe directo para no
  // tener que simular la red entera sólo para mirar una derivación.
  (panel as unknown as { agenda: { set(v: AgendaConfig): void } }).agenda.set(cfg);
  panel.list.set(turnos);
  return panel;
}

describe('la grilla del panel', () => {
  it('dibuja el turno de una cancha desactivada, en su propia columna marcada', () => {
    const cfg = config({
      canchas: [
        { ...CANCHA_BASE, id: 1, nombre: 'Cancha 1', orden: 1 },
        { ...CANCHA_BASE, id: 3, nombre: 'Cancha 3', orden: 3, estado: 'INACTIVO' },
      ],
    });
    const panel = panelCon(cfg, [
      turno({ id: 10, canchaId: 1, canchaNombre: 'Cancha 1' }),
      turno({ id: 11, canchaId: 3, canchaNombre: 'Cancha 3', hora: '12:00', fin: '13:30' }),
    ]);

    const grid = panel.grid()!;
    expect(grid.blocks.map((b) => b.turno.id).sort()).toEqual([10, 11]);
    const col3 = grid.cols.find((c) => c.id === 3)!;
    expect(col3, 'la cancha desactivada tiene que tener columna').toBeDefined();
    expect(col3.activa, 'y tiene que salir marcada como fuera de servicio').toBe(false);
  });

  it('no confunde dos canchas que se llaman igual', () => {
    const cfg = config({
      canchas: [
        { ...CANCHA_BASE, id: 1, nombre: 'Cancha 1', orden: 1 },
        { ...CANCHA_BASE, id: 2, nombre: 'Cancha 1', orden: 2 },
      ],
    });
    const panel = panelCon(cfg, [
      turno({ id: 10, canchaId: 1, canchaNombre: 'Cancha 1' }),
      turno({ id: 11, canchaId: 2, canchaNombre: 'Cancha 1' }),
    ]);

    const grid = panel.grid()!;
    expect(grid.blocks.map((b) => b.col).sort()).toEqual([0, 1]);
  });

  it('el filtro por cancha también filtra la grilla, no sólo la lista', () => {
    const panel = panelCon(config(), [
      turno({ id: 10, canchaId: 1, canchaNombre: 'Cancha 1' }),
      turno({ id: 11, canchaId: 2, canchaNombre: 'Cancha 2' }),
    ]);

    panel.setCanchaFilter(2);

    const grid = panel.grid()!;
    expect(grid.cols.map((c) => c.id)).toEqual([2]);
    expect(grid.blocks.map((b) => b.turno.id)).toEqual([11]);
    // El contador del costado cuenta lo mismo que se dibuja.
    expect(panel.count()).toBe(1);
  });

  it('con el club cerrando a medianoche la grilla tiene filas', () => {
    // "00:00" es el cierre de medianoche que ofrece la pantalla de config. Leído como 0 minutos, el
    // rango 08:00→00:00 quedaba vacío y la grilla salía sin una sola franja.
    const cfg = config({
      week: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        diaSemana,
        open: true,
        from: '08:00',
        to: '00:00',
      })),
    });
    const panel = panelCon(cfg, [turno({ id: 10 })]);

    const grid = panel.grid()!;
    expect(grid.rows.length).toBe((24 * 60 - 8 * 60) / 30);
    expect(grid.rows[0].label).toBe('08:00');
    expect(grid.blocks).toHaveLength(1);
  });

  it('estira las filas para cubrir un turno que quedó fuera del horario del club', () => {
    // El club recorta su horario después de tomada la reserva: el turno sigue existiendo y hay que
    // jugarlo, así que la grilla se estira en vez de tragárselo.
    const cfg = config({
      week: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        diaSemana,
        open: true,
        from: '18:00',
        to: '23:00',
      })),
    });
    const panel = panelCon(cfg, [turno({ id: 10, hora: '09:00', fin: '10:30' })]);

    const grid = panel.grid()!;
    expect(grid.blocks).toHaveLength(1);
    expect(grid.rows[grid.blocks[0].rowStart].label).toBe('09:00');
  });

  it('el día cerrado sigue siendo día cerrado', () => {
    const cfg = config({
      week: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        diaSemana,
        open: false,
        from: '08:00',
        to: '23:00',
      })),
    });
    const panel = panelCon(cfg, []);

    expect(panel.grid()!.open).toBe(false);
  });
});
