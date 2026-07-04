import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Bloquea las rutas del panel cuando no hay JWT; redirige al login. */
export const authGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthService);
  const router = inject(Router);

  // En el server no hay `localStorage`: no se puede saber si hay sesión. Dejamos pasar y el guard
  // vuelve a evaluarse en el browser (donde está el token). Evita redirigir a login al recargar.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/admin/login']);
};
