import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { UnsavedChangesService } from '../unsaved-changes.service';

interface MeResponse {
  email: string;
  tenantId: number;
  tenantName: string;
  rol: string;
}

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.scss',
})
export class AdminNavComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly branding = inject(BrandingService);
  private readonly unsaved = inject(UnsavedChangesService);

  /** Nombre del tenant logueado (del JWT, vía /me). Fallback hasta que cargue. */
  readonly tenantName = toSignal(
    this.http.get<MeResponse>('/api/v1/auth/me').pipe(
      map((r) => r.tenantName),
      catchError(() => of('Tu club'))
    ),
    { initialValue: 'Tu club' }
  );

  /** Logo del club (marca del tenant) para mostrar en la nav en vez del ícono genérico. */
  readonly logoSrc = this.branding.logoSrc;

  constructor() {
    // La nav está en panel y config → cargar acá la marca cubre todo el área autenticada.
    this.branding.loadAdmin();
  }

  /** Si hay cambios sin guardar (hoy sólo en Agenda), confirma antes de dejar navegar/salir. */
  private confirmLeaveIfDirty(): boolean {
    if (!this.unsaved.dirty()) return true;
    return confirm('Tenés cambios sin guardar, ¿salir igual?');
  }

  /** Handler de los links internos: si hay cambios sin guardar, pide confirmación antes de navegar. */
  guardNav(event: Event): void {
    if (!this.confirmLeaveIfDirty()) {
      event.preventDefault();
    }
  }

  logout(): void {
    if (!this.confirmLeaveIfDirty()) return;
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
