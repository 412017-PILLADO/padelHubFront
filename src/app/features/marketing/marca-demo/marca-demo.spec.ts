import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { inkOnAccent } from '../../../core/branding/tenant-colors';
import { CODIGOS_CON_SHELL } from '../../../core/landing/plantillas';
import { MarcaDemoComponent } from './marca-demo';

/**
 * La sección "Tu marca" de la landing de marketing (spec §8). Su razón de ser es que hasta hoy el
 * producto AFIRMABA ser personalizable —una card que dice "Tu marca, tu página"— y no lo mostraba:
 * `grep -rniE "plantilla|diseñ"` sobre `features/marketing/` daba CERO resultados, así que un dueño
 * de club no se enteraba de que existen cuatro diseños.
 *
 * Lo que estos tests cuidan es justamente la diferencia entre afirmar y demostrar: que las
 * miniaturas salgan del registry, que el color del swatch las repinte de verdad, y —la restricción
 * de la spec que es fácil de romper sin querer— que ese color se escriba en el CONTENEDOR DE LA
 * SECCIÓN y no en el `<html>`, o el resto de marketing se teñiría con el color de un club inventado.
 */
function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [MarcaDemoComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(MarcaDemoComponent);
  fixture.detectChanges();
  return fixture;
}

const HTML_MARKETING = readFileSync(
  resolve(process.cwd(), 'src/app/features/marketing/marketing.html'),
  'utf8',
);

describe('marca-demo · la sección que DEMUESTRA la personalización', () => {
  it('muestra una miniatura por cáscara existente, derivada del registry', () => {
    const host = montar().nativeElement as HTMLElement;
    const thumbs = [...host.querySelectorAll('plantilla-thumb')];
    expect(thumbs.map((t) => t.getAttribute('data-tpl'))).toEqual([...CODIGOS_CON_SHELL]);
  });

  it('no usa ni una imagen: nada que se desactualice solo', () => {
    // La spec §8 lo pide explícito. Una captura de cada plantilla envejece en silencio: la
    // plantilla cambia, la imagen no, y marketing queda mintiendo sin que nadie se entere.
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelectorAll('img, picture, iframe')).toHaveLength(0);
  });

  it('el color se escribe en el CONTENEDOR de la sección, nunca en el <html>', () => {
    // La restricción de la spec §8. Si esto se escribiera en `document.documentElement`, un
    // visitante que toca un swatch teñiría la nav, los botones y el pie de Padel-HUB con el color
    // de un club que no existe — y encima quedaría pegado al navegar.
    const fixture = montar();
    const antes = document.documentElement.style.getPropertyValue('--court');

    const swatches = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    swatches[2].click();
    fixture.detectChanges();

    expect(document.documentElement.style.getPropertyValue('--court')).toBe(antes);
    const zona = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.marca-zona')!;
    expect(zona.style.getPropertyValue('--court')).toBeTruthy();
  });

  it('tocar un swatch repinta: cambia el color de la zona', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    const zona = host.querySelector<HTMLElement>('.marca-zona')!;
    const primero = zona.style.getPropertyValue('--court');

    host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[3].click();
    fixture.detectChanges();

    expect(zona.style.getPropertyValue('--court')).not.toBe(primero);
  });

  it('la tinta legible sale de inkOnAccent, la misma función del branding real', () => {
    const fixture = montar();
    const host = fixture.nativeElement as HTMLElement;
    const zona = host.querySelector<HTMLElement>('.marca-zona')!;

    for (const i of [0, 1, 2, 3]) {
      host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[i].click();
      fixture.detectChanges();
      const court = zona.style.getPropertyValue('--court').trim();
      expect(zona.style.getPropertyValue('--ink-on-accent').trim()).toBe(inkOnAccent(court));
    }
  });

  it('los swatches son radios de un solo grupo y tienen nombre accesible', () => {
    // Mismo criterio que la galería del panel: una fila de <div> con (click) deja afuera al teclado
    // y al lector de pantalla, y acá encima es la sección que le muestra el producto a un visitante.
    const host = montar().nativeElement as HTMLElement;
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.length).toBeGreaterThanOrEqual(4);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    for (const r of radios) {
      expect(r.getAttribute('aria-label') || r.labels?.[0]?.textContent?.trim()).toBeTruthy();
    }
  });

  it('el carrusel se recorre con el pulgar: scroll-snap, no una grilla fija', () => {
    // La spec §8 pide scroll-snap explícitamente, y el motivo es el mismo de siempre en este
    // producto: se usa mayormente en el teléfono. Se lee de la hoja porque jsdom no aplica la
    // cascada de hojas de componente y un getComputedStyle saldría verde siempre.
    const hoja = readFileSync(
      resolve(process.cwd(), 'src/app/features/marketing/marca-demo/marca-demo.scss'),
      'utf8',
    );
    expect(hoja).toMatch(/scroll-snap-type:\s*x/);
    expect(hoja).toMatch(/scroll-snap-align/);
  });
});

describe('la sección Tu marca dentro de la landing de marketing', () => {
  it('va ENTRE #producto y #como-funciona (spec §8)', () => {
    // El orden es la mitad del argumento de la spec: qué es → cómo se ve con tu marca → cómo
    // arrancás → contacto. Mostrar la personalización DESPUÉS de explicar cómo se contrata la
    // convierte en un detalle, y la sección existe justamente para que no lo sea.
    const producto = HTML_MARKETING.indexOf('id="producto"');
    const marca = HTML_MARKETING.indexOf('<app-marca-demo');
    const como = HTML_MARKETING.indexOf('id="como-funciona"');

    expect(producto, 'no encontré #producto').toBeGreaterThan(-1);
    expect(marca, 'no encontré <app-marca-demo>').toBeGreaterThan(-1);
    expect(marca).toBeGreaterThan(producto);
    expect(marca).toBeLessThan(como);
  });

  it('la landing de marketing ya NO deja el tema de las plantillas sin nombrar', () => {
    // Lo que motivó toda la sección: `grep -rniE "plantilla|diseñ"` sobre features/marketing/ daba
    // cero resultados. El producto tiene cuatro diseños y no se lo decía a nadie.
    expect(HTML_MARKETING).toMatch(/plantilla|diseñ/i);
  });
});
