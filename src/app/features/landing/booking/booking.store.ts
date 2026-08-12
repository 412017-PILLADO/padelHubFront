import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BookingService, CanchaLibre, Slot } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';

const MES_ABBR = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
const DOWS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];
/** Abreviatura del día para el recap compacto ("Vie 24/07"). Índice = Date.getDay() (0=Domingo). */
const DOW_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Qué está reservando este visitante: duración, día, hora, cancha, sus datos, la confirmación y la
 * pantalla de éxito (incluida la seña). Lee la identidad del club desde `ClubStore` (config,
 * precios, teléfono obligatorio, alias de la seña) pero no la administra — ver ahí.
 */
@Injectable()
export class BookingStore {
  private readonly booking = inject(BookingService);
  private readonly messages = inject(MessageService);
  private readonly club = inject(ClubStore);

  /** Feedback breve del botón "Copiar" del alias en la pantalla de éxito. */
  readonly aliasCopiado = signal(false);
  /** Link de Checkout Pro para pagar la seña online (null = solo alias por transferencia). */
  readonly senaInitPoint = signal<string | null>(null);

  readonly today = startOfDay(new Date());
  readonly minDate = this.today;

  // ── Paso 1 · Duración ─────────────────────────────────────────────
  readonly duraciones = computed(() => this.club.config()?.duracionesPermitidas ?? [60, 90, 120]);
  readonly duracion = signal<number>(90);
  /** true en cuanto el visitante elige la duración a mano. El default de la config llega por un
   *  effect (ver constructor) que puede resolver DESPUÉS del primer click del visitante (el fetch
   *  real es async); sin esta bandera ese default tardío pisaría la elección manual. Campo común
   *  (NO signal) a propósito: el effect la lee, y si fuera reactiva, leerla adentro de sus ramas la
   *  volvería una dependencia más — un click (que la pone en true) dispararía una re-ejecución
   *  completa del effect (initDefaultDay() de nuevo, toast de error repetido). Nada la lee desde el
   *  template tampoco, así que no hay ninguna razón para que sea reactiva. */
  private duracionElegida = false;

  /**
   * Mostramos el paso de duración solo si el club permite otras duraciones y hay más de una. Si no,
   * todos juegan el turno principal y nos salteamos el paso → reserva más rápida.
   */
  readonly showDuracion = computed(
    () => this.club.config()?.permitirOtrasDuraciones !== false && this.duraciones().length > 1
  );
  /**
   * Mostramos el paso de elegir cancha salvo que el club use autoasignación: en ese caso el sistema
   * asigna la menos cargada y le sacamos el paso al cliente (reserva más corta).
   */
  readonly showCancha = computed(() => this.club.config()?.autoasignacion !== true);
  /** Numeración de los pasos visibles (corre según qué pasos se muestran). */
  readonly stepNums = computed(() => {
    let n = 0;
    const num = () => String(++n).padStart(2, '0');
    return {
      dur: this.showDuracion() ? num() : '',
      dia: num(),
      hora: num(),
      cancha: this.showCancha() ? num() : '',
      datos: num(),
    };
  });

  // ── Paso 2 · Día ──────────────────────────────────────────────────
  readonly selectedDay = signal<Date | null>(null);
  readonly calOpen = signal(false);
  readonly pickerValue = signal<Date | null>(null);

  // ── Paso 3 · Hora ─────────────────────────────────────────────────
  readonly slots = signal<Slot[]>([]);
  readonly loadingSlots = signal(false);
  readonly slotsLoaded = signal(false);
  readonly selectedTime = signal<string | null>(null);

  // ── Paso 4 · Cancha ───────────────────────────────────────────────
  /** Token "ANY" = cualquiera disponible (canchaId null). */
  readonly ANY = -1;
  readonly selectedCancha = signal<number | null>(null);

  // ── Paso 5 · Datos ────────────────────────────────────────────────
  readonly nombre = signal('');
  readonly whatsapp = signal('');
  readonly empresa = signal('');
  readonly enviando = signal(false);

  readonly success = signal(false);
  readonly successData = signal<{
    cancha: string;
    dia: string;
    hora: string;
    duracion: number;
    primerNombre: string;
    nombreCompleto: string;
    pendiente: boolean;
    senaMonto: string | null;
    senaAlias: string | null;
  } | null>(null);

