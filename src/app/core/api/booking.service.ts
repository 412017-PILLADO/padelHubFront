import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';

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
  /** Texto libre de política de cancelación/devolución; null/vacío = el club no cargó una (sin link en la landing). */
  politicaCancelacion: string | null;
  /** Franjas horarias con precio especial (pisan el precio general/por cancha en ese rango, todos los días). */
  precioFranjas: PrecioFranjaPublic[];
  canchas: CanchaConfig[];
  horarios: { diaSemana: number; horaInicio: string; horaFin: string }[];
}

/** Config del tenant resuelta en el server y transferida al cliente en el HTML (ver `config()`). */
const CONFIG_KEY = makeStateKey<PublicConfig>('public-config');

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(TransferState);
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Config pública del club. La ruta '' se renderiza por request (`RenderMode.Server`), así que el
   * server ya la resuelve: la dejamos en el `TransferState` para que el cliente la reciba **dentro
   * del HTML** y la devuelva de forma SÍNCRONA en el primer render.
   *
   * Sin esto el componente vuelve a nacer en el browser con `config = null` → la landing cae a la
   * plantilla por defecto (C) hasta que termina un segundo fetch, y el club ve el layout cambiar
   * solo (medido: ~600ms de plantilla equivocada). Además ahorra ese request duplicado.
   *
   * La clave se consume una sola vez (`remove`): un refetch posterior en la misma sesión (ej. tras
   * un cambio de config) tiene que ir al back de verdad.
   */
  config(): Observable<PublicConfig> {
    const transferida = this.state.get(CONFIG_KEY, null);
    if (transferida) {
      this.state.remove(CONFIG_KEY);
      return of(transferida);
    }
    const req$ = this.http.get<PublicConfig>('/public/config');
    return isPlatformServer(this.platformId)
      ? req$.pipe(tap((cfg) => this.state.set(CONFIG_KEY, cfg)))
      : req$;
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

  /** Alta pública de arrepentimiento (Res. 424/2020). Devuelve el código de revocación. */
  crearArrepentimiento(body: {
    nombre: string; whatsapp: string; detalle?: string; reservaFecha?: string; empresa: string;
  }): Observable<{ codigo: string }> {
    return this.http.post<{ codigo: string }>('/public/arrepentimiento', body);
  }
}
