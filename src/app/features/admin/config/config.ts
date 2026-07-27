import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { CanchaConfig } from '../../../core/api/booking.service';
import { AdminNavComponent } from '../admin-nav/admin-nav';
import { UnsavedChangesService } from '../unsaved-changes.service';
import { ConfigStateService } from './config-state.service';
import { TabClubComponent } from './tabs/tab-club/tab-club';
import { TabAgendaComponent } from './tabs/tab-agenda/tab-agenda';
import { TabPreciosComponent } from './tabs/tab-precios/tab-precios';
import { TabCobrosComponent } from './tabs/tab-cobros/tab-cobros';

/** Tipos de cerramiento de la cancha (espeja el enum TipoPared del backend). */
const TIPO_PARED_OPCIONES = [
  { label: 'Cristal', value: 'CRISTAL' },
  { label: 'Muro', value: 'MURO' },
  { label: 'Mixta', value: 'MIXTA' },
];

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
    FormsModule,
    AdminNavComponent,
    SelectModule,
    ToastModule,
    ConfirmDialogModule,
    TabClubComponent,
    TabAgendaComponent,
    TabPreciosComponent,
    TabCobrosComponent,
  ],
  providers: [MessageService, ConfirmationService, ConfigStateService],
  templateUrl: './config.html',
  styleUrl: './config.scss',
})
export class ConfigComponent {
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly primeng = inject(PrimeNG);
  private readonly unsaved = inject(UnsavedChangesService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  /** Estado de la pantalla (signals de datos, validaciones, `save()`). Ver `config-state.service.ts`
   *  para qué vive acá vs allá: acá quedan `tab`/`irATab`, todo lo que toca `location`/`history`,
   *  los toasts y los ConfirmDialog; el resto es delegación fina al servicio. Se expone con el mismo
   *  nombre público que tenía cada signal/handler (alias directo o `.bind(this.st)`) para no tener
   *  que tocar los ~200 bindings de `config.html`: es un refactor de estado puro, cero cambios visuales. */
  protected readonly st = inject(ConfigStateService);

  readonly tipoParedOpciones = TIPO_PARED_OPCIONES;

  // ── Pestañas ──
  readonly tabs = CONFIG_TABS;
  readonly tab = signal<ConfigTab>('club');

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly reservasAfectadas = this.st.reservasAfectadas;
  readonly pasoMinutos = this.st.pasoMinutos;
  readonly duraciones = this.st.duraciones;
  readonly precioModo = this.st.precioModo;
  readonly autoasignacion = this.st.autoasignacion;
  readonly canchas = this.st.canchas;
  readonly editingCanchaId = this.st.editingCanchaId;
  readonly canchaFormOpen = this.st.canchaFormOpen;
  readonly cNombre = this.st.cNombre;
  readonly cOrden = this.st.cOrden;
  readonly cTechada = this.st.cTechada;
  readonly cTipoPared = this.st.cTipoPared;
  readonly cPrecio = this.st.cPrecio;
  readonly cColor = this.st.cColor;
  readonly canchaSaving = this.st.canchaSaving;
  readonly canchaTogglingId = this.st.canchaTogglingId;
  readonly canchasOrdenadas = this.st.canchasOrdenadas;
  readonly canCanchaSave = this.st.canCanchaSave;
  readonly canchasSinPrecio = this.st.canchasSinPrecio;
  readonly bloqueos = this.st.bloqueos;
  readonly dirty = this.st.dirty;
  readonly saving = this.st.saving;
  readonly loaded = this.st.loaded;
  readonly invalidPaso = this.st.invalidPaso;
  readonly invalidDuraciones = this.st.invalidDuraciones;
  readonly invalidPrecio = this.st.invalidPrecio;
  readonly invalidPrecioFranjas = this.st.invalidPrecioFranjas;
  readonly invalidSena = this.st.invalidSena;
  readonly invalidHorario = this.st.invalidHorario;
  readonly invalidBreak = this.st.invalidBreak;
  readonly canSave = this.st.canSave;
  readonly saveState = this.st.saveState;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual (mismo nombre público) ──
  readonly toggleAutoasignacion = this.st.toggleAutoasignacion.bind(this.st);
  readonly startNewCancha = this.st.startNewCancha.bind(this.st);
  readonly editCancha = this.st.editCancha.bind(this.st);
  readonly cancelCanchaEdit = this.st.cancelCanchaEdit.bind(this.st);
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
        this.tab.set('cobros');
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

  // ── Canchas ──
  saveCancha(): void {
    if (!this.st.canCanchaSave()) return;
    const creando = this.st.editingCanchaId() == null;
    this.st.saveCancha().subscribe({
      next: (saved) => {
        this.messages.add({
          severity: 'success',
          summary: creando ? 'Cancha creada' : 'Cancha actualizada',
          detail: saved.nombre,
        });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos guardar la cancha. Probá de nuevo.',
        });
      },
    });
  }

  /** Activa/desactiva una cancha. Al desactivar, pide confirmación (deja de ofrecerse, no borra reservas). */
  toggleCanchaEstado(c: CanchaConfig): void {
    const activando = c.estado !== 'ACTIVO';
    if (!activando) {
      this.confirm.confirm({
        header: 'Desactivar cancha',
        message: `¿Desactivar "${c.nombre}"? Deja de ofrecerse al público para reservar; las reservas ya hechas se conservan.`,
        acceptLabel: 'Desactivar',
        rejectLabel: 'Volver',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => this.doToggleCanchaEstado(c, 'INACTIVO'),
      });
    } else {
      this.doToggleCanchaEstado(c, 'ACTIVO');
    }
  }

  private doToggleCanchaEstado(c: CanchaConfig, estado: string): void {
    this.st.cambiarEstadoCancha(c, estado).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: estado === 'ACTIVO' ? 'Activada' : 'Desactivada',
          detail: c.nombre,
        });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cambiar el estado de la cancha. Probá de nuevo.',
        });
      },
    });
  }

  askDeleteCancha(c: CanchaConfig): void {
    this.confirm.confirm({
      header: 'Eliminar cancha',
      message: `¿Eliminar la cancha "${c.nombre}"? Las reservas ya hechas se conservan.`,
      acceptLabel: 'Eliminar',
      rejectLabel: 'Volver',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDeleteCancha(c),
    });
  }

  private doDeleteCancha(c: CanchaConfig): void {
    this.st.eliminarCancha(c).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Eliminada', detail: c.nombre });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos eliminar la cancha. Probá de nuevo.',
        });
      },
    });
  }

  tipoParedLabel(value: string | null): string {
    return this.tipoParedOpciones.find((o) => o.value === value)?.label ?? (value ?? '—');
  }

  // ── Guardar ──
  save(): void {
    if (!this.st.canSave()) return;
    this.st.save().subscribe({
      next: () => {
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
