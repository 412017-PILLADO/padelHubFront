import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { tenantInterceptor } from './core/tenant/tenant.interceptor';

// El primary por defecto de Aura es esmeralda; lo pisamos con la paleta cobalto de la app
// (#2747ff) para que datepickers, diálogos y demás componentes PrimeNG no desentonen.
const CobaltAura = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef1ff',
      100: '#dfe4ff',
      200: '#c3ccff',
      300: '#9dadff',
      400: '#6f84ff',
      500: '#2747ff',
      600: '#1f38e6',
      700: '#1a2fbf',
      800: '#172a99',
      900: '#16267a',
      950: '#0d1747',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    // authInterceptor PRIMERO: adjunta el Bearer mientras la URL todavía es relativa
    // (`/api/v1/...`). tenantInterceptor corre después y reescribe a la URL absoluta del
    // back (apiBase) + agrega X-Tenant; el clone preserva el Authorization ya puesto.
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, tenantInterceptor])
    ),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: CobaltAura,
        options: {
          darkModeSelector: '.app-dark',
        },
      },
    }),
  ],
};
