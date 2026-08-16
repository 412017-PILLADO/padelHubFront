import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdaptableComponent, FRANJAS, MODOS_COBRO, PAREDES, PRECIO_BASE } from './adaptable';

/**
 * La sección "Nos adaptamos". Nace de una observación del owner que era medible: la landing vendía
 * "reservas online" y no decía **nada** de lo que el producto resuelve — un club que cobra seña no
 * se enteraba de que el producto la cobra.
 *
 * Y se rehízo por una segunda observación suya, también correcta: la primera versión eran tres
 * bloques con tres lenguajes visuales distintos (tarjetas, filas, figuras), pegados como tres
 * mini-secciones. Ahora los tres comparten UNA sola forma —**una fila de opciones y un resultado que
 * cambia**—, que además es la misma lógica de la sección "Tu marca" que va justo abajo: tocá y mirá.
 *
 * Lo que estos tests cuidan es que la sección no se despegue del producto (las opciones son cosas
 * que EXISTEN en la configuración) y que la promesa de la forma se cumpla: **elegir tiene que
 * cambiar el resultado**, en los tres bloques. Un selector que no mueve nada es peor que una lista.
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

/** Los radios de un bloque, por su `name`. */
function opciones(host: HTMLElement, grupo: string): HTMLInputElement[] {
  return [...host.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${grupo}"]`)];
}

/**
 * Clickea una opción DISTINTA de la que está elegida. Los tests de "elegir cambia el resultado" no
 * pueden clickear un índice fijo: si ese índice resulta ser el default, el resultado no cambia y el
 * test falla por una razón que no es la que está probando. Pasó con los dos.
 */
function elegirOtra(host: HTMLElement, grupo: string): void {
  const otra = opciones(host, grupo).find((r) => !r.checked);
  if (!otra) throw new Error(`el grupo ${grupo} no tiene una segunda opción`);
  otra.click();
}

const HTML_MARKETING = readFileSync(
  resolve(process.cwd(), 'src/app/features/marketing/marketing.html'),
  'utf8',
);

describe('adaptable · los tres bloques hablan el mismo idioma', () => {
  it('los tres son "opciones + resultado", con la misma forma', () => {
    // Es la corrección del owner hecha aserción: antes eran tarjetas, filas y figuras — tres
    // idiomas visuales en una sección. Si alguien vuelve a agregar un bloque suelto, esto duele.
    const host = montar().nativeElement as HTMLElement;
    const demos = [...host.querySelectorAll('.demo')];
    expect(demos).toHaveLength(3);
    for (const d of demos) {
      expect(d.querySelector('.opciones'), 'un bloque sin opciones').not.toBeNull();
      expect(d.querySelector('.resultado'), 'un bloque sin resultado').not.toBeNull();
    }
  });

  it('cada grupo de opciones es un radiogroup con nombre accesible', () => {
    const host = montar().nativeElement as HTMLElement;
    const grupos = [...host.querySelectorAll('.opciones')];
    expect(grupos).toHaveLength(3);
    for (const g of grupos) {
      expect(g.getAttribute('role')).toBe('radiogroup');
      expect(g.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('no usa ni una imagen: todo es SVG y tokens', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelectorAll('img, picture')).toHaveLength(0);
  });
});

describe('adaptable · cómo cobrás', () => {
  it('ofrece las TRES formas que el panel configura', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(opciones(host, 'cobro')).toHaveLength(3);
    expect(MODOS_COBRO.length).toBe(3);
    const texto = host.textContent ?? '';
    expect(texto).toMatch(/sin seña/i);
    expect(texto).toMatch(/transferencia/i);
    expect(texto).toMatch(/mercado pago/i);
  });

  it('elegir una forma CAMBIA el estado del turno', () => {
    // La promesa de toda la sección. Sin esto es una lista con adornos.
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    const estado = () => host.querySelector('.res-estado')!.textContent!.trim();

    const primero = estado();
    elegirOtra(host, 'cobro');
    fixture.detectChanges();
    expect(estado()).not.toBe(primero);
  });

  it('la seña por transferencia deja la reserva PENDIENTE', () => {
    // Es lo que un dueño necesita entender antes de contratar, y es literal en el panel.
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    opciones(host, 'cobro')[1].click();
    fixture.detectChanges();
    expect(host.querySelector('.res-estado')!.textContent).toMatch(/pendiente/i);
  });

  it('dice lo que ve el jugador, no sólo lo que pasa por detrás', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    opciones(host, 'cobro')[1].click();
    fixture.detectChanges();
    // Con transferencia, lo que el jugador ve es el alias para copiar.
    expect(host.querySelector('.res-jugador')!.textContent).toMatch(/alias|cbu/i);
  });
});

describe('adaptable · cuánto cobrás', () => {
  it('ofrece las franjas y cambia el precio al elegir', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    expect(opciones(host, 'franja')).toHaveLength(FRANJAS.length);

    const precio = () => host.querySelector('.res-precio')!.textContent!.trim();
    const primero = precio();
    elegirOtra(host, 'franja');
    fixture.detectChanges();
    expect(precio()).not.toBe(primero);
  });

  it('el precio SALE DE APLICAR el porcentaje al base, no está escrito a mano', () => {
    // Si los tres precios fueran literales, una franja podría decir +20% y mostrar un número que no
    // es el +20% — la landing mintiendo con total impunidad.
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;

    for (const [i, f] of FRANJAS.entries()) {
      opciones(host, 'franja')[i].click();
      fixture.detectChanges();
      const esperado = Math.round(PRECIO_BASE * (1 + f.pct / 100));
      const mostrado = Number(host.querySelector('.res-precio')!.textContent!.replace(/\D/g, ''));
      expect(mostrado, `la franja ${f.hora} no muestra el precio con su ${f.pct}%`).toBe(esperado);
    }
  });

  it('nombra el precio por cancha, que es la otra mitad de la configuración', () => {
    expect((montar().nativeElement as HTMLElement).textContent ?? '').toMatch(/por cancha/i);
  });
});

describe('adaptable · tus canchas', () => {
  it('ofrece los tres materiales de pared del panel', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(opciones(host, 'pared')).toHaveLength(PAREDES.length);
    expect(PAREDES.map((p) => p.clase)).toEqual(['mat-glass', 'mat-concrete', 'mat-mixed']);
  });

  it('elegir un material REDIBUJA la cancha', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    const figura = () => host.querySelector('.cancha-fig')!.className;

    const primero = figura();
    opciones(host, 'pared')[1].click();
    fixture.detectChanges();
    expect(figura()).not.toBe(primero);
  });

  it('el techo se puede prender y apaga la luz de los reflectores', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    const techo = host.querySelector<HTMLInputElement>('input[type="checkbox"][name="techada"]')!;

    const conTecho = techo.checked;
    expect(host.querySelector(conTecho ? '.glow' : '.sky')).not.toBeNull();

    techo.click();
    fixture.detectChanges();
    expect(host.querySelector(conTecho ? '.sky' : '.glow')).not.toBeNull();
  });

  it('la ilustración es la cancha vista de arriba del flujo de reserva', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg use')).toHaveLength(1);
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
