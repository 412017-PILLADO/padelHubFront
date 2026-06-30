import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';

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

  /** Nombre del tenant logueado (del JWT, vía /me). Fallback hasta que cargue. */
  readonly tenantName = toSignal(
    this.http.get<MeResponse>('/api/v1/auth/me').pipe(
      map((r) => r.tenantName),
      catchError(() => of('Tu club'))
    ),
    { initialValue: 'Tu club' }
  );

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
