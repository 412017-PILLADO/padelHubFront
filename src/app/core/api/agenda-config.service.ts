import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CanchaConfig } from './booking.service';

/** Un día del horario semanal. `diaSemana` 0=Lunes … 6=Domingo. Horas "HH:mm". */
export interface DiaConfig {
  diaSemana: number;
  open: boolean;
  from: string;
  to: string;
}

/** Un bloqueo (día/cancha sin atención). `fecha` es "YYYY-MM-DD". */
export interface BloqueoItem {
  id: number;
  fecha: string;
  canchaId: number | null;
  canchaNombre: string | null;
  motivo: string | null;
}

/** Datos de contacto/ubicación del complejo que ve el cliente en la reserva. */
export interface Contacto {
  direccion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  mapaUrl: string | null;
  instagram: string | null;
}

/** Config de agenda devuelta por `GET /api/v1/agenda/config`. */
export interface AgendaConfig {
  nombre: string;
  contacto: Contacto;
  pasoMinutos: number;
  duraciones: number[];
  duracionDefault: number;
  breakOn: boolean;
  breakFrom: string;
  breakTo: string;
  week: DiaConfig[];
  bloqueos: BloqueoItem[];
  canchas: CanchaConfig[];
}

/** Body de `PUT /api/v1/agenda/horarios`. */
export interface GuardarHorariosRequest {
  breakOn: boolean;
  breakFrom: string;
  breakTo: string;
  week: DiaConfig[];
}

/** Body de `PUT /api/v1/agenda/duraciones`. */
export interface GuardarDuracionesRequest {
  pasoMinutos: number;
  duraciones: number[];
  duracionDefault: number;
}

/** Body de `POST /api/v1/agenda/bloqueos`. */
export interface CrearBloqueoRequest {
  fecha: string;
  canchaId?: number | null;
  motivo?: string | null;
}

/** Body de `POST /api/v1/agenda/canchas`. `orden`/`complejoId` opcionales (se autocompletan). */
export interface CrearCanchaRequest {
  complejoId?: number | null;
  nombre: string;
  orden?: number | null;
  techada: boolean;
  tipoPared: string;
  precioHora?: number | null;
  color?: string | null;
}

/** Body de `PUT /api/v1/agenda/canchas/{id}`. `estado` = ACTIVO/INACTIVO. */
export interface ActualizarCanchaRequest {
  nombre: string;
  orden?: number | null;
  techada: boolean;
  tipoPared: string;
  precioHora?: number | null;
  color?: string | null;
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class AgendaConfigService {
  private readonly http = inject(HttpClient);

  /** Carga la config de agenda (horario, descanso, duraciones, bloqueos, contacto, canchas). */
  getConfig(): Observable<AgendaConfig> {
    return this.http.get<AgendaConfig>('/api/v1/agenda/config');
  }

  /** Reescribe el horario semanal + descanso. Devuelve la config actualizada. */
  putHorarios(body: GuardarHorariosRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/horarios', body);
  }

  /** Actualiza paso + duraciones permitidas + duración por defecto. */
  putDuraciones(body: GuardarDuracionesRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/duraciones', body);
  }

  /** Actualiza contacto/ubicación del complejo. Devuelve la config actualizada. */
  putContacto(body: Contacto): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/contacto', body);
  }

  /** Crea un bloqueo (día completo, o sólo una cancha si `canchaId`). */
  postBloqueo(body: CrearBloqueoRequest): Observable<BloqueoItem> {
    return this.http.post<BloqueoItem>('/api/v1/agenda/bloqueos', body);
  }

  /** Elimina un bloqueo por id. */
  deleteBloqueo(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/agenda/bloqueos/${id}`);
  }

  /** Crea una cancha. Devuelve la cancha creada. */
  postCancha(body: CrearCanchaRequest): Observable<CanchaConfig> {
    return this.http.post<CanchaConfig>('/api/v1/agenda/canchas', body);
  }

  /** Edita una cancha existente. Devuelve la cancha actualizada. */
  putCancha(id: number, body: ActualizarCanchaRequest): Observable<CanchaConfig> {
    return this.http.put<CanchaConfig>(`/api/v1/agenda/canchas/${id}`, body);
  }

  /** Baja (soft-delete) de una cancha por id. */
  deleteCancha(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/agenda/canchas/${id}`);
  }
}
