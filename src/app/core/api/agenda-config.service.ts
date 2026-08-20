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

/** Una reserva que quedó fuera del horario/bloqueo recién guardado (sigue vigente, no se cancela sola). */
export interface ReservaAfectada {
  id: number;
  fecha: string;
  hora: string;
  cancha: string;
  cliente: string;
}

/** Datos de contacto/ubicación del complejo que ve el cliente en la reserva. */
export interface Contacto {
  direccion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  mapaUrl: string | null;
  instagram: string | null;
}

/** Franja horaria general del complejo con precio especial (pisa el precio habitual de todas
 *  las canchas). Aplica todos los días. Un turno paga según su hora de inicio: `desde` incluida,
 *  `hasta` excluida; `hasta` "00:00" significa medianoche (24:00). */
export interface PrecioFranjaItem {
  id: number;
  desde: string;
  hasta: string;
  /** Negativo = descuento (-20 → paga 80%), positivo = recargo. */
  ajustePorcentaje: number;
}

/** Una franja tal como se manda en el body de `PUT /api/v1/agenda/precio-franjas` (sin id). */
export interface PrecioFranjaInput {
  desde: string;
  hasta: string;
  ajustePorcentaje: number;
}

/** Config de agenda devuelta por `GET /api/v1/agenda/config`. */
export interface AgendaConfig {
  /** Nombre del complejo. El back lo manda como `nombreComplejo`; el nombre de acá tiene que
   *  coincidir con el del JSON o el campo llega `undefined` sin que nada avise. */
  nombreComplejo: string;
  contacto: Contacto;
  pasoMinutos: number;
  duraciones: number[];
  duracionDefault: number;
  permitirOtrasDuraciones: boolean;
  precioModo: 'GENERAL' | 'POR_CANCHA';
  precioHoraGeneral: number | null;
  /** Franjas horarias con precio especial (pisan el precio general/por cancha en ese rango). */
  precioFranjas: PrecioFranjaItem[];
  requiereSena: boolean;
  senaMonto: number | null;
  senaAlias: string | null;
  /** Texto libre del dueño (cancelación/devolución); null/vacío = sin política cargada. */
  politicaCancelacion: string | null;
  autoasignacion: boolean;
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
  permitirOtrasDuraciones: boolean;
}

/** Body de `PUT /api/v1/agenda/precios`. `precioHoraGeneral` requerido si modo GENERAL. */
export interface GuardarPreciosRequest {
  precioModo: 'GENERAL' | 'POR_CANCHA';
  precioHoraGeneral: number | null;
}

/** Body de `PUT /api/v1/agenda/precio-franjas`. Replace-all: la lista completa pisa las franjas
 *  existentes; lista vacía borra todas. 400 con `{error}` si hay solapes o valores inválidos. */
export interface GuardarPrecioFranjasRequest {
  franjas: PrecioFranjaInput[];
}

/** Body de `PUT /api/v1/agenda/sena`. `senaMonto` (>0) y `senaAlias` requeridos si `requiereSena`. */
export interface GuardarSenaRequest {
  requiereSena: boolean;
  senaMonto: number | null;
  senaAlias: string | null;
}

/** Body de `PUT /api/v1/agenda/autoasignacion`. */
export interface GuardarAutoasignacionRequest {
  autoasignacion: boolean;
}

/** Body de `POST /api/v1/agenda/bloqueos`. */
export interface CrearBloqueoRequest {
  fecha: string;
  canchaId?: number | null;
  motivo?: string | null;
}

/** Respuesta de `PUT /api/v1/agenda/horarios`: la config actualizada + reservas que quedaron fuera del nuevo horario. */
export interface GuardarHorariosResponse extends AgendaConfig {
  reservasAfectadas: ReservaAfectada[];
}

