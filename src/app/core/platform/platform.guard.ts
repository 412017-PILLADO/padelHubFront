import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

import { PlatformAuthService } from './platform-auth.service';

/** Bloquea el panel de plataforma sin sesión de super-admin; redirige al login oculto. SSR-safe. */
export const platformGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(PlatformAuthService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/plataforma']);
};
