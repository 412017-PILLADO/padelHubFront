import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** JWT del super-admin, aparte del token del owner (`padel_jwt`) para no pisarse. */
const TOKEN_KEY = 'padel_platform_jwt';

interface LoginResponse {
  token: string;
  expiresIn: number;
}

/** Sesión del super-admin de plataforma (login propio, sin tenant). Espeja AuthService del owner. */
@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  );

  readonly isAuthenticated = computed(() => this._token() !== null);

  token(): string | null {
    return this._token();
  }

  login(email: string, password: string): Observable<void> {
    return this.http
      .post<LoginResponse>('/platform/auth/login', { email, password })
      .pipe(map((res) => this.setToken(res.token)));
  }

  logout(): void {
    this._token.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private setToken(token: string): void {
    this._token.set(token);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
}
