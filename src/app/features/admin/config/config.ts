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
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';

import { BloqueoItem } from '../../../core/api/agenda-config.service';
import { CanchaConfig } from '../../../core/api/booking.service';
import { AdminNavComponent } from '../admin-nav/admin-nav';
import { UnsavedChangesService } from '../unsaved-changes.service';
import { ConfigStateService, DOW_FULL } from './config-state.service';
import { TabClubComponent } from './tabs/tab-club/tab-club';
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

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MES_ABBR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** Opciones de duración ofrecidas como chips (se puede activar/desactivar). */
const DURACION_OPCIONES = [30, 45, 60, 75, 90, 120];

function timeOptions(): string[] {
  const arr: string[] = [];
  for (let m = 7 * 60; m <= 24 * 60; m += 30) {
    const h = String(Math.floor(m / 60) % 24).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    arr.push(`${h}:${mm}`);
  }
  return arr;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'app-admin-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AdminNavComponent,
    DatePickerModule,
    SelectModule,
    ToastModule,
    ConfirmDialogModule,
    TabClubComponent,
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

  readonly times = timeOptions();
  readonly dowLabels = DOW;
  readonly dowFull = DOW_FULL;
  readonly durOpciones = DURACION_OPCIONES;
  readonly tipoParedOpciones = TIPO_PARED_OPCIONES;
  readonly today = startOfDay(new Date());

  // ── Pestañas ──
  readonly tabs = CONFIG_TABS;
  readonly tab = signal<ConfigTab>('club');

  // ── Alias de signals/computed del servicio (mismo nombre que antes, sin `st.` en el template) ──
  readonly reservasAfectadas = this.st.reservasAfectadas;
  readonly week = this.st.week;
  readonly breakOn = this.st.breakOn;
  readonly breakFrom = this.st.breakFrom;
  readonly breakTo = this.st.breakTo;
  readonly pasoMinutos = this.st.pasoMinutos;
  readonly duraciones = this.st.duraciones;
  readonly duracionDefault = this.st.duracionDefault;
  readonly permitirOtras = this.st.permitirOtras;
  readonly precioModo = this.st.precioModo;
  readonly precioHoraGeneral = this.st.precioHoraGeneral;
  readonly precioFranjas = this.st.precioFranjas;
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
  readonly calValue = this.st.calValue;
  readonly bloqueoCanchaId = this.st.bloqueoCanchaId;
  readonly bloqueoMotivo = this.st.bloqueoMotivo;
  readonly canchaOpciones = this.st.canchaOpciones;
  readonly dirty = this.st.dirty;
  readonly saving = this.st.saving;
  readonly loaded = this.st.loaded;
  readonly invalidPaso = this.st.invalidPaso;
  readonly invalidDuraciones = this.st.invalidDuraciones;
  readonly invalidPrecio = this.st.invalidPrecio;
  readonly precioFranjasError = this.st.precioFranjasError;
  readonly invalidPrecioFranjas = this.st.invalidPrecioFranjas;
  readonly invalidSena = this.st.invalidSena;
  readonly invalidHorario = this.st.invalidHorario;
  readonly invalidBreak = this.st.invalidBreak;
  readonly canSave = this.st.canSave;
  readonly saveState = this.st.saveState;
  readonly breakStateLabel = this.st.breakStateLabel;
  readonly horarioAvisos = this.st.horarioAvisos;
  readonly bloqueosOrdenados = this.st.bloqueosOrdenados;
  readonly disabledDays = this.st.disabledDays;

  // ── Handlers del servicio que sólo tocan estado: se delegan tal cual (mismo nombre público) ──
  readonly toggleDay = this.st.toggleDay.bind(this.st);
  readonly setFrom = this.st.setFrom.bind(this.st);
  readonly setTo = this.st.setTo.bind(this.st);
  readonly toggleBreak = this.st.toggleBreak.bind(this.st);
  readonly setBreakFrom = this.st.setBreakFrom.bind(this.st);
  readonly setBreakTo = this.st.setBreakTo.bind(this.st);
  readonly isDurActive = this.st.isDurActive.bind(this.st);
  readonly toggleDur = this.st.toggleDur.bind(this.st);
  readonly setDefault = this.st.setDefault.bind(this.st);
  readonly togglePermitirOtras = this.st.togglePermitirOtras.bind(this.st);
  readonly setPrecioModo = this.st.setPrecioModo.bind(this.st);
  readonly onPrecioGeneralInput = this.st.onPrecioGeneralInput.bind(this.st);
  readonly addFranja = this.st.addFranja.bind(this.st);
  readonly removeFranja = this.st.removeFranja.bind(this.st);
  readonly setFranjaDesde = this.st.setFranjaDesde.bind(this.st);
  readonly setFranjaHasta = this.st.setFranjaHasta.bind(this.st);
  readonly setFranjaTipo = this.st.setFranjaTipo.bind(this.st);
  readonly onFranjaPctInput = this.st.onFranjaPctInput.bind(this.st);
  readonly toggleAutoasignacion = this.st.toggleAutoasignacion.bind(this.st);
  readonly startNewCancha = this.st.startNewCancha.bind(this.st);
  readonly editCancha = this.st.editCancha.bind(this.st);
  readonly cancelCanchaEdit = this.st.cancelCanchaEdit.bind(this.st);
  readonly setBloqueoCancha = this.st.setBloqueoCancha.bind(this.st);
  readonly setBloqueoMotivo = this.st.setBloqueoMotivo.bind(this.st);
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

  // ── Horario ──
  /** Etiqueta de una hora en el select de cierre: aclara que "00:00" es medianoche (24:00). */
  timeLabel(t: string): string {
    return t === '00:00' ? '00:00 (medianoche)' : t;
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

  // ── Bloqueos ──
  onPickerSelect(value: Date): void {
    if (!value) return;
    const fecha = ymd(startOfDay(value));
    this.st.calValue.set(null);
    const canchaId = this.st.bloqueoCanchaId();
    const canchaLabel = this.st.canchaOpciones().find((o) => o.value === canchaId)?.label ?? 'todo el complejo';
    this.confirm.confirm({
      header: 'Bloquear día',
      message: `¿Bloquear el ${this.fechaLarga(fecha)} para ${canchaLabel}?`,
      acceptLabel: 'Bloquear',
      rejectLabel: 'Volver',
      accept: () => this.doCrearBloqueo(fecha, canchaId),
    });
  }

  private doCrearBloqueo(fecha: string, canchaId: number | null): void {
    this.st.crearBloqueo(fecha, canchaId).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Bloqueado', detail: this.fechaLarga(fecha) });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos bloquear ese día. Probá de nuevo.',
        });
      },
    });
  }

  removeBloqueo(b: BloqueoItem): void {
    this.st.removeBloqueo(b).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Liberado', detail: this.fechaLarga(b.fecha) });
      },
      error: () => {
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos liberar ese día. Probá de nuevo.',
        });
      },
    });
  }

  bloqDayNum(b: BloqueoItem): string {
    const d = parseYmd(b.fecha);
    return `${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  }
  bloqDow(b: BloqueoItem): string {
    const d = parseYmd(b.fecha);
    return DOW_FULL[(d.getDay() + 6) % 7];
  }
  private fechaLarga(fecha: string): string {
    const d = parseYmd(fecha);
    return `${DOW_FULL[(d.getDay() + 6) % 7]} ${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
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
