import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CODIGOS_CON_SHELL, CodigoConShell, PLANTILLAS } from '../../core/landing/plantillas';
import { PlantillaThumbComponent } from './plantilla-thumb';

/**
 * La miniatura es lo único que el dueño del club va a mirar para elegir plantilla, así que lo que se
 * vigila acá es que NO INVENTE: que dibuje una por cada cáscara que existe de verdad, que la
 * colorimetría salga del `esquema` del registry (pineado a su vez contra la hoja real de cada
 * cáscara en `plantillas.spec.ts`) y que el color del club entre por token y no por una copia.
 *
 * La hoja se lee como TEXTO para las dos afirmaciones de capa, y es a propósito: jsdom no aplica la
 * cascada de hojas de componente, así que un `getComputedStyle` saldría verde siempre — un tripwire
 * que no puede fallar es peor que no tenerlo. Es el mismo patrón que los `contraste.spec.ts` de las
 * cáscaras.
 */
const HOJA = readFileSync(
  resolve(process.cwd(), 'src/app/shared/plantilla-thumb/plantilla-thumb.scss'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function montar(codigo: CodigoConShell) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PlantillaThumbComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(PlantillaThumbComponent);
  fixture.componentRef.setInput('codigo', codigo);
  fixture.detectChanges();
  return fixture;
}

describe('plantilla-thumb · la miniatura de una plantilla', () => {
  it('publica el código y el esquema del registry en el host', () => {
    for (const codigo of CODIGOS_CON_SHELL) {
      const host = montar(codigo).nativeElement as HTMLElement;
      expect(host.getAttribute('data-tpl')).toBe(codigo);
      expect(host.getAttribute('data-esquema')).toBe(PLANTILLAS[codigo].esquema);
    }
  });

  it('no usa NI UNA imagen ni un iframe: es HTML tokenizado', () => {
    // La spec §7 lo pide explícito, y §8 depende de eso: en marketing van las cuatro a la vez y se
    // repintan con cada swatch. Una imagen se desactualiza sola y un iframe por miniatura serían
    // cuatro landings cargando atrás de un panel de configuración.
    for (const codigo of CODIGOS_CON_SHELL) {
      const host = montar(codigo).nativeElement as HTMLElement;
      expect(host.querySelectorAll('img, iframe, picture, image')).toHaveLength(0);
    }
    expect(HOJA).not.toContain('url(');
  });

  it('cada plantilla dibuja una silueta DISTINTA', () => {
    // Cuatro miniaturas iguales no ayudan a elegir: serían cuatro rectángulos del color del club.
    const siluetas = CODIGOS_CON_SHELL.map(
      (codigo) => (montar(codigo).nativeElement as HTMLElement).querySelector('.thumb')!.className,
    );
    expect(new Set(siluetas).size).toBe(CODIGOS_CON_SHELL.length);
  });

  it('la hoja tiene un bloque de silueta por cáscara, sin sobras', () => {
    // Si una cáscara nueva entra al registry y nadie le escribe su bloque, su miniatura sale con el
    // esqueleto pelado y se ve rota. Al revés —un bloque de una cáscara que ya no existe— es la
    // quinta plantilla fantasma que este proyecto ya arrastró tres veces.
    const bloques = [...HOJA.matchAll(/^\.t-([a-e])\s*\{/gm)].map((m) => m[1].toUpperCase());
    expect(bloques.sort()).toEqual([...CODIGOS_CON_SHELL].sort());
  });

  it('el container va en el :host y NO en .thumb', () => {
    // Bug real, encontrado mirando la captura y no corriendo un test: un elemento NO puede
    // consultarse a sí mismo. Con `container-type` en `.thumb`, sus descendientes sí lo consultaban,
    // pero las `cqi` de sus PROPIAS propiedades —el padding de cada silueta— caían al container de
    // más arriba, que no existe, y resolvían contra el VIEWPORT: `padding: 8cqi` daba 102px de
    // padding adentro de una miniatura de 150px, y las piezas quedaban aplastadas a 10×2 px.
    //
    // Nada de esto rompía un test: la miniatura seguía existiendo, con su atributo, su esquema y su
    // silueta distinta. Por eso el pin es de la HOJA y por eso está escrito el porqué.
    const hostAbre = HOJA.indexOf(':host {');
    const thumbAbre = HOJA.indexOf('.thumb {');
    const posContainer = HOJA.indexOf('container-type');
    expect(posContainer, 'la hoja ya no declara container-type').toBeGreaterThan(-1);
    expect(posContainer).toBeGreaterThan(hostAbre);
    expect(posContainer).toBeLessThan(thumbAbre);
  });

  it('el color del club entra por token: la hoja lo USA y no lo DECLARA (capa 2, spec §5.1)', () => {
    // Si la hoja escribiera un hex, la miniatura mostraría el color de OTRO club. Y si DECLARARA
    // `--court`, sería una cáscara pisando la capa 3, que es la disciplina que este producto no rompe.
    expect(HOJA).toContain('var(--court)');
    expect(HOJA).toMatch(/--court-2|var\(--court-2/);
    expect(HOJA).not.toMatch(/^\s*--court[a-z0-9-]*\s*:/m);
  });
});
