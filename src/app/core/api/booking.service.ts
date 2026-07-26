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

/** Franja horaria con ajuste porcentual en la config pública (sin id: solo lo que necesita la
 *  landing). Negativo = descuento (-20 → paga 80%), positivo = recargo. */
export interface PrecioFranjaPublic {
  desde: string;
  hasta: string;
  ajustePorcentaje: number;
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
    /** Color secundario del tenant (acento); null → se usa el primario. */
    colorSecundario: string | null;
    fuente: string;
    /** URL del logo del club (relativa al backend o absoluta); null → mostrar solo el nombre. */
    logoUrl: string | null;
    mostrarPrecios: boolean;
    requiereTelefono: boolean;
    /** Plantilla de landing: 'A' (poster), 'B' (hero centrado), 'C' (compacta tipo app). */
    plantilla: string;
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
  /** Si el complejo pide seña, la reserva queda pendiente hasta que el dueño la valide. */
  requiereSena: boolean;
  /** Monto de la seña a mostrarle al cliente (null si no se pide seña). */
  senaMonto: number | null;
  /** Alias/CBU al que el cliente transfiere la seña (null si no se pide seña). */
  senaAlias: string | null;
  /** Si es true, el sistema asigna la cancha automáticamente y la landing oculta el paso de elegir. */
  autoasignacion: boolean;
  /** true si el club tiene Mercado Pago conectado (la seña se puede pagar online). */
  pagoOnline: boolean;
  /** Franjas horarias con precio especial (pisan el precio general/por cancha en ese rango, todos los días). */
  precioFranjas: PrecioFranjaPublic[];
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

  /** Pide el link de Checkout Pro para pagar la seña de una reserva PENDIENTE (idempotente). */
  crearLinkSena(reservaId: number, backUrl: string): Observable<{ initPoint: string }> {
    return this.http.post<{ initPoint: string }>('/public/pagos/mp/preferencia', {
      reservaId,
      backUrl,
    });
  }
}
