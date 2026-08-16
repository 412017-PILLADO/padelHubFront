import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdaptableComponent, MODOS_COBRO, PAREDES } from './adaptable';

/**
 * La sección "Nos adaptamos" (pedido del owner, 2026-08-16). La landing vendía "reservas online" y
 * "agenda por cancha" y no decía **nada** de lo que el producto realmente resuelve: que cada club
 * cobra distinto —sin seña, con seña por transferencia, con seña por Mercado Pago—, que los precios
 * cambian por cancha y por franja horaria, y que las canchas tienen material y techo.
 *
 * Lo que estos tests cuidan es que la sección no se despegue del producto: las tres formas de cobro
 * y los tres materiales de pared son cosas que EXISTEN en la configuración, y si alguna se agrega o
 * se saca, acá tiene que doler.
 */
function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AdaptableComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(AdaptableComponent);
  fixture.detectChanges();
  return fixture;
}

const HTML_MARKETING = readFileSync(
  resolve(process.cwd(), 'src/app/features/marketing/marketing.html'),
  'utf8',
);

describe('adaptable · la sección que cuenta lo que el producto configura', () => {
  it('muestra las TRES formas de cobro, no una', () => {
    // El agujero más caro de la landing vieja: un club que quiere cobrar seña no se enteraba de que
    // el producto la cobra, ni por transferencia ni por Mercado Pago.
    const host = montar().nativeElement as HTMLElement;
    const modos = [...host.querySelectorAll('.cobro-card')];
    expect(modos).toHaveLength(MODOS_COBRO.length);
    expect(MODOS_COBRO.length).toBe(3);

    const texto = host.textContent ?? '';
    expect(texto).toMatch(/sin seña/i);
    expect(texto).toMatch(/transferencia/i);
    expect(texto).toMatch(/mercado pago/i);
  });

  it('dice que la seña deja la reserva PENDIENTE hasta confirmar', () => {
    // Es la parte que un dueño necesita entender antes de contratar, y es literal en el panel:
    // "Si pedís seña, la reserva del cliente queda pendiente hasta que confirmás".
    const host = montar().nativeElement as HTMLElement;
    expect(host.textContent ?? '').toMatch(/pendiente/i);
  });

  it('cuenta el precio por cancha y por franja horaria', () => {
    const texto = (montar().nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toMatch(/por cancha/i);
    expect(texto).toMatch(/franja/i);
  });

  it('dibuja una cancha por tipo de pared, con la ilustración real', () => {
    // Los tres tipos son los que ofrece la config de canchas (CRISTAL · MURO · MIXTA). Si aparece un
    // cuarto material en el producto y nadie lo suma acá, la landing queda contando de menos.
    const host = montar().nativeElement as HTMLElement;
    const canchas = [...host.querySelectorAll('.cancha-fig')];
    expect(canchas).toHaveLength(PAREDES.length);
    expect(PAREDES.map((p) => p.clase)).toEqual(['mat-glass', 'mat-concrete', 'mat-mixed']);
    // La ilustración es la misma cancha vista de arriba del flujo de reserva, por `<use>`.
    expect(host.querySelectorAll('svg use')).toHaveLength(PAREDES.length);
  });

  it('distingue techada de descubierta, que es un dato de la config', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelector('.cancha-fig .glow')).not.toBeNull();
    expect(host.querySelector('.cancha-fig .sky')).not.toBeNull();
  });

  it('no usa ni una imagen: todo es SVG y tokens', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelectorAll('img, picture')).toHaveLength(0);
  });
});

describe('la sección Nos adaptamos dentro de la landing', () => {
  it('va después de #producto y antes de #tu-marca', () => {
    // El orden del argumento: qué es → hasta dónde se adapta → cómo se ve con tu marca → cómo
    // arrancás → contacto. Lo que el producto HACE va antes de cómo se ve.
    const producto = HTML_MARKETING.indexOf('id="producto"');
    const adaptable = HTML_MARKETING.indexOf('<app-adaptable');
    const marca = HTML_MARKETING.indexOf('id="tu-marca"');

    expect(adaptable, 'no encontré <app-adaptable>').toBeGreaterThan(-1);
    expect(adaptable).toBeGreaterThan(producto);
    expect(adaptable).toBeLessThan(marca);
  });
});
