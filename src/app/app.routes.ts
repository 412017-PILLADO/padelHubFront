import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { tenantSubdomain } from './core/tenant/tenant';

export const routes: Routes = [
  {
    // Apex (sin subdominio) → landing de marketing de Padel-HUB.
    // Con subdominio de tenant (la-cancha.padel-hub.com.ar) → página de reserva del complejo.
    // En server/prerender no hay `window`: tenantSubdomain() devuelve null → marketing.
    path: '',
    loadComponent: () =>
      tenantSubdomain()
        ? import('./features/landing/landing').then((m) => m.Landing)
        : import('./features/marketing/marketing').then((m) => m.MarketingLanding),
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
  { path: '**', redirectTo: '' },
];
