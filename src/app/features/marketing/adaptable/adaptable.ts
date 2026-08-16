import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Una forma de cobrar la reserva, de las tres que el panel configura (pestaña "Cobros"). */
export interface ModoCobro {
  readonly clave: 'sin-sena' | 'transferencia' | 'mercadopago';
  readonly titulo: string;
  readonly desc: string;
  /** En qué estado nace la reserva con este modo. Es LA pregunta que un dueño hace primero. */
  readonly estado: string;
}

/** Un tipo de pared, de los tres que el panel ofrece por cancha. */
export interface Pared {
  readonly clase: 'mat-glass' | 'mat-concrete' | 'mat-mixed';
  readonly nombre: string;
  /** Si esta figura se dibuja techada (luz de reflector) o descubierta (cielo). */
  readonly techada: boolean;
}

/**
 * Las tres formas de cobro. Salen de lo que la pestaña "Cobros" configura de verdad: el switch de
 * seña, el alias/CBU para transferir, y la conexión de Mercado Pago. La redacción del estado es la
 * del propio panel — *"si pedís seña, la reserva del cliente queda pendiente hasta que confirmás"*—
 * porque es exactamente lo que el dueño necesita entender antes de contratar.
 */
export const MODOS_COBRO: readonly ModoCobro[] = [
  {
    clave: 'sin-sena',
    titulo: 'Sin seña',
    desc: 'El jugador reserva y arregla el pago en el club, como siempre.',
    estado: 'La reserva queda confirmada al instante.',
  },
  {
    clave: 'transferencia',
    titulo: 'Seña por transferencia',
    desc: 'Le mostramos tu alias o CBU en la pantalla de éxito, con un botón para copiarlo.',
    estado: 'La reserva queda pendiente hasta que confirmás que llegó.',
  },
  {
    clave: 'mercadopago',
    titulo: 'Seña por Mercado Pago',
    desc: 'Conectás la cuenta del club y la seña se cobra online, sin que toques nada.',
    estado: 'La reserva se confirma sola cuando el pago entra.',
  },
];

/** Los tres materiales de pared que la config de canchas ofrece. */
export const PAREDES: readonly Pared[] = [
  { clase: 'mat-glass', nombre: 'Cristal', techada: false },
  { clase: 'mat-concrete', nombre: 'Muro', techada: true },
  { clase: 'mat-mixed', nombre: 'Mixta', techada: false },
];

/**
 * "Nos adaptamos a tu club" — la sección que cuenta lo que el producto CONFIGURA.
 *
 * Nace de una observación del owner que es cierta y medible: la landing vendía "reservas online" y
 * "agenda por cancha" y no decía **nada** de lo que el producto realmente resuelve. Un club que
 * cobra seña —o sea, la mayoría— no se enteraba de que el producto la cobra, ni por transferencia ni
 * por Mercado Pago. Tampoco de que los precios cambian por cancha y por franja horaria, ni de que
 * las canchas tienen material y techo.
 *
 * Las tres formas de cobro y los tres materiales viven en constantes exportadas, y sus tests las
 * cuentan: si el producto gana una cuarta forma de cobrar y nadie la suma acá, la landing queda
 * contando de menos — que es el modo de falla que esta sección existe para cerrar.
 *
 * La cancha es la MISMA ilustración del paso "Elegí cancha" del flujo de reserva (cuatro líneas:
 * las dos de saque, la central y la red). Se redeclara acá como `court-mk` porque el símbolo del
 * flujo vive en `landing.html`, que es otra ruta y nunca coexiste con marketing.
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
  readonly paredes = PAREDES;
}
