// Dev: el back corre en :8095. tenantInterceptor antepone `apiBase` a las URLs
// relativas `/public` y `/api`, así el front (que vive en :4400) le pega al back.
export const environment = {
  production: false,
  apiBase: 'http://localhost:8095',
  // Dominio base: lo que está DESPUÉS del subdominio del tenant. En dev = 'localhost'
  // (así demo.localhost → tenant 'demo', y localhost pelado → apex/landing de marketing).
  baseDomain: 'localhost',
  // URL pública de un club a partir de su slug (reemplazar "{slug}"). En dev, el front sirve
  // en :4400 y el subdominio resuelve por /etc/hosts o el wildcard de localhost.
  tenantBaseUrl: 'http://{slug}.localhost:4400/',
};
