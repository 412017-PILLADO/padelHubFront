import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Estado de la conexión de Mercado Pago del club (GET /api/v1/pagos/mp/estado). */
export interface MpEstado {
  conectado: boolean;
  mpUserId: string | null;
  expiraEn: string | null;
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly http = inject(HttpClient);

  getMpEstado(): Observable<MpEstado> {
    return this.http.get<MpEstado>('/api/v1/pagos/mp/estado');
  }

  /** Devuelve la URL de autorización de MP a la que hay que redirigir al dueño. */
  conectarMp(returnTo: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/v1/pagos/mp/conectar', { returnTo });
  }

  desconectarMp(): Observable<void> {
    return this.http.post<void>('/api/v1/pagos/mp/desconectar', {});
  }
}
