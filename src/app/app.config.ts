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
