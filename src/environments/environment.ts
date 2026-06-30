// Dev: el back corre en :8095. tenantInterceptor antepone `apiBase` a las URLs
// relativas `/public` y `/api`, así el front (que vive en :4400) le pega al back.
export const environment = {
  production: false,
  apiBase: 'http://localhost:8095',
  // Dominio base: lo que está DESPUÉS del subdominio del tenant. En dev = 'localhost'
  // (así demo.localhost → tenant 'demo', y localhost pelado → apex/landing de marketing).
  baseDomain: 'localhost',
};
