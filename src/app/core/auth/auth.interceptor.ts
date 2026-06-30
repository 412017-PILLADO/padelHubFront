import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Adjunta el Bearer a las llamadas autenticadas (`/api/v1/**`), salvo el login abierto.
 * Ante un 401 limpia la sesión y vuelve al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApi = req.url.startsWith('/api/v1/');
  const isLogin = req.url.startsWith('/api/v1/auth/login');
  const token = auth.token();

  let authReq = req;
  if (isApi && !isLogin && token) {
    authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isApi && !isLogin) {
        auth.logout();
        router.navigate(['/admin/login']);
      }
      return throwError(() => err);
    })
  );
};
