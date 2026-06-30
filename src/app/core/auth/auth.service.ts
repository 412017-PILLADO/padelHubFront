import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const TOKEN_KEY = 'padel_jwt';

interface LoginResponse {
  token: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Copia reactiva del JWT guardado (null = deslogueado). */
  private readonly _token = signal<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  );

  /** Si hay token (signal, para guards/templates). */
  readonly isAuthenticated = computed(() => this._token() !== null);

  /** JWT actual, o null si está deslogueado. */
  token(): string | null {
    return this._token();
  }

  login(email: string, password: string): Observable<void> {
    return this.http
      .post<LoginResponse>('/api/v1/auth/login', { email, password })
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
