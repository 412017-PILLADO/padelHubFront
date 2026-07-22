import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { platformGuard } from './core/platform/platform.guard';
import { tenantHostMatch } from './core/tenant/tenant';

export const routes: Routes = [
  {
    // Con subdominio de tenant (la-cancha.padel-hub.com.ar) → página de reserva del complejo.
    // El matcher corre en browser (location.hostname) y en server (header Host vía REQUEST — la
    // ruta '' se renderiza con RenderMode.Server, ver app.routes.server.ts): el HTML servido para
    // cada subdominio ya sale con el componente correcto, indexable y sin flash hasta hidratar.
    path: '',
    canMatch: [tenantHostMatch],
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    // Apex (sin subdominio) → landing de marketing de Padel-HUB. Fallback cuando tenantHostMatch
    // no matchea (mismo path '', Angular prueba la próxima ruta que sí matchea).
    path: '',
    loadComponent: () =>
      import('./features/marketing/marketing').then((m) => m.MarketingLanding),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/panel/panel').then((m) => m.PanelComponent),
  },
  {
    path: 'admin/config',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/config/config').then((m) => m.ConfigComponent),
  },
  {
    // Panel de plataforma (super-admin) — ruta oculta, no linkeada. Login + gestión de clubes.
    path: 'plataforma',
    loadComponent: () =>
      import('./features/platform/platform-login').then((m) => m.PlatformLoginComponent),
  },
  {
    path: 'plataforma/tenants',
    canActivate: [platformGuard],
    loadComponent: () =>
      import('./features/platform/platform-panel').then((m) => m.PlatformPanelComponent),
  },
  { path: '**', redirectTo: '' },
];
