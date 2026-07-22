import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Fila del listado de clubes en el panel de plataforma. */
export interface TenantResumen {
  id: number;
  slug: string;
  name: string;
  status: string;
  colorPrimario: string | null;
  colorSecundario: string | null;
  logoUrl: string | null;
  /** Plantilla de landing: 'A' (poster), 'B' (hero centrado), 'C' (compacta tipo app). */
  plantilla: string;
}

/** Body de alta de un club (POST /platform/tenants). */
export interface CrearTenantRequest {
  slug: string;
  name: string;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  plantilla?: string;
  ownerEmail: string;
  ownerPassword: string;
  direccion?: string | null;
  whatsapp?: string | null;
  hosts?: string[];
}

export interface CrearTenantResponse {
  tenantId: number;
  slug: string;
  complejoId: number;
}

/** Body de edición (PUT /platform/tenants/{id}). Todo opcional. */
export interface EditarTenantRequest {
  name?: string | null;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  plantilla?: string | null;
  status?: string | null;
}

/** API de gestión de tenants para el super-admin (todas bajo /platform, con Bearer de plataforma). */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);

  list(): Observable<TenantResumen[]> {
    return this.http.get<TenantResumen[]>('/platform/tenants');
  }

  crear(body: CrearTenantRequest): Observable<CrearTenantResponse> {
    return this.http.post<CrearTenantResponse>('/platform/tenants', body);
  }

  editar(id: number, body: EditarTenantRequest): Observable<TenantResumen> {
    return this.http.put<TenantResumen>(`/platform/tenants/${id}`, body);
  }

  activar(id: number): Observable<TenantResumen> {
    return this.http.post<TenantResumen>(`/platform/tenants/${id}/activar`, {});
  }

  desactivar(id: number): Observable<TenantResumen> {
    return this.http.post<TenantResumen>(`/platform/tenants/${id}/desactivar`, {});
  }

  /** Baja definitiva del club (borra todos sus datos). Irreversible. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`/platform/tenants/${id}`);
  }

  /** Resetea la contraseña del owner del club (mín. 8 caracteres). No se puede volver a ver luego. */
  resetOwnerPassword(id: number, password: string): Observable<void> {
    return this.http.put<void>(`/platform/tenants/${id}/owner-password`, { password });
  }
}
