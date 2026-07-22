import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { currentTenantSlug } from './tenant';

/**
 * Para las llamadas al back (`/public/**` y `/api/**`):
 *  - antepone `environment.apiBase` (en dev `http://localhost:8090`, en prod la URL del backend),
 *    así el front (otro origen) le pega al back;
 *  - adjunta `X-Tenant: <slug>` para que el back resuelva el tenant por subdominio.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const isPlatform = req.url.startsWith('/platform');
  const isBackend = req.url.startsWith('/public') || req.url.startsWith('/api/') || isPlatform;
  if (!isBackend) return next(req);

  const url = environment.apiBase ? environment.apiBase + req.url : req.url;
  // Plataforma (super-admin) no es tenant-scoped → no mandamos X-Tenant.
  if (isPlatform) return next(req.clone({ url }));
  return next(req.clone({ url, setHeaders: { 'X-Tenant': currentTenantSlug() } }));
};
