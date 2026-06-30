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

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly isDev = isDevMode();

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
