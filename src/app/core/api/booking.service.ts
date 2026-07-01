import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Una cancha tal como llega en un slot de disponibilidad. */
export interface CanchaLibre {
  id: number;
  nombre: string;
  color: string | null;
  techada: boolean;
  tipoPared: string | null;
  precioHora: number | null;
}

/** Cancha en la config pública (incluye orden/estado). */
export interface CanchaConfig extends CanchaLibre {
  orden: number;
  estado: string;
}

export interface Slot {
  hora: string;
  disponible: boolean;
  canchasLibres: CanchaLibre[];
}

export interface ReservaCreada {
  id: number;
  canchaId: number;
  canchaNombre: string;
  inicio: string;
  fin: string;
  duracionMinutos: number;
  estado: string;
}

export interface CrearReservaBody {
  complejoId?: number;
  /** null = "cualquiera disponible". */
  canchaId?: number | null;
  fecha: string;
  hora: string;
  duracion: number;
  clienteNombre: string;
  clienteWhatsapp?: string;
  empresa?: string;
}

export interface PublicConfig {
  tenant: {
    nombre: string;
    colorPrimario: string;
    fuente: string;
    mostrarPrecios: boolean;
    requiereTelefono: boolean;
  };
  complejo: {
    id: number;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    whatsapp: string | null;
    mapaUrl: string | null;
    instagram: string | null;
  };
  pasoMinutos: number;
  duracionesPermitidas: number[];
  duracionDefault: number;
  permitirOtrasDuraciones: boolean;
  canchas: CanchaConfig[];
  horarios: { diaSemana: number; horaInicio: string; horaFin: string }[];
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);

  config(): Observable<PublicConfig> {
    return this.http.get<PublicConfig>('/public/config');
  }

  disponibilidad(fecha: string, duracion: number): Observable<Slot[]> {
    const params = new HttpParams()
      .set('fecha', fecha)
      .set('duracion', duracion);
    return this.http.get<Slot[]>('/public/disponibilidad', { params });
  }

  crearReserva(body: CrearReservaBody): Observable<ReservaCreada> {
    return this.http.post<ReservaCreada>('/public/reservas', body);
  }
}