  /** Link de WhatsApp para mandar el comprobante de la seña (usa el turno recién reservado). */
  readonly whatsappSenaUrl = computed(() => {
    const wa = this.club.whatsappRaw();
    const d = this.successData();
    if (!wa || !d) return null;
    const msg =
      `¡Hola! Soy ${d.nombreCompleto}. Te paso el comprobante de la seña ` +
      `de mi turno: ${d.cancha}, ${d.dia} a las ${d.hora}.`;
    return `https://wa.me/${wa.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  });

  // ── Day chips ─────────────────────────────────────────────────────
  readonly chips = computed(() => [
    { label: 'Hoy', date: this.today },
    { label: 'Mañana', date: addDays(this.today, 1) },
    { label: 'Pasado', date: addDays(this.today, 2) },
  ]);

  /** Día elegido con el calendario, fuera de los chips Hoy/Mañana/Pasado. */
  readonly customDay = computed(() => {
    const day = this.selectedDay();
    if (!day || this.chips().some((c) => sameDay(day, c.date))) return null;
    return day;
  });

  // ── Estado derivado ───────────────────────────────────────────────
  readonly dayDone = computed(() => this.selectedDay() !== null);
  readonly timeDone = computed(() => this.selectedTime() !== null);
  readonly canchaDone = computed(() => this.selectedCancha() !== null);

  /** Slot actualmente elegido (para listar sus canchas libres). */
  readonly currentSlot = computed(() =>
    this.slots().find((s) => s.hora === this.selectedTime()) ?? null
  );
  readonly canchasDelSlot = computed<CanchaLibre[]>(
    () => this.currentSlot()?.canchasLibres ?? []
  );

  // Validación por campo (antes era silenciosa: formValid las combinaba sin exponer el motivo).
  readonly nombreValid = computed(() => this.nombre().trim().length >= 2);
  readonly whatsappValid = computed(() => {
    if (!this.club.requiereTelefono()) return true;
    return this.whatsapp().replace(/\D/g, '').length >= 6;
  });
  readonly formValid = computed(() => this.nombreValid() && this.whatsappValid());
  readonly canConfirm = computed(() => this.canchaDone() && this.formValid());
  readonly formOpen = computed(() => this.canchaDone());

  /** Tocado = el campo perdió el foco al menos una vez; recién ahí mostramos su hint de error. */
  readonly nombreTouched = signal(false);
  readonly whatsappTouched = signal(false);

  /** Por qué está deshabilitado "Confirmar turno" (null si puede confirmarse). Solo considera los
   * campos ya tocados, para no arrancar la pantalla con errores antes de que el cliente escriba. */
  readonly confirmBlockedReason = computed(() => {
    if (!this.nombreValid() && this.nombreTouched()) return 'Ingresá tu nombre (mínimo 2 letras).';
    if (!this.whatsappValid() && this.whatsappTouched()) {
      return 'Ingresá un WhatsApp válido (mínimo 6 dígitos).';
    }
    if (!this.formValid()) return 'Completá tu nombre' + (this.club.requiereTelefono() ? ' y WhatsApp.' : '.');
    return null;
  });

  /**
   * Precio a mostrar junto al horario y en el recap (M2): con una cancha puntual elegida, el precio
   * EFECTIVO de esa cancha en el slot elegido (ya viene con la franja horaria aplicada por el back);
   * con autoasignación o "Cualquiera disponible" y un horario ya elegido, el precio exacto si todas
   * las canchas del slot cobran lo mismo, o "desde $mínimo" si varía por cancha — usando siempre los
   * precios efectivos del slot, no el precio estático de la config pública. Antes de elegir horario
   * (todavía no hay slot), cae al precio estático por cancha, considerando también el mínimo de las
   * franjas horarias configuradas (`precioFranjas`): puede haber un horario más barato que el precio
   * base. null si el club no muestra precios o no hay ningún precio cargado.
   */
  readonly precioResumen = computed<{ texto: string; desde: boolean } | null>(() => {
    if (!this.club.mostrarPrecios()) return null;
    const seleccion = this.selectedCancha();

    if (seleccion !== null && seleccion !== this.ANY) {
      // Cancha puntual elegida: precio efectivo de esa cancha en el slot seleccionado.
      const c = this.canchasDelSlot().find((x) => x.id === seleccion);
      const precio = c ? this.precioTurno(c) : null;
      return precio ? { texto: `$${precio}`, desde: false } : null;
    }

    if (this.selectedTime() !== null) {
      // Horario ya elegido (autoasignación / "cualquiera disponible"): precios efectivos del slot.
      const precios = this.canchasDelSlot()
        .map((c) => c.precioHora)
        .filter((p): p is number => p != null && p > 0);
      if (!precios.length) return null;
      const min = Math.min(...precios);
      const max = Math.max(...precios);
      const total = Math.round((min * this.duracion()) / 60).toLocaleString('es-AR');
      return min === max ? { texto: `$${total}`, desde: false } : { texto: `desde $${total}`, desde: true };
    }

    // Sin horario elegido todavía: candidatos = precio base de cada cancha y ese mismo precio con
    // cada ajuste porcentual de franja aplicado (un descuento en cierto horario puede dejar un
    // turno más barato que el precio base de cualquier cancha).
    const canchas = this.club.config()?.canchas ?? [];
    const franjas = this.club.config()?.precioFranjas ?? [];
    const basePrecios = canchas
      .map((c) => c.precioHora)
      .filter((p): p is number => p != null && p > 0);
    if (!basePrecios.length) return null;
    const conAjustes = basePrecios.flatMap((p) =>
      franjas.map((f) => Math.round((p * (100 + f.ajustePorcentaje)) / 100)),
    );
    const precios = [...basePrecios, ...conAjustes];
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const total = Math.round((min * this.duracion()) / 60).toLocaleString('es-AR');
    // Si hay franjas cargadas el precio siempre puede variar según el horario, aunque hoy el
    // mínimo coincida con el máximo: mostramos "desde" para no prometer un precio fijo.
    const desde = min !== max || franjas.length > 0;
    return desde ? { texto: `desde $${total}`, desde: true } : { texto: `$${total}`, desde: false };
  });

  /** true si el precio efectivo de esta cancha en el slot difiere del precio habitual (estático) de
   *  esa misma cancha en la config pública: indica que está pisado por una franja horaria especial. */
  precioEsEspecial(c: CanchaLibre): boolean {
    if (c.precioHora == null) return false;
    const base = this.club.config()?.canchas.find((x) => x.id === c.id)?.precioHora ?? null;
    return base != null && base !== c.precioHora;
  }

  /** Recap compacto del turno elegido, junto al botón "Confirmar turno" (M10). */
  readonly recap = computed(() => {
    const day = this.selectedDay();
    const hora = this.selectedTime();
    if (!day || !hora) return null;
    const cancha = !this.showCancha()
      ? 'Se asigna al confirmar'
      : this.selectedCancha() === this.ANY
        ? 'Cualquiera disponible'
        : (this.canchasDelSlot().find((c) => c.id === this.selectedCancha())?.nombre ?? 'Se asigna al confirmar');
    return {
      dia: this.recapDay(day),
      hora: `${hora} hs`,
      duracion: this.duracion(),
      cancha,
      precio: this.precioResumen(),
    };
  });

  readonly timeHint = computed(() => {
    if (!this.selectedDay()) return 'Elegí primero el día.';
    if (this.loadingSlots()) return 'Buscando turnos…';
    if (this.slotsLoaded() && this.slots().length === 0) {
      return 'Sin turnos para esta fecha y duración.';
    }
    return '';
  });
  readonly showTimes = computed(
    () => this.dayDone() && !this.loadingSlots() && this.slots().length > 0
  );

  /** Último estado de `club.estadoCarga()` ya procesado por el effect del constructor. Campo
   *  común (no signal, no se lee reactivamente): solo sirve para que el effect sea idempotente
   *  por transición si llega a re-ejecutarse más de una vez para el mismo estado. */
  private ultimoEstadoAtendido: 'inicial' | 'cargando' | 'ok' | 'error' = 'inicial';

  /**
   * Generación del pedido de disponibilidad en curso. Cada llamada a `loadAvailability()` se lleva
   * un número; cuando vuelve la respuesta, si ya no es la última, se descarta. Sin esto, cambiar de
   * día rápido dejaba que la respuesta VIEJA llegara después y repintara la grilla con los turnos
   * del día que el visitante ya abandonó — en los e2e salía como un "element detached from the DOM"
   * al clickear confirmar.
   */
  private pedidoSlots = 0;

  constructor() {
    // El fetch de config (ClubStore.cargar()) es async: la duración default y el día inicial del
    // flujo de reserva dependen de que la config ya haya llegado (o haya fallado), así que se
    // enganchan acá con un effect sobre estadoCarga() en vez de encadenarse a mano en un callback.
    // Ver ClubStore para el detalle de fetch + branding + SEO.
    effect(() => {
      const estado = this.club.estadoCarga();
      // Idempotente por transición: sin esto, cualquier re-ejecución del effect (el propio Angular
      // puede disparar una si el body llega a leer OTRA señal, como pasó con duracionElegida antes
      // de bajarla a campo común) repetiría initDefaultDay()/el toast de error para el MISMO estado.
      if (estado === this.ultimoEstadoAtendido) return;
      this.ultimoEstadoAtendido = estado;
      if (estado === 'ok') {
        // Si el visitante ya clickeó una duración mientras esto resolvía, su elección gana: el
        // default de la config no se le impone tarde (ver duracionElegida). Lectura de un campo
        // común, no de un signal: no debe volverse dependencia del effect.
        if (!this.duracionElegida) this.duracion.set(this.club.config()!.duracionDefault);
        this.initDefaultDay();
      } else if (estado === 'error') {
        if (!this.duracionElegida) this.duracion.set(90);
        this.initDefaultDay();
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar la configuración. Probá de nuevo.',
        });
      }
    });
  }

  /** Proba HOY/MAÑANA/PASADO con la duración elegida; arranca en el primero con disponibilidad. */
  private initDefaultDay(): void {
    const candidates = [this.today, addDays(this.today, 1), addDays(this.today, 2)];
    const dur = this.duracion();
    const probes$ = candidates.map((d) =>
      this.booking
        .disponibilidad(this.apiFecha(d), dur)
        .pipe(catchError(() => of([] as Slot[])))
    );
    forkJoin(probes$).subscribe((results) => {
      const idx = results.findIndex((slots) => slots.some((s) => s.disponible));
      const chosenIdx = idx !== -1 ? idx : 0;
      this.selectedDay.set(startOfDay(candidates[chosenIdx]));
      this.slots.set(results[chosenIdx]);
      this.slotsLoaded.set(true);
    });
  }

  // ── Paso 1 · Duración ─────────────────────────────────────────────
  pickDuracion(d: number): void {
    this.duracionElegida = true;
    if (this.duracion() === d) return;
    this.duracion.set(d);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    const day = this.selectedDay();
    if (day) this.loadAvailability(day);
  }

  // ── Chips de día ──────────────────────────────────────────────────
  chipDate(d: Date): string {
    return `${d.getDate()} ${MES_ABBR[d.getMonth()].toUpperCase()}`;
  }
  isChipSelected(d: Date): boolean {
    return !this.calOpen() && sameDay(this.selectedDay(), d);
  }

  selectDay(date: Date): void {
    const day = startOfDay(date);
    this.selectedDay.set(day);
    this.calOpen.set(false);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    this.loadAvailability(day);
  }

  toggleCalendar(): void {
    const opening = !this.calOpen();
    this.calOpen.set(opening);
    if (opening) this.pickerValue.set(this.selectedDay() ?? this.today);
  }

  onPickerSelect(value: Date): void {
    if (!value) return;
    this.pickerValue.set(startOfDay(value));
    // selectDay cierra el calendario (que tapa los horarios) y recarga disponibilidad.
    this.selectDay(value);
  }

  // ── Disponibilidad ────────────────────────────────────────────────
  private apiFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private loadAvailability(day: Date): void {
    const pedido = ++this.pedidoSlots;
    this.loadingSlots.set(true);
    this.slotsLoaded.set(false);
    this.slots.set([]);
    this.booking.disponibilidad(this.apiFecha(day), this.duracion()).subscribe({
      next: (slots) => {
        // Llegó tarde: ya hay un pedido más nuevo en vuelo, esta respuesta es de otro día.
        if (pedido !== this.pedidoSlots) return;
        this.slots.set(slots);
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
      },
      error: () => {
        // La guarda va también acá: un error viejo apagaba el spinner del pedido nuevo y encima
        // mostraba un toast por un día que el visitante ya no tiene en pantalla.
        if (pedido !== this.pedidoSlots) return;
        this.slots.set([]);
        this.loadingSlots.set(false);
        this.slotsLoaded.set(true);
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No pudimos cargar los turnos. Probá de nuevo.',
        });
      },
    });
  }

  selectTime(slot: Slot): void {
    if (!slot.disponible) return;
    this.selectedTime.set(slot.hora);
    // Con autoasignación no hay paso de cancha: dejamos "cualquiera" (ANY) elegido y pasamos a datos.
    this.selectedCancha.set(this.showCancha() ? null : this.ANY);
  }

  // ── Paso 4 · Cancha ───────────────────────────────────────────────
  selectCancha(id: number): void {
    this.selectedCancha.set(id);
  }
  isCanchaSelected(id: number): boolean {
    return this.selectedCancha() === id;
  }

  /** Etiqueta del material de la pared para la card de cancha (espeja tipoPared). */
  materialLabel(c: CanchaLibre): string {
    switch (c.tipoPared) {
      case 'MURO': return 'Hormigón';
      case 'MIXTA': return 'Mixta';
      case 'CRISTAL': return 'Vidrio';
      default: return c.tipoPared ?? 'Cancha';
    }
  }

  /** Precio total del turno (precio/hora × duración elegida), formateado con separador de miles. */
  precioTurno(c: CanchaLibre): string | null {
    if (c.precioHora == null) return null;
    const total = Math.round((c.precioHora * this.duracion()) / 60);
    return total.toLocaleString('es-AR');
  }

  // ── Confirmar ─────────────────────────────────────────────────────
  confirm(): void {
    if (!this.canConfirm()) return;
    const day = this.selectedDay();
    const hora = this.selectedTime();
    const canchaSel = this.selectedCancha();
    if (!day || !hora || canchaSel === null) return;

    const nombre = this.nombre().trim();
    const canchaId = canchaSel === this.ANY ? null : canchaSel;
    this.enviando.set(true);
    this.booking
      .crearReserva({
        complejoId: this.club.config()?.complejo.id,
        canchaId,
        fecha: this.apiFecha(day),
        hora,
        duracion: this.duracion(),
        clienteNombre: nombre,
        clienteWhatsapp: this.whatsapp().trim(),
        empresa: this.empresa(),
      })
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          this.successData.set({
            cancha: res.canchaNombre,
            dia: this.fmtRecapDay(day),
            hora: `${hora} hs`,
            duracion: this.duracion(),
            primerNombre: nombre.split(' ')[0],
            nombreCompleto: nombre,
            pendiente: res.estado === 'PENDIENTE',
            senaMonto: this.club.senaMontoFmt(),
            senaAlias: this.club.senaAlias(),
          });
          this.aliasCopiado.set(false);
          this.success.set(true);
          window.scrollTo(0, 0);

          this.senaInitPoint.set(null);
          if (res.estado === 'PENDIENTE' && this.club.config()?.pagoOnline) {
            this.booking.crearLinkSena(res.id, location.origin).subscribe({
              next: ({ initPoint }) => this.senaInitPoint.set(initPoint),
              error: () => this.senaInitPoint.set(null), // degrada al alias por transferencia
            });
          }
        },
        error: (err: HttpErrorResponse) => {
          this.enviando.set(false);
          if (err.status === 409) {
            this.messages.add({
              severity: 'warn',
              summary: 'Horario ocupado',
              detail: 'Ese turno ya fue tomado, probá otro.',
            });
            this.selectedTime.set(null);
            this.selectedCancha.set(null);
            this.loadAvailability(day);
          } else if (err.status === 422 || err.status === 429) {
            this.messages.add({
              severity: 'warn',
              summary: 'No pudimos reservar',
              detail: err.error?.error ?? 'Probá más tarde o escribinos.',
            });
          } else {
            this.messages.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No pudimos confirmar el turno. Probá de nuevo.',
            });
          }
        },
      });
  }

  private fmtRecapDay(d: Date): string {
    return `${DOWS[d.getDay()]} ${d.getDate()} ${MES_ABBR[d.getMonth()]}`;
  }

  /** Fecha compacta para el recap del turno antes de confirmar (M10), ej. "Vie 24/07". */
  private recapDay(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${DOW_ABBR[d.getDay()]} ${dd}/${mm}`;
  }

  backHome(): void {
    this.success.set(false);
    this.successData.set(null);
    this.senaInitPoint.set(null);
    this.selectedTime.set(null);
    this.selectedCancha.set(null);
    this.nombre.set('');
    this.whatsapp.set('');
    this.calOpen.set(false);
    this.selectDay(this.today);
    window.scrollTo(0, 0);
  }

  /** Copia el alias de la seña al portapapeles y muestra un feedback breve en el botón. */
  copyAlias(): void {
    const alias = this.successData()?.senaAlias;
    if (!alias) return;
    const ok = () => {
      this.aliasCopiado.set(true);
      this.messages.add({ severity: 'success', summary: 'Alias copiado', detail: alias });
      setTimeout(() => this.aliasCopiado.set(false), 1800);
    };
    const fail = () =>
      this.messages.add({
        severity: 'warn',
        summary: 'No se pudo copiar',
        detail: 'Copialo manualmente: ' + alias,
      });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(alias).then(ok, fail);
    } else {
      fail();
    }
  }
}
