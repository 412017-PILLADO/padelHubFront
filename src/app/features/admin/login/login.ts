import {
  ChangeDetectionStrategy,
  Component,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { BookingService } from '../../../core/api/booking.service';
import { BrandingService } from '../../../core/branding/branding.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, InputTextModule, PasswordModule, ToastModule],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly booking = inject(BookingService);
  private readonly branding = inject(BrandingService);

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly isDev = isDevMode();

  /** Logo del club (marca del tenant) para el panel de marca del login. */
  readonly logoSrc = this.branding.logoSrc;

  constructor() {
    // Pre-login no hay JWT → tomamos la marca de la config pública (resuelta por subdominio).
    this.booking.config().subscribe({
      next: (cfg) =>
        this.branding.apply(cfg.tenant.colorPrimario, cfg.tenant.colorSecundario, cfg.tenant.logoUrl),
      error: () => {
        /* Sin marca del tenant el login sigue con el color base. */
      },
    });
  }

  submit(): void {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password || this.loading()) return;

    this.loading.set(true);
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const detail =
          err.status === 401
            ? 'Email o contraseña inválidos'
            : 'No pudimos iniciar sesión. Probá de nuevo.';
        this.messages.add({ severity: 'error', summary: 'Error', detail });
      },
    });
  }
}
