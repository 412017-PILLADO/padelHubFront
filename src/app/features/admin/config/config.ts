import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { AdminNavComponent } from '../admin-nav/admin-nav';
import { BrandingService } from '../../../core/branding/branding.service';
import { UnsavedChangesService } from '../unsaved-changes.service';
import { ConfigStateService } from './config-state.service';
import { TabClubComponent } from './tabs/tab-club/tab-club';
import { TabAgendaComponent } from './tabs/tab-agenda/tab-agenda';
import { TabCanchasComponent } from './tabs/tab-canchas/tab-canchas';
import { TabPreciosComponent } from './tabs/tab-precios/tab-precios';
import { TabCobrosComponent } from './tabs/tab-cobros/tab-cobros';

const ES_TRANSLATION = {
  firstDayOfWeek: 1,
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  dayNamesMin: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ],
  monthNamesShort: [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ],
  today: 'Hoy',
  clear: 'Limpiar',
};

export type ConfigTab = 'club' | 'agenda' | 'canchas' | 'precios' | 'cobros';

/** Pestañas de configuración, en orden de recorrido del dueño. */
export const CONFIG_TABS: ReadonlyArray<{ id: ConfigTab; label: string }> = [
  { id: 'club', label: 'Tu club' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'canchas', label: 'Canchas' },
  { id: 'precios', label: 'Precios' },
  { id: 'cobros', label: 'Cobros' },
];

@Component({
  selector: 'app-admin-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminNavComponent,
    ToastModule,
    ConfirmDialogModule,
    TabClubComponent,
    TabAgendaComponent,
    TabCanchasComponent,
    TabPreciosComponent,
    TabCobrosComponent,
  ],
  providers: [MessageService, ConfirmationService, ConfigStateService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
})
export class ConfigComponent {
  private readonly messages = inject(MessageService);
  private readonly primeng = inject(PrimeNG);
  private readonly unsaved = inject(UnsavedChangesService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  /** Estado de la pantalla (signals de datos, validaciones, `save()`). Ver `config-state.service.ts`
   *  para qué vive acá vs allá: acá quedan `tab`/`irATab`, todo lo que toca `location`/`history` y el
   *  toast de carga/guardado general; el resto (incluidos los toasts/ConfirmDialog propios de cada
   *  pestaña) vive en el componente de esa pestaña. `MessageService`/`ConfirmationService` se proveen
   *  acá (`providers` del componente) para que los hijos los compartan por DI. */
  protected readonly st = inject(ConfigStateService);
  private readonly branding = inject(BrandingService);

  // ── Pestañas ──
  readonly tabs = CONFIG_TABS;
  readonly tab = signal<ConfigTab>('club');

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly reservasAfectadas = this.st.reservasAfectadas;
  readonly dirty = this.st.dirty;
  readonly invalidPaso = this.st.invalidPaso;
  readonly invalidDuraciones = this.st.invalidDuraciones;
  readonly invalidPrecio = this.st.invalidPrecio;
  readonly invalidSena = this.st.invalidSena;
  readonly invalidMarca = this.st.invalidMarca;
  readonly invalidHorario = this.st.invalidHorario;
  readonly invalidBreak = this.st.invalidBreak;
  readonly canSave = this.st.canSave;
  readonly saveState = this.st.saveState;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual (mismo nombre público) ──
  readonly dismissReservasAfectadas = this.st.dismissReservasAfectadas.bind(this.st);

  constructor() {
    this.primeng.setTranslation(ES_TRANSLATION);
    this.cargarConfig();
    this.st.cargarMarca();
    this.st.cargarMpEstado();

    // Cambios sin guardar: si el usuario cierra/recarga la pestaña, avisar antes de perderlos.
    // Sólo en browser (SSR no tiene window) y se limpia al destruir el componente.
    if (isPlatformBrowser(this.platformId)) {
      const onBeforeUnload = (e: BeforeUnloadEvent): void => {
        if (!this.st.dirty()) return;
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('beforeunload', onBeforeUnload);
        this.unsaved.setDirty(false);
      });

      // Pestaña inicial desde la URL (?tab=...), si es una válida.
      const t = new URLSearchParams(location.search).get('tab');
      if (t && CONFIG_TABS.some((x) => x.id === t)) {
        this.tab.set(t as ConfigTab);
      }

      // Retorno del flujo OAuth: MP redirige acá con /admin/config?mp=conectado.
      if (new URLSearchParams(location.search).get('mp') === 'conectado') {
        this.messages.add({ severity: 'success', summary: 'Mercado Pago conectado', detail: 'La cuenta del club quedó vinculada.' });
        history.replaceState(null, '', location.pathname);
        // La card de MP vive en "Cobros": posicionamos ahí para que el dueño vea el resultado.
        // `irATab` deja `?tab=cobros` en la URL (no sólo `this.tab.set`): así un F5 después del
        // retorno de MP se queda en Cobros en vez de volver a "Tu club".
        this.irATab('cobros');
        this.st.cargarMpEstado();
      }
    }
  }

  irATab(t: ConfigTab): void {
    this.tab.set(t);
    if (!isPlatformBrowser(this.platformId)) return;
    const url = new URL(location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url);
  }

  /** Carga (o recarga) la config de agenda desde el server y la aplica al estado. Se usa al iniciar
   *  y para resincronizar tras un `save()` parcialmente fallido. */
  private cargarConfig(): void {
    this.st.cargar().subscribe({
      next: (cfg) => this.st.applyConfig(cfg),
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar la configuración. Probá de nuevo.',
        });
      },
    });
  }

  // ── Guardar ──
  save(): void {
    if (!this.st.canSave()) return;
    this.st.save().subscribe({
      next: () => {
        // La marca es parte de la cadena de guardado: recoloreamos el panel (nav/acentos) en vivo,
        // sin recargar, con los valores que el back devolvió.
        this.branding.apply(this.st.marcaColor(), this.st.marcaColorSec(), this.st.marcaLogoUrl());
        this.messages.add({ severity: 'success', summary: 'Guardado', detail: 'Cambios guardados' });
      },
      error: (err: HttpErrorResponse) => {
        // Son varios PUT encadenados y NO son atómicos: si falla uno del medio, los anteriores
        // ya se persistieron. Recargamos del server para que la UI muestre el estado real
        // (y no quede el front creyendo que no se guardó nada mientras parte ya está en vivo).
        const backendMsg: string | undefined = err?.error?.error;
        const seccion = this.st.seccionActual();
        this.messages.add({
          severity: 'warn',
          summary: 'Guardado incompleto',
          detail: backendMsg
            ? `${seccion}: ${backendMsg}`
            : 'Puede que algunos cambios no se hayan aplicado. Recargamos la configuración para mostrarte el estado real.',
        });
        this.cargarConfig();
      },
    });
  }
}
