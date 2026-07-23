import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { PlatformAuthService } from './platform-auth.service';

/**
 * Adjunta el Bearer del super-admin a las llamadas de plataforma (`/platform/**`), salvo el login.
 * Ante un 401 limpia la sesión y vuelve al login oculto. Corre antes del tenantInterceptor (mientras
 * la URL todavía es relativa) y no adjunta `X-Tenant` (plataforma no es tenant-scoped).
 */
export const platformInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(PlatformAuthService);
  const router = inject(Router);

  const isPlatform = req.url.startsWith('/platform/');
  const isLogin = req.url.startsWith('/platform/auth/login');
  const token = auth.token();

  let authReq = req;
  if (isPlatform && !isLogin && token) {
    authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isPlatform && !isLogin) {
        auth.logout();
        router.navigate(['/plataforma']);
      }
      return throwError(() => err);
    })
  );
};
