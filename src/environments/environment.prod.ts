// Prod: front y back se sirven desde el MISMO origen, detrás de Caddy.
//
// `apiBase` VACÍO a propósito: el tenantInterceptor antepone apiBase sólo si tiene valor
// (`environment.apiBase ? apiBase + req.url : req.url`), así que vacío deja las URLs relativas
// —`/public/config`, `/api/v1/turnos`— y el navegador las manda al mismo host que sirvió la página.
// Caddy las reconoce por el prefijo y las deriva al backend; todo lo demás va al SSR.
//
// La consecuencia importante: al no haber dos orígenes, NO hay CORS. Antes esto apuntaba a
// `https://api.padel-hub.com.ar`, un subdominio aparte que obligaba a abrir CORS en el back y que
// además nunca tuvo un backend atrás.
export const environment = {
  production: true,
  apiBase: '',
  baseDomain: 'padel-hub.com.ar',
  // URL pública de un club a partir de su slug (reemplazar "{slug}").
  tenantBaseUrl: 'https://{slug}.padel-hub.com.ar/',
};
