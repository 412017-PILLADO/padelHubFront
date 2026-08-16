import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

/** Una forma de cobrar la reserva, de las tres que el panel configura (pestaña "Cobros"). */
export interface ModoCobro {
  readonly clave: 'sin-sena' | 'transferencia' | 'mercadopago';
  readonly titulo: string;
  /** En qué estado nace la reserva. Es LA pregunta que un dueño hace primero. */
  readonly estado: string;
  /** `ok` = la reserva ya está cerrada · `espera` = queda algo por pasar. Decide el punto de color. */
  readonly tono: 'ok' | 'espera';
  /** Qué tiene que hacer el club. La mitad que las landings suelen esconder. */
  readonly vos: string;
  /** Qué ve el jugador en la pantalla de éxito. */
  readonly jugador: string;
}

/** Una franja de precio, de las que la pestaña "Precios" carga con su porcentaje. */
export interface Franja {
  readonly hora: string;
  /** Porcentaje sobre el precio base. Negativo abarata. */
  readonly pct: number;
  readonly cuando: string;
}

/** Un tipo de pared, de los tres que el panel ofrece por cancha. */
export interface Pared {
  readonly clase: 'mat-glass' | 'mat-concrete' | 'mat-mixed';
  readonly nombre: string;
}

/**
 * Las tres formas de cobro, sacadas de lo que la pestaña "Cobros" configura de verdad: el switch de
 * seña, el alias/CBU para transferir y la conexión de Mercado Pago. La redacción del estado es la
 * del propio panel — *"si pedís seña, la reserva del cliente queda pendiente hasta que confirmás"*.
 */
export const MODOS_COBRO: readonly ModoCobro[] = [
  {
    clave: 'sin-sena',
    titulo: 'Sin seña',
    estado: 'Confirmada al instante',
    tono: 'ok',
    vos: 'Nada. El turno ya está tomado y el pago lo arreglás en el club.',
    jugador: 'Su turno confirmado, con el día, la hora y la cancha.',
  },
  {
    clave: 'transferencia',
    titulo: 'Seña por transferencia',
    estado: 'Pendiente hasta que confirmás',
    tono: 'espera',
    vos: 'Mirás si llegó la transferencia y la confirmás desde el panel.',
    jugador: 'Tu alias o CBU, con un botón para copiarlo y transferir.',
  },
  {
    clave: 'mercadopago',
    titulo: 'Seña por Mercado Pago',
    estado: 'Se confirma sola',
    tono: 'ok',
    vos: 'Nada. El pago entra a tu cuenta y el turno se cierra solo.',
    jugador: 'El botón de pago; con la seña paga, su turno confirmado.',
  },
];

/**
 * Franjas de ejemplo. Los porcentajes son los que un club de verdad carga: la hora pico más cara, el
 * mediodía más barato. **El precio de la pantalla se calcula con esto**, no está escrito a mano — si
 * fuera literal, una franja podría decir +20% y mostrar un número que no es el +20%.
 */
export const FRANJAS: readonly Franja[] = [
  { hora: '09 a 13', pct: -30, cuando: 'Mediodía, cuando cuesta llenar' },
  { hora: '13 a 19', pct: 0, cuando: 'El resto del día' },
  { hora: '19 a 23', pct: 20, cuando: 'La hora pico, cuando todos quieren' },
];

/** El precio base del ejemplo, por hora de cancha. */
export const PRECIO_BASE = 12000;

/** Los tres materiales de pared que la config de canchas ofrece. */
export const PAREDES: readonly Pared[] = [
  { clase: 'mat-glass', nombre: 'Cristal' },
  { clase: 'mat-concrete', nombre: 'Muro' },
  { clase: 'mat-mixed', nombre: 'Mixta' },
];

/** Pesos argentinos sin centavos. Se arma una vez: `Intl` es caro de instanciar por llamada. */
const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

/**
 * "Nos adaptamos a tu club" — la sección que cuenta lo que el producto CONFIGURA.
 *
 * Nace de una observación del owner que era medible: la landing vendía "reservas online 24/7" y
 * "agenda por cancha", y no decía **nada** de lo que el producto realmente resuelve. Un club que
 * cobra seña —o sea la mayoría— no se enteraba de que el producto la cobra.
 *
 * **Y se rehízo por una segunda observación suya.** La primera versión eran tres bloques con tres
 * lenguajes visuales distintos —tarjetas con borde de color, filas tipo tabla, figuras ilustradas—,
 * que se leían como tres mini-secciones pegadas con cinta. Ahora los tres comparten una sola forma:
 * **una fila de opciones y un resultado que cambia**. Es, además, la misma lógica de la sección "Tu
 * marca" que va justo abajo (tocás un color, se repintan las plantillas), así que las dos secciones
 * vecinas dejaron de contradecirse: las dos se tocan.
 *
 * Lo que se muestra no es una animación de adorno: es **lo que realmente pasa con el turno** según
 * cómo cobre el club, incluida la parte que las landings suelen esconder — qué tiene que hacer el
 * dueño en cada caso.
 */
@Component({
  selector: 'app-adaptable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './adaptable.html',
  styleUrl: './adaptable.scss',
})
export class AdaptableComponent {
  readonly modos = MODOS_COBRO;
  readonly franjas = FRANJAS;
  readonly paredes = PAREDES;

  readonly cobro = signal<ModoCobro>(MODOS_COBRO[1]);
  readonly franja = signal<Franja>(FRANJAS[2]);
  readonly pared = signal<Pared>(PAREDES[0]);
  readonly techada = signal(false);

  elegirCobro(m: ModoCobro): void {
    this.cobro.set(m);
  }
  elegirFranja(f: Franja): void {
    this.franja.set(f);
  }
  elegirPared(p: Pared): void {
    this.pared.set(p);
  }
  alternarTecho(): void {
    this.techada.update((v) => !v);
  }

  /** El precio de la franja elegida, calculado desde el base. Nunca un literal. */
  readonly precio = computed(() =>
    PESOS.format(Math.round(PRECIO_BASE * (1 + this.franja().pct / 100))),
  );

  /** El base, para mostrarlo al lado y que se entienda de dónde sale el número. */
  readonly precioBase = PESOS.format(PRECIO_BASE);

  /** El porcentaje con su signo, como lo escribiría el panel. */
  readonly pctFranja = computed(() => {
    const p = this.franja().pct;
    return p === 0 ? 'sin recargo' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`;
  });
}
