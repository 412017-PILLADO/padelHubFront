import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Turno {
  id: number;
  hora: string;
  fin: string;
  duracionMinutos: number;
  clienteNombre: string;
  clienteWhatsapp: string;
  canchaNombre: string;
  estado: string;
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

  /** Turnos del día (CONFIRMADO) para la fecha `YYYY-MM-DD`. */
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
}
