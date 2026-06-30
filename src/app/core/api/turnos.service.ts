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
}
