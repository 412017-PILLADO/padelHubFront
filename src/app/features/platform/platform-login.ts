import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { PlatformAuthService } from '../../core/platform/platform-auth.service';

/** Login oculto del super-admin de plataforma (ruta /plataforma, no linkeada). */
@Component({
  selector: 'app-platform-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="shell">
      <section class="card">
        <div class="eyebrow">Plataforma · modo desarrollador</div>
        <h1 class="title">Acceso super-admin</h1>
        <form (ngSubmit)="submit()">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" autocomplete="username" placeholder="admin@padelhub.com"
              [ngModel]="email()" (ngModelChange)="email.set($event)" />
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input type="password" name="password" autocomplete="current-password" placeholder="••••••••"
              [ngModel]="password()" (ngModelChange)="password.set($event)" />
          </label>
          @if (error(); as e) { <p class="err">{{ e }}</p> }
          <button type="submit" [disabled]="loading() || !email().trim() || !password()">
            {{ loading() ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>
      </section>
    </div>
  `,
  styles: [`
    .shell { min-height: 100dvh; display: grid; place-items: center; background: var(--paper); padding: 24px; }
    .card { width: 100%; max-width: 380px; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--r-lg); padding: 32px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .eyebrow { font: 600 12px var(--mono); letter-spacing: 1px; text-transform: uppercase; color: var(--court); }
    .title { font-family: var(--display); font-size: 1.5rem; margin: 6px 0 22px; color: var(--ink); }
    .field { display: block; margin-bottom: 16px; }
    .field span { display: block; font-weight: 600; font-size: .85rem; margin-bottom: 6px; color: var(--ink-dim); }
    .field input { width: 100%; padding: 11px 13px; border: 1px solid var(--line-strong); border-radius: var(--r);
      background: var(--paper); font-size: 1rem; color: var(--ink); }
    .field input:focus { border-color: var(--court); }
    .err { color: var(--clay); font-size: .85rem; margin: -4px 0 14px; }
    button { width: 100%; padding: 12px; border: none; border-radius: var(--r); background: var(--court);
      color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer; }
    button:disabled { background: var(--line-strong); color: var(--ink-faint); cursor: not-allowed; }
  `],
})
export class PlatformLoginComponent {
  private readonly auth = inject(PlatformAuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/plataforma/tenants']);
    }
  }

  submit(): void {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/plataforma/tenants']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 401 ? 'Credenciales inválidas' : 'No pudimos iniciar sesión. Probá de nuevo.');
      },
    });
  }
}
