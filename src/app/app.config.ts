import {
  ApplicationConfig,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { aplicarMarcaCacheada } from './core/branding/branding-boot';
import { cargarFuentes } from './core/landing/fuentes';
import { FUENTES_PLATAFORMA, urlFuentes } from './core/landing/plantillas';
import { currentTenantSlug } from './core/tenant/tenant';
import { authInterceptor } from './core/auth/auth.interceptor';
import { platformInterceptor } from './core/platform/platform.interceptor';
import { tenantInterceptor } from './core/tenant/tenant.interceptor';

// El primary por defecto de Aura es esmeralda; lo pisamos con la paleta teal de la marca
// (#0a8a99, del logo) para que datepickers, diálogos y demás componentes PrimeNG no desentonen.
const TealAura = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e8f6f8',
      100: '#d0edf0',
      200: '#a3dde3',
      300: '#6cc7d1',
      400: '#38aebc',
      500: '#0a8a99',
      600: '#087a88',
      700: '#076572',
      800: '#065057',
      900: '#053e44',
      950: '#03292e',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    // Aplica los colores cacheados del club ANTES del primer paint. Sin esto la marca entra recién
    // cuando renderiza la nav del panel (chunk lazy) y el admin —que es client-render, sin el HTML
    // del server que ya trae la marca en la landing— pinta el color de plataforma y salta al del
    // club. Se llama al helper suelto y NO a BrandingService a propósito: el servicio depende de la
    // API del panel y arrastraba todo ese árbol al bundle inicial de cualquier visitante público.
    provideAppInitializer(() => {
      const platformId = inject(PLATFORM_ID);
      const doc = inject(DOCUMENT);
      if (!isPlatformBrowser(platformId)) return;
      aplicarMarcaCacheada(doc.documentElement.style, currentTenantSlug());
    }),
    // Tipografía de plataforma. Antes venía de un <link> fijo en index.html; ahora la landing pide
    // la de SU plantilla (ver core/landing/fuentes.ts) y este initializer se ocupa del resto de la
    // app —marketing, panel, los modales compartidos de la landing— que sigue viviendo de
    // `--display`/`--body`/`--mono` de styles.scss. SIN guard de browser a propósito: corre también
    // en el server (DOCUMENT inyectado, nunca el global) para que el <link> viaje en el HTML
    // servido y el primer paint ya salga con la tipografía correcta. Es idempotente por URL, así
    // que en la plantilla A —que usa las mismas tres familias— sigue habiendo un solo <link>.
    provideAppInitializer(() => {
      cargarFuentes(inject(DOCUMENT), urlFuentes(FUENTES_PLATAFORMA));
    }),
    // authInterceptor PRIMERO: adjunta el Bearer mientras la URL todavía es relativa
    // (`/api/v1/...`). tenantInterceptor corre después y reescribe a la URL absoluta del
    // back (apiBase) + agrega X-Tenant; el clone preserva el Authorization ya puesto.
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, platformInterceptor, tenantInterceptor])
    ),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: TealAura,
        options: {
          darkModeSelector: '.app-dark',
        },
      },
    }),
  ],
};
