// Dev: el back corre en :8090. tenantInterceptor antepone `apiBase` a las URLs
// relativas `/public` y `/api`, así el front (que vive en :4200) le pega al back.
export const environment = {
  production: false,
  apiBase: 'http://localhost:8090',
  // Dominio base: lo que está DESPUÉS del subdominio del tenant. En dev = 'localhost'
  // (así demo.localhost → tenant 'demo', y localhost pelado → apex/landing de marketing).
  baseDomain: 'localhost',
};
