import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // El panel depende de `localStorage` (JWT), que no existe en el server. Si se renderiza en
  // SSR/prerender, el authGuard no ve el token → redirige a login → al recargar /admin o cuando
  // el dev server hace un full reload, parecía que "deslogueaba". Estas rutas se renderizan solo
  // en el browser (el guard corre con el token disponible).
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/config', renderMode: RenderMode.Client },
  { path: 'admin/login', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