/** Respuesta de `POST /api/v1/agenda/bloqueos`: el bloqueo creado + reservas que quedaron dentro de ese bloqueo. */
export interface CrearBloqueoResponse extends BloqueoItem {
  reservasAfectadas: ReservaAfectada[];
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

/** Marca del tenant: color primario/secundario (hex), plantilla de landing, fuente y URL del logo. */
export interface Marca {
  colorPrimario: string;
  colorSecundario: string | null;
  /** Plantilla de landing: 'A' (poster), 'B' (hero centrado), 'C' (compacta tipo app). */
  plantilla: string;
  fuente: string | null;
  logoUrl: string | null;
}

/** Body de `PUT /api/v1/agenda/marca`. `colorSecundario`/`plantilla`/`fuente` opcionales. */
export interface GuardarMarcaRequest {
  colorPrimario: string;
  colorSecundario?: string | null;
  plantilla?: string | null;
  fuente?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AgendaConfigService {
  private readonly http = inject(HttpClient);

  /** Estado actual de la marca (color/fuente/logo) para el panel. */
  getMarca(): Observable<Marca> {
    return this.http.get<Marca>('/api/v1/agenda/marca');
  }

  /** Actualiza el color primario (y fuente) del tenant. */
  putMarca(body: GuardarMarcaRequest): Observable<Marca> {
    return this.http.put<Marca>('/api/v1/agenda/marca', body);
  }

  /** Sube el logo del club (multipart). Devuelve la marca con el logoUrl ya servible. */
  uploadLogo(file: File): Observable<Marca> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<Marca>('/api/v1/agenda/marca/logo', fd);
  }

  /** Quita el logo del club (vuelve a mostrarse solo el nombre). */
  deleteLogo(): Observable<Marca> {
    return this.http.delete<Marca>('/api/v1/agenda/marca/logo');
  }

  /** Carga la config de agenda (horario, descanso, duraciones, bloqueos, contacto, canchas). */
  getConfig(): Observable<AgendaConfig> {
    return this.http.get<AgendaConfig>('/api/v1/agenda/config');
  }

  /** Reescribe el horario semanal + descanso. Devuelve la config actualizada + reservas afectadas. */
  putHorarios(body: GuardarHorariosRequest): Observable<GuardarHorariosResponse> {
    return this.http.put<GuardarHorariosResponse>('/api/v1/agenda/horarios', body);
  }

  /** Actualiza paso + duraciones permitidas + turno principal + si permite otras duraciones. */
  putDuraciones(body: GuardarDuracionesRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/duraciones', body);
  }

  /** Actualiza el modo de precio (general/por cancha) + el precio general. */
  putPrecios(body: GuardarPreciosRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/precios', body);
  }

  /** Reescribe las franjas horarias con precio especial (replace-all). Devuelve la config actualizada. */
  putPrecioFranjas(body: GuardarPrecioFranjasRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/precio-franjas', body);
  }

  /** Activa/desactiva el módulo de señas + el monto. */
  putSena(body: GuardarSenaRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/sena', body);
  }

  /** Actualiza la política de cancelación/devolución (texto libre; vacío la borra). */
  putPoliticaCancelacion(texto: string | null): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/politica-cancelacion', { texto });
  }

  /** Activa/desactiva la autoasignación de canchas (oculta el paso de elegir cancha). */
  putAutoasignacion(body: GuardarAutoasignacionRequest): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/autoasignacion', body);
  }

  /** Actualiza contacto/ubicación del complejo. Devuelve la config actualizada. */
  putContacto(body: Contacto): Observable<AgendaConfig> {
    return this.http.put<AgendaConfig>('/api/v1/agenda/contacto', body);
  }

  /** Crea un bloqueo (día completo, o sólo una cancha si `canchaId`). Incluye reservas afectadas. */
  postBloqueo(body: CrearBloqueoRequest): Observable<CrearBloqueoResponse> {
    return this.http.post<CrearBloqueoResponse>('/api/v1/agenda/bloqueos', body);
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
