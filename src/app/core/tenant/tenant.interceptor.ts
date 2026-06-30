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
  const isBackend = req.url.startsWith('/public') || req.url.startsWith('/api/');
  if (!isBackend) return next(req);

  const url = environment.apiBase ? environment.apiBase + req.url : req.url;
  return next(req.clone({ url, setHeaders: { 'X-Tenant': currentTenantSlug() } }));
};
