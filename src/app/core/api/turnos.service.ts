import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/** `estado`: 'CONFIRMADO' o 'PENDIENTE' (de seña; el endpoint incluye pendientes vigentes del día). */
export interface Turno {
  id: number;
  hora: string;
  fin: string;
  duracionMinutos: number;
  clienteNombre: string;
  clienteWhatsapp: string;
  canchaNombre: string;
  estado: 'CONFIRMADO' | 'PENDIENTE';
}

export interface TurnoCancelado {
  id: number;
  estado: string;
}

/** Una reserva pendiente de seña (cruza días: incluye `fecha`). `expiraEn` es ISO local. */
export interface Pendiente {
  id: number;
  fecha: string;
  hora: string;
  fin: string;
  clienteNombre: string;
  clienteWhatsapp: string;
  canchaNombre: string;
  duracionMinutos: number;
  expiraEn: string | null;
}

@Injectable({ providedIn: 'root' })
export class TurnosService {
  private readonly http = inject(HttpClient);

  /** Turnos del día para la fecha `YYYY-MM-DD` (CONFIRMADO + PENDIENTE de seña vigentes). */
  turnosDelDia(fecha: string): Observable<Turno[]> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<Turno[]>('/api/v1/turnos', { params });
  }

  /** Cancela un turno; libera su slot. */
  cancelar(id: number): Observable<TurnoCancelado> {
    return this.http.post<TurnoCancelado>(`/api/v1/turnos/${id}/cancelar`, {});
  }

  /** Reservas pendientes de validar la seña (todas las fechas, más urgentes primero). */
  pendientes(): Observable<Pendiente[]> {
    return this.http.get<Pendiente[]>('/api/v1/turnos/pendientes');
  }

  /** Valida la seña: confirma la reserva. */
  confirmarSena(id: number): Observable<TurnoCancelado> {
    return this.http.post<TurnoCancelado>(`/api/v1/turnos/${id}/confirmar-sena`, {});
  }

  /** Rechaza la seña: cancela la reserva y libera el slot. */
  rechazarSena(id: number): Observable<TurnoCancelado> {
    return this.http.post<TurnoCancelado>(`/api/v1/turnos/${id}/rechazar-sena`, {});
  }

  /** Disponibilidad autenticada para el form de reserva manual (el panel corre sin subdominio,
   *  así que no puede usar `/public/disponibilidad`: el tenant sale del JWT). */
  disponibilidad(fecha: string, duracion: number): Observable<SlotLibre[]> {
    const params = new HttpParams().set('fecha', fecha).set('duracion', duracion);
    return this.http.get<SlotLibre[]>('/api/v1/turnos/disponibilidad', { params });
  }

  /** Reserva manual del dueño: nace CONFIRMADA (sin seña ni límites anti-abuso). */
  crearManual(body: CrearReservaManual): Observable<ReservaManualCreada> {
    return this.http.post<ReservaManualCreada>('/api/v1/turnos', body);
  }

  /** Estado del pago de seña por reserva: APROBADO | APROBADO_TARDE | DEVUELTO | RECHAZADO | PENDIENTE. */
  getSenaPagoEstados(ids: number[]): Observable<Record<number, string>> {
    return this.http.get<Record<number, string>>('/api/v1/pagos/mp/reservas/estados', {
      params: { ids: ids.join(',') },
    });
  }

  /** Reembolsa el pago de la seña (no cancela la reserva). */
  devolverSena(reservaId: number): Observable<void> {
    return this.http.post<void>(`/api/v1/pagos/mp/reservas/${reservaId}/devolver`, {});
  }
}

/** Un slot de la grilla con sus canchas libres, como lo devuelve la disponibilidad del panel. */
export interface SlotLibre {
  hora: string;
  disponible: boolean;
  canchasLibres: { id: number; nombre: string }[];
}

export interface CrearReservaManual {
  /** null = "cualquiera disponible" (el back asigna la menos cargada). */
  canchaId: number | null;
  fecha: string;
  hora: string;
  duracion: number;
  clienteNombre: string;
  clienteWhatsapp: string | null;
}

export interface ReservaManualCreada {
  id: number;
  canchaId: number;
  canchaNombre: string;
  inicio: string;
  fin: string;
  duracionMinutos: number;
  estado: string;
}
