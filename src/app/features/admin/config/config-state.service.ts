import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, concatMap, tap } from 'rxjs';

import {
  AgendaConfig,
  AgendaConfigService,
  BloqueoItem,
  DiaConfig,
  Marca,
  ReservaAfectada,
} from '../../../core/api/agenda-config.service';
import { CanchaConfig } from '../../../core/api/booking.service';
import { MpEstado, PagosService } from '../../../core/api/pagos.service';
import { UnsavedChangesService } from '../unsaved-changes.service';
import { environment } from '../../../../environments/environment';

/** Franja horaria de ajuste porcentual en edición: `tempId` es un id local (no viaja al back),
 *  necesario para trackear filas nuevas que todavía no tienen `id` del servidor. El signo se maneja
 *  con `tipo` (descuento/recargo) + `pct` positivo, que es como lo piensa el dueño; al guardar se
 *  convierte al `ajustePorcentaje` con signo del back. */
export interface FranjaEdit {
  tempId: number;
  desde: string;
  hasta: string;
  tipo: 'DESCUENTO' | 'RECARGO';
  pct: number | null;
}

export const DOW_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToHhmm(m: number): string {
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Estado de la pantalla de configuración: signals de datos, validaciones derivadas, carga inicial
 * y `save()`. Se provee en el componente `Config` (no en root): su ciclo de vida es el de la pantalla.
 *
 * Los handlers que sólo tocan estado viven acá completos. Los que mezclan estado con toasts o
 * ConfirmDialog quedan partidos: la mutación de estado (y la llamada al back) vive acá y devuelve el
 * Observable; el componente se suscribe y decide qué toast mostrar.
 */
@Injectable()
export class ConfigStateService {
  private readonly api = inject(AgendaConfigService);
  private readonly pagosService = inject(PagosService);
  private readonly unsaved = inject(UnsavedChangesService);

  private franjaSeq = 0;
  /** Sección que está guardando `save()` en este momento (para el toast de error del componente). */
  private seccion = 'Horario';

  // ── Marca (color primario + secundario + logo del club) ──
  readonly marcaColor = signal('#0a8a99');
  /** Color secundario (acento). null = sin definir → se usa el primario. */
  readonly marcaColorSec = signal<string | null>(null);
  /** Valor para el <input type=color> del secundario (no acepta null): cae al primario si no hay. */
  readonly marcaColorSecPicker = computed(() => this.marcaColorSec() ?? this.marcaColor());
  /** Plantilla de landing elegida por el club (A poster / B hero / C compacta). */
  readonly marcaPlantilla = signal('A');
  readonly marcaLogoUrl = signal<string | null>(null);
  readonly savingMarca = signal(false);
  readonly uploadingLogo = signal(false);
  /** Cambia tras subir/quitar el logo para bustear la caché del <img> de preview. */
  private readonly logoBust = signal(0);
  /** URL absoluta del logo para la preview (con cache-bust), o null si no hay logo. */
  readonly logoPreview = computed(() => {
    const u = this.marcaLogoUrl();
    if (!u) return null;
    const abs = /^https?:\/\//i.test(u) ? u : environment.apiBase + u;
    return abs + (abs.includes('?') ? '&' : '?') + 'v=' + this.logoBust();
  });

  // ── Horario semanal (index 0=Lun … 6=Dom) ──
  readonly week = signal<DiaConfig[]>([]);

  // ── Descanso ──
  readonly breakOn = signal(false);
  readonly breakFrom = signal('13:00');
  readonly breakTo = signal('14:00');

  // ── Duraciones ──
  readonly pasoMinutos = signal(30);
  readonly duraciones = signal<number[]>([60, 90, 120]);
  /** Turno principal: ancla la grilla de horarios y es el único turno si no se permiten otros. */
  readonly duracionDefault = signal(90);
  readonly permitirOtras = signal(true);

  // ── Precios ──
  readonly precioModo = signal<'GENERAL' | 'POR_CANCHA'>('POR_CANCHA');
  readonly precioHoraGeneral = signal<number | null>(null);

  // ── Precio por horario (franjas) ──
  readonly precioFranjas = signal<FranjaEdit[]>([]);

  // ── Seña ──
  readonly requiereSena = signal(false);
  readonly senaMonto = signal<number | null>(null);
  readonly senaAlias = signal<string | null>(null);
  readonly politicaCancelacion = signal<string | null>(null);

  // ── Mercado Pago ──
  readonly mpEstado = signal<MpEstado | null>(null);
  readonly mpBusy = signal(false);

  // ── Autoasignación de canchas ──
  readonly autoasignacion = signal(false);

  // ── Canchas ──
  readonly canchas = signal<CanchaConfig[]>([]);
  /** id de la cancha en edición; null = formulario de alta. */
  readonly editingCanchaId = signal<number | null>(null);
  readonly canchaFormOpen = signal(false);
  readonly cNombre = signal('');
  readonly cOrden = signal<number | null>(null);
  readonly cTechada = signal(false);
  readonly cTipoPared = signal('CRISTAL');
  readonly cPrecio = signal<number | null>(null);
  readonly cColor = signal('#0a8a99');
  /** Estado de la cancha en edición ('ACTIVO'/'INACTIVO'); se preserva al editar, no se pisa. */
  readonly cEstado = signal('ACTIVO');
  readonly canchaSaving = signal(false);
  /** id de cancha con el toggle activar/desactivar en curso (deshabilita el botón mientras pega al back). */
  readonly canchaTogglingId = signal<number | null>(null);

  readonly canchasOrdenadas = computed(() =>
    [...this.canchas()].sort((a, b) => a.orden - b.orden)
  );
  readonly canCanchaSave = computed(
    () => this.cNombre().trim().length > 0 && !this.canchaSaving()
  );
  /** Canchas activas sin precio cargado (sólo aplica en modo POR_CANCHA): el público no ve precio en esos turnos. */
  readonly canchasSinPrecio = computed(() => {
    if (this.precioModo() !== 'POR_CANCHA') return [];
    return this.canchas().filter((c) => c.estado === 'ACTIVO' && c.precioHora == null);
  });

  // ── Bloqueos ──
  readonly bloqueos = signal<BloqueoItem[]>([]);
  readonly calValue = signal<Date | null>(null);
  /** null = todo el complejo. */
  readonly bloqueoCanchaId = signal<number | null>(null);
  readonly bloqueoMotivo = signal('');

  /** Reservas que quedaron fuera del horario recién guardado o dentro de un bloqueo recién creado. */
  readonly reservasAfectadas = signal<ReservaAfectada[]>([]);

  readonly canchaOpciones = computed(() => [
    { label: 'Todo el complejo', value: null as number | null },
    ...this.canchas().map((c) => ({ label: c.nombre, value: c.id as number | null })),
  ]);

  // ── Contacto ──
  readonly direccion = signal('');
  readonly telefono = signal('');
  readonly whatsapp = signal('');
  readonly mapaUrl = signal('');
  readonly instagram = signal('');

  // ── Estado ──
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly loaded = signal(false);

  readonly invalidPaso = computed(() => {
    const n = this.pasoMinutos();
    return !(Number.isFinite(n) && n >= 5 && n <= 180);
  });
  readonly invalidDuraciones = computed(
    () => this.duraciones().length === 0 || !this.duraciones().includes(this.duracionDefault())
  );
  readonly invalidPrecio = computed(() => {
    if (this.precioModo() !== 'GENERAL') return false;
    const p = this.precioHoraGeneral();
    return p == null || !(p > 0);
  });
  /** Mensaje del primer problema en las franjas de precio por horario (espeja las validaciones
   *  del back: ajuste != 0 en rango, desde < hasta con medianoche, sin solapes). null si está OK. */
  readonly precioFranjasError = computed<string | null>(() => {
    const franjas = this.precioFranjas();
    for (const f of franjas) {
      if (f.pct == null || !(f.pct > 0)) {
        return 'Cargá el porcentaje en todas las franjas horarias (mayor a 0)';
      }
      if (f.tipo === 'DESCUENTO' && f.pct > 99) {
        return 'El descuento máximo es 99% (a 100% el turno saldría gratis)';
      }
      if (f.tipo === 'RECARGO' && f.pct > 300) {
        return 'El recargo máximo es 300%';
      }
    }
    for (const f of franjas) {
      if (f.hasta !== '00:00' && f.desde >= f.hasta) {
        return 'En cada franja horaria, el desde debe ser antes del hasta';
      }
    }
    const rangos = franjas.map((f) => ({
      from: hhmmToMin(f.desde),
      to: f.hasta === '00:00' ? 24 * 60 : hhmmToMin(f.hasta),
    }));
    for (let i = 0; i < rangos.length; i++) {
      for (let j = i + 1; j < rangos.length; j++) {
        if (rangos[i].from < rangos[j].to && rangos[j].from < rangos[i].to) {
          return 'Hay franjas horarias que se superponen';
        }
      }
    }
    return null;
  });
  readonly invalidPrecioFranjas = computed(() => this.precioFranjasError() !== null);
  readonly invalidSenaMonto = computed(() => {
    if (!this.requiereSena()) return false;
    const m = this.senaMonto();
    return m == null || !(m > 0);
  });
  readonly invalidSenaAlias = computed(() => {
    if (!this.requiereSena()) return false;
    const a = this.senaAlias();
    return a == null || a.trim().length === 0;
  });
  readonly invalidSena = computed(() => this.invalidSenaMonto() || this.invalidSenaAlias());
  /** Algún día abierto con apertura ≥ cierre (las horas "HH:mm" comparan bien como strings).
   *  Caso especial: cierre "00:00" significa medianoche (24:00), siempre después de cualquier apertura. */
  readonly invalidHorario = computed(() =>
    this.week().some((d) => d.open && d.to !== '00:00' && d.from >= d.to)
  );
  /** Descanso activo con inicio ≥ fin. */
  readonly invalidBreak = computed(() => this.breakOn() && this.breakFrom() >= this.breakTo());
  readonly canSave = computed(
    () => this.dirty() && !this.invalidPaso() && !this.invalidDuraciones()
      && !this.invalidHorario() && !this.invalidBreak()
      && !this.invalidPrecio() && !this.invalidPrecioFranjas() && !this.invalidSena() && !this.saving()
  );
  readonly saveState = computed(() => {
    if (this.invalidHorario()) return 'Revisá el horario: la apertura debe ser antes del cierre';
    if (this.invalidBreak()) return 'Revisá el descanso: el inicio debe ser antes del fin';
    if (this.invalidPaso()) return 'Revisá el paso (5–180 min)';
    if (this.invalidDuraciones()) return 'Elegí el turno principal';
    if (this.invalidPrecio()) return 'Cargá el precio general por hora';
    if (this.invalidPrecioFranjas()) return this.precioFranjasError() ?? 'Revisá el precio por horario';
    if (this.invalidSenaMonto()) return 'Cargá el monto de la seña';
    if (this.invalidSenaAlias()) return 'Cargá el alias de la seña';
    return this.dirty() ? 'Cambios sin guardar' : 'Todo guardado';
  });
  readonly breakStateLabel = computed(() =>
    this.breakOn() ? `${this.breakFrom()} — ${this.breakTo()}` : 'Sin pausa'
  );
  /** Aviso informativo (no bloqueante) por día: si la franja abierta no es múltiplo del turno
   *  principal, el resto al final del día queda sin poder reservarse. */
  readonly horarioAvisos = computed(() => {
    const dur = this.duracionDefault();
    if (!(dur > 0)) return [];
    const out: string[] = [];
    for (const d of this.week()) {
      if (!d.open || (d.to !== '00:00' && d.from >= d.to)) continue;
      const fromMin = hhmmToMin(d.from);
      const toMin = d.to === '00:00' ? 24 * 60 : hhmmToMin(d.to);
      const total = toMin - fromMin;
      const resto = total % dur;
      if (resto > 0) {
        const desde = minToHhmm(toMin - resto);
        const hasta = minToHhmm(toMin);
        out.push(`El horario de ${DOW_FULL[d.diaSemana]} termina ${desde}–${hasta}: los últimos ${resto} min no se podrán reservar.`);
      }
    }
    return out;
  });
  readonly bloqueosOrdenados = computed(() =>
    [...this.bloqueos()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  );

  /** JS weekday index (0=Dom..6=Sáb) de los días cerrados. */
  readonly disabledDays = computed(() => {
    const out: number[] = [];
    for (const d of this.week()) {
      if (!d.open) out.push((d.diaSemana + 1) % 7);
    }
    return out;
  });

  // ── Carga inicial ──
  /** Trae la config de agenda. El componente se suscribe: aplica el resultado con `applyConfig` y
   *  muestra el toast de error (la carga inicial es la única que necesita avisar si falla). */
  cargar(): Observable<AgendaConfig> {
    return this.api.getConfig();
  }

  cargarMarca(): void {
    this.api.getMarca().subscribe({
      next: (m) => {
        if (m.colorPrimario) this.marcaColor.set(m.colorPrimario);
        this.marcaColorSec.set(m.colorSecundario);
        if (m.plantilla) this.marcaPlantilla.set(m.plantilla);
        this.marcaLogoUrl.set(m.logoUrl);
      },
      error: () => {
        /* la marca es secundaria: si falla, el resto del panel sigue funcionando. */
      },
    });
  }

  cargarMpEstado(): void {
    this.pagosService.getMpEstado().subscribe({
      next: (e) => this.mpEstado.set(e),
      error: () => this.mpEstado.set({ conectado: false, mpUserId: null, expiraEn: null }),
    });
  }

  applyConfig(cfg: AgendaConfig): void {
    const byDay = new Map(cfg.week.map((d) => [d.diaSemana, d]));
    const week: DiaConfig[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(byDay.get(i) ?? { diaSemana: i, open: false, from: '09:00', to: '23:00' });
    }
    this.week.set(week);
    this.breakOn.set(cfg.breakOn);
    this.breakFrom.set(cfg.breakFrom || '13:00');
    this.breakTo.set(cfg.breakTo || '14:00');
    this.pasoMinutos.set(cfg.pasoMinutos);
    this.duraciones.set([...cfg.duraciones].sort((a, b) => a - b));
    this.duracionDefault.set(cfg.duracionDefault);
    this.permitirOtras.set(cfg.permitirOtrasDuraciones ?? true);
    this.precioModo.set(cfg.precioModo ?? 'POR_CANCHA');
    this.precioHoraGeneral.set(cfg.precioHoraGeneral ?? null);
    this.precioFranjas.set(
      (cfg.precioFranjas ?? []).map((f) => ({
        tempId: ++this.franjaSeq,
        desde: f.desde,
        hasta: f.hasta,
        tipo: (f.ajustePorcentaje < 0 ? 'DESCUENTO' : 'RECARGO') as FranjaEdit['tipo'],
        pct: Math.abs(f.ajustePorcentaje),
      }))
    );
    this.requiereSena.set(cfg.requiereSena ?? false);
    this.senaMonto.set(cfg.senaMonto ?? null);
    this.senaAlias.set(cfg.senaAlias ?? null);
    this.politicaCancelacion.set(cfg.politicaCancelacion ?? null);
    this.autoasignacion.set(cfg.autoasignacion ?? false);
    this.bloqueos.set(cfg.bloqueos ?? []);
    this.canchas.set(cfg.canchas ?? []);
    const c = cfg.contacto ?? {
      direccion: null, telefono: null, whatsapp: null, mapaUrl: null, instagram: null,
    };
    this.direccion.set(c.direccion ?? '');
    this.telefono.set(c.telefono ?? '');
    this.whatsapp.set(c.whatsapp ?? '');
    this.mapaUrl.set(c.mapaUrl ?? '');
    this.instagram.set(c.instagram ?? '');
    this.dirty.set(false);
    this.unsaved.setDirty(false);
    this.loaded.set(true);
  }

  // ── Marca ──
  /** Fija el color secundario (acento) desde el picker/hex. */
  setColorSec(v: string): void {
    this.marcaColorSec.set(v && v.trim() ? v.trim() : null);
  }

  /** Quita el color secundario: vuelve a usarse el primario para los acentos. */
  clearColorSec(): void {
    this.marcaColorSec.set(null);
  }

  /** Guarda los colores (primario + secundario) + plantilla del club. El componente ya validó el
   *  formato hex antes de llamar; acá sólo queda pegarle al back y actualizar el estado. */
  saveMarca(): Observable<Marca> {
    this.savingMarca.set(true);
    return this.api
      .putMarca({
        colorPrimario: this.marcaColor().trim(),
        colorSecundario: this.marcaColorSec()?.trim() || null,
        plantilla: this.marcaPlantilla(),
      })
      .pipe(
        tap({
          next: (m) => {
            this.savingMarca.set(false);
            if (m.colorPrimario) this.marcaColor.set(m.colorPrimario);
            this.marcaColorSec.set(m.colorSecundario);
            if (m.plantilla) this.marcaPlantilla.set(m.plantilla);
          },
          error: () => this.savingMarca.set(false),
        })
      );
  }

  /** Sube el logo (ya validado por el componente: tipo/tamaño). */
  uploadLogo(file: File): Observable<Marca> {
    this.uploadingLogo.set(true);
    return this.api.uploadLogo(file).pipe(
      tap({
        next: (m) => {
          this.uploadingLogo.set(false);
          this.marcaLogoUrl.set(m.logoUrl);
          this.logoBust.update((n) => n + 1);
        },
        error: () => this.uploadingLogo.set(false),
      })
    );
  }

  /** Quita el logo del club (vuelve a mostrarse solo el nombre). */
  removeLogo(): Observable<Marca> {
    this.uploadingLogo.set(true);
    return this.api.deleteLogo().pipe(
      tap({
        next: (m) => {
          this.uploadingLogo.set(false);
          this.marcaLogoUrl.set(m.logoUrl);
          this.logoBust.update((n) => n + 1);
        },
        error: () => this.uploadingLogo.set(false),
      })
    );
  }

  // ── Horario ──
  toggleDay(i: number): void {
    this.week.update((w) => {
      const next = [...w];
      next[i] = { ...next[i], open: !next[i].open };
      return next;
    });
    this.markDirty();
  }
  setFrom(i: number, value: string): void {
    this.week.update((w) => {
      const next = [...w];
      next[i] = { ...next[i], from: value };
      return next;
    });
    this.markDirty();
  }
  setTo(i: number, value: string): void {
    this.week.update((w) => {
      const next = [...w];
      next[i] = { ...next[i], to: value };
      return next;
    });
    this.markDirty();
  }

  // ── Descanso ──
  toggleBreak(): void { this.breakOn.update((v) => !v); this.markDirty(); }
  setBreakFrom(v: string): void { this.breakFrom.set(v); this.markDirty(); }
  setBreakTo(v: string): void { this.breakTo.set(v); this.markDirty(); }

  // ── Contacto ──
  setDireccion(v: string): void { this.direccion.set(v); this.markDirty(); }
  setTelefono(v: string): void { this.telefono.set(v); this.markDirty(); }
  setWhatsapp(v: string): void { this.whatsapp.set(v); this.markDirty(); }
  setMapaUrl(v: string): void { this.mapaUrl.set(v); this.markDirty(); }
  setInstagram(v: string): void { this.instagram.set(v); this.markDirty(); }

  // ── Duraciones ──
  isDurActive(d: number): boolean { return this.duraciones().includes(d); }
  toggleDur(d: number): void {
    // El turno principal no se puede desactivar (siempre tiene que ser reservable).
    if (d === this.duracionDefault()) return;
    this.duraciones.update((list) =>
      list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort((a, b) => a - b)
    );
    this.markDirty();
  }
  setDefault(d: number): void {
    this.duracionDefault.set(d);
    // El turno principal siempre tiene que estar entre las duraciones permitidas.
    if (!this.duraciones().includes(d)) {
      this.duraciones.update((list) => [...list, d].sort((a, b) => a - b));
    }
    this.markDirty();
  }
  togglePermitirOtras(): void { this.permitirOtras.update((v) => !v); this.markDirty(); }
  onPasoInput(value: string): void {
    const n = Number(value);
    this.pasoMinutos.set(Number.isFinite(n) ? Math.round(n) : 0);
    this.markDirty();
  }

  // ── Precios ──
  setPrecioModo(modo: 'GENERAL' | 'POR_CANCHA'): void { this.precioModo.set(modo); this.markDirty(); }
  // El input es type="number": ngModelChange emite number | null (NumberValueAccessor), no string.
  onPrecioGeneralInput(value: number | null): void {
    this.precioHoraGeneral.set(value == null || !Number.isFinite(value) ? null : Math.round(value));
    this.markDirty();
  }

  // ── Precio por horario (franjas) ──
  addFranja(): void {
    this.precioFranjas.update((list) => [
      ...list,
      { tempId: ++this.franjaSeq, desde: '15:00', hasta: '18:00', tipo: 'DESCUENTO' as const, pct: null },
    ]);
    this.markDirty();
  }
  removeFranja(tempId: number): void {
    this.precioFranjas.update((list) => list.filter((f) => f.tempId !== tempId));
    this.markDirty();
  }
  setFranjaDesde(tempId: number, value: string): void {
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, desde: value } : f))
    );
    this.markDirty();
  }
  setFranjaHasta(tempId: number, value: string): void {
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, hasta: value } : f))
    );
    this.markDirty();
  }
  setFranjaTipo(tempId: number, tipo: FranjaEdit['tipo']): void {
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, tipo } : f))
    );
    this.markDirty();
  }
  // El input es type="number": ngModelChange emite number | null (NumberValueAccessor), no string.
  onFranjaPctInput(tempId: number, value: number | null): void {
    const pct = value == null || !Number.isFinite(value) ? null : Math.abs(Math.round(value));
    this.precioFranjas.update((list) =>
      list.map((f) => (f.tempId === tempId ? { ...f, pct } : f))
    );
    this.markDirty();
  }

  // ── Seña ──
  toggleSena(): void { this.requiereSena.update((v) => !v); this.markDirty(); }
  onSenaMontoInput(value: number | null): void {
    this.senaMonto.set(value == null || !Number.isFinite(value) ? null : Math.round(value));
    this.markDirty();
  }
  onSenaAliasInput(value: string): void {
    this.senaAlias.set(value.trim() === '' ? null : value);
    this.markDirty();
  }
  onPoliticaCancelacionInput(value: string): void {
    this.politicaCancelacion.set(value.trim() === '' ? null : value);
    this.markDirty();
  }

  // ── Autoasignación ──
  toggleAutoasignacion(): void { this.autoasignacion.update((v) => !v); this.markDirty(); }

  // ── Mercado Pago ──
  /** El componente arma `returnTo` (usa `location.origin`) y redirige en el `next` (usa `location.href`). */
  conectarMp(returnTo: string): Observable<{ url: string }> {
    this.mpBusy.set(true);
    return this.pagosService.conectarMp(returnTo).pipe(
      tap({ error: () => this.mpBusy.set(false) })
    );
  }

  desconectarMp(): Observable<void> {
    return this.pagosService.desconectarMp().pipe(
      tap(() => this.mpEstado.set({ conectado: false, mpUserId: null, expiraEn: null }))
    );
  }

  // ── Canchas ──
  startNewCancha(): void {
    this.editingCanchaId.set(null);
    this.cNombre.set('');
    this.cOrden.set(null);
    this.cTechada.set(false);
    this.cTipoPared.set('CRISTAL');
    this.cPrecio.set(null);
    this.cColor.set('#0a8a99');
    this.cEstado.set('ACTIVO');
    this.canchaFormOpen.set(true);
  }

  editCancha(c: CanchaConfig): void {
    this.editingCanchaId.set(c.id);
    this.cNombre.set(c.nombre);
    this.cOrden.set(c.orden);
    this.cTechada.set(c.techada);
    this.cTipoPared.set(c.tipoPared ?? 'CRISTAL');
    this.cPrecio.set(c.precioHora);
    this.cColor.set(c.color ?? '#0a8a99');
    this.cEstado.set(c.estado || 'ACTIVO');
    this.canchaFormOpen.set(true);
  }

  cancelCanchaEdit(): void {
    this.canchaFormOpen.set(false);
    this.editingCanchaId.set(null);
  }

  saveCancha(): Observable<CanchaConfig> {
    this.canchaSaving.set(true);
    const nombre = this.cNombre().trim();
    const orden = this.cOrden();
    const techada = this.cTechada();
    const tipoPared = this.cTipoPared();
    const precioHora = this.cPrecio();
    const color = this.cColor()?.trim() || null;
    const editingId = this.editingCanchaId();

    const applyDone = (saved: CanchaConfig) => {
      this.canchas.update((list) => {
        const idx = list.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = saved;
          return next;
        }
        return [...list, saved];
      });
      this.canchaSaving.set(false);
      this.canchaFormOpen.set(false);
      this.editingCanchaId.set(null);
    };

    const req = editingId == null
      ? this.api.postCancha({ nombre, orden, techada, tipoPared, precioHora, color })
      // Nunca hardcodeamos el estado acá: se manda el que ya tenía la cancha (el toggle
      // activar/desactivar es un flujo aparte, ver `cambiarEstadoCancha`).
      : this.api.putCancha(editingId, { nombre, orden, techada, tipoPared, precioHora, color, estado: this.cEstado() });

    return req.pipe(
      tap({
        next: applyDone,
        error: () => this.canchaSaving.set(false),
      })
    );
  }

  /** Activa/desactiva una cancha (el componente ya resolvió la confirmación si hacía falta). */
  cambiarEstadoCancha(c: CanchaConfig, estado: string): Observable<CanchaConfig> {
    this.canchaTogglingId.set(c.id);
    return this.api
      .putCancha(c.id, {
        nombre: c.nombre,
        orden: c.orden,
        techada: c.techada,
        tipoPared: c.tipoPared ?? 'CRISTAL',
        precioHora: c.precioHora,
        color: c.color,
        estado,
      })
      .pipe(
        tap({
          next: (saved) => {
            this.canchaTogglingId.set(null);
            this.canchas.update((list) => list.map((x) => (x.id === saved.id ? saved : x)));
          },
          error: () => this.canchaTogglingId.set(null),
        })
      );
  }

  eliminarCancha(c: CanchaConfig): Observable<void> {
    return this.api.deleteCancha(c.id).pipe(
      tap(() => {
        this.canchas.update((list) => list.filter((x) => x.id !== c.id));
        // Si estaba seleccionada como destino de un bloqueo, resetear a "todo el complejo".
        if (this.bloqueoCanchaId() === c.id) this.bloqueoCanchaId.set(null);
        if (this.editingCanchaId() === c.id) this.cancelCanchaEdit();
      })
    );
  }

  // ── Bloqueos ──
  setBloqueoCancha(v: number | null): void { this.bloqueoCanchaId.set(v); }
  setBloqueoMotivo(v: string): void { this.bloqueoMotivo.set(v); }

  crearBloqueo(fecha: string, canchaId: number | null): Observable<BloqueoItem> {
    const motivo = this.bloqueoMotivo().trim() || null;
    return this.api.postBloqueo({ fecha, canchaId, motivo }).pipe(
      tap((created) => {
        this.bloqueos.update((list) => [...list, created]);
        this.bloqueoMotivo.set('');
        this.reservasAfectadas.set(created.reservasAfectadas ?? []);
      })
    );
  }

  dismissReservasAfectadas(): void {
    this.reservasAfectadas.set([]);
  }

  removeBloqueo(b: BloqueoItem): Observable<void> {
    return this.api.deleteBloqueo(b.id).pipe(
      tap(() => this.bloqueos.update((list) => list.filter((x) => x.id !== b.id)))
    );
  }

  // ── Guardar ──
  private markDirty(): void {
    this.dirty.set(true);
    this.unsaved.setDirty(true);
  }

  /** Sección que estaba guardando `save()` cuando falló (para el detalle del toast de error). */
  seccionActual(): string {
    return this.seccion;
  }

  save(): Observable<AgendaConfig> {
    this.saving.set(true);
    const norm = (v: string): string | null => v.trim() || null;
    const contacto = {
      direccion: norm(this.direccion()),
      telefono: norm(this.telefono()),
      whatsapp: norm(this.whatsapp()),
      mapaUrl: norm(this.mapaUrl()),
      instagram: norm(this.instagram()),
    };

    // Nombre de la sección que se está guardando en cada paso: se usa para señalar en el
    // toast de error cuál PUT falló (los pasos son secuenciales, así que en el momento del
    // error `seccion` siempre refleja el que está en curso).
    this.seccion = 'Horario';

    return this.api
      .putHorarios({
        breakOn: this.breakOn(),
        breakFrom: this.breakFrom(),
        breakTo: this.breakTo(),
        week: this.week(),
      })
      .pipe(
        concatMap((res) => {
          this.reservasAfectadas.set(res.reservasAfectadas ?? []);
          this.seccion = 'Duraciones';
          return this.api.putDuraciones({
            pasoMinutos: this.pasoMinutos(),
            duraciones: this.duraciones(),
            duracionDefault: this.duracionDefault(),
            permitirOtrasDuraciones: this.permitirOtras(),
          });
        }),
        concatMap(() => {
          this.seccion = 'Precios';
          // Mandamos siempre lo que hay cargado en el form (aunque el modo activo sea otro):
          // el back preserva el valor, así no se pisa lo que el usuario ya cargó si vuelve a cambiar de modo.
          return this.api.putPrecios({
            precioModo: this.precioModo(),
            precioHoraGeneral: this.precioHoraGeneral(),
          });
        }),
        concatMap(() => {
          this.seccion = 'Precio por horario';
          return this.api.putPrecioFranjas({
            franjas: this.precioFranjas().map((f) => ({
              desde: f.desde,
              hasta: f.hasta,
              ajustePorcentaje: f.tipo === 'DESCUENTO' ? -(f.pct as number) : (f.pct as number),
            })),
          });
        }),
        concatMap(() => {
          this.seccion = 'Seña';
          return this.api.putSena({
            requiereSena: this.requiereSena(),
            senaMonto: this.senaMonto(),
            senaAlias: this.senaAlias(),
          });
        }),
        concatMap(() => {
          this.seccion = 'Política de cancelación';
          return this.api.putPoliticaCancelacion(this.politicaCancelacion());
        }),
        concatMap(() => {
          this.seccion = 'Elección de cancha';
          return this.api.putAutoasignacion({ autoasignacion: this.autoasignacion() });
        }),
        concatMap(() => {
          this.seccion = 'Contacto';
          return this.api.putContacto(contacto);
        }),
        tap({
          next: (cfg) => {
            this.applyConfig(cfg);
            this.saving.set(false);
          },
          error: () => this.saving.set(false),
        })
      );
  }
}
