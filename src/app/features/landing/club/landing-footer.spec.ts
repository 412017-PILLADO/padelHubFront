import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DIR_SHELL } from '../../../core/landing/plantillas';
import { BookingService, PublicConfig } from '../../../core/api/booking.service';
import { ClubStore } from '../club.store';
import { LandingFooterComponent } from './landing-footer';

/** Doble del servicio: el pie no debe pegarle a la red para pintarse. */
const bookingFalso = {
  config: () => of(null as never),
  disponibilidad: () => of([]),
};

const CONFIG_CON_POLITICA = {
  tenant: { nombre: 'Club', plantilla: 'A' },
  complejo: { id: 1, nombre: 'Costa Pádel' },
  politicaCancelacion: 'Cancelás hasta 12 horas antes sin costo.',
  canchas: [],
} as unknown as PublicConfig;

/**
 * El cambio de comportamiento del refactor que unificó los tres pies: los links ya no llaman a un
 * método de `Landing`, sino que emiten outputs que la landing cablea a los modales. El e2e
 * `arrepentimiento.spec.ts` cubre el de arrepentimiento de punta a punta; el de la política no lo
 * clickea nadie, así que la regresión de los dos se cubre acá.
 */
describe('LandingFooterComponent · links del pie', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [LandingFooterComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: BookingService, useValue: bookingFalso },
        // En la app lo provee `Landing`; acá el componente lo toma de este injector.
        ClubStore,
      ],
    });

    const fixture = TestBed.createComponent(LandingFooterComponent);
    TestBed.inject(ClubStore).config.set(CONFIG_CON_POLITICA);
    fixture.detectChanges();
    return fixture;
  }

  it('emite abrirArrepentimiento cuando se clickea el link', () => {
    const fixture = montar();
    const emisiones: void[] = [];
    fixture.componentInstance.abrirArrepentimiento.subscribe((v) => emisiones.push(v));

    fixture.nativeElement.querySelector('.arrep-link').click();
    expect(emisiones.length).toBe(1);
  });

  it('emite abrirPolitica cuando se clickea el link', () => {
    const fixture = montar();
    const emisiones: void[] = [];
    fixture.componentInstance.abrirPolitica.subscribe((v) => emisiones.push(v));

    fixture.nativeElement.querySelector('.politica-link').click();
    expect(emisiones.length).toBe(1);
  });

  it('no muestra el link de política si el club no cargó una', () => {
    const fixture = montar();
    TestBed.inject(ClubStore).config.set({
      ...CONFIG_CON_POLITICA,
      politicaCancelacion: null,
    } as PublicConfig);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.politica-link')).toBeNull();
    // El de arrepentimiento es exigencia legal (Res. 424/2020): está siempre.
    expect(fixture.nativeElement.querySelector('.arrep-link')).not.toBeNull();
  });

  it('muestra el © con el nombre del club', () => {
    const fixture = montar();
    expect(fixture.nativeElement.querySelector('.foot-copy').textContent).toContain('Costa Pádel');
  });

  /**
   * Las tres copias del pie eran idénticas SALVO dos clases que solo usa la plantilla A: `cr` en el
   * © y `panel-link` en el link al panel (`.pb-foot .cr` / `.pb-foot .panel-link` les dan su color,
   * y en desktop el `order` que pone el © debajo de los links). El pie unificado las lleva siempre:
   * en las demás cáscaras no casa ninguna regla, pero si se caen, el afiche cambia de aspecto en
   * silencio — no
   * hay e2e que lo note, porque es puramente cosmético.
   */
  it('el © lleva la clase `cr` que la plantilla A necesita para pintarlo', () => {
    const fixture = montar();
    expect(fixture.nativeElement.querySelector('.foot-copy.cr')).not.toBeNull();
  });

  /** El host reemplazó al <footer> de cada plantilla, que sí tenía rol implícito: sin este atributo
   *  la página se queda sin landmark de pie. */
  it('el host expone el landmark de pie', () => {
    const fixture = montar();
    expect(fixture.nativeElement.getAttribute('role')).toBe('contentinfo');
  });

  it('el link al panel lleva `panel-link` y apunta a /admin', () => {
    const fixture = montar();
    const panel = fixture.nativeElement.querySelector('a.panel-link');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('href')).toBe('/admin');
  });
});

/**
 * LA OPACIDAD DEL PIE, PINEADA POR CÁSCARA.
 *
 * Los dos `<button>` del pie arrastraban un `opacity: 0.85` de sus reglas base —`.arrep-link` desde
 * `landing-footer.scss` y `.politica-link` desde `landing.scss`, porque el MISMO link también vive
 * adentro de `<app-booking-flow>`—, y esa opacidad es lo único que dejaba a los dos botones de la C
 * en **4,13:1** sobre su papel, abajo del 4,5:1 de texto chico. En la A es peor todavía: se
 * multiplica con el `color-mix(… 90%)` del bloque de al lado y deja un alfa de 0,765 que no eligió
 * nadie. Los dos bloques lo apagan con `opacity: 1`.
 *
 * ESTE TEST EXISTE PORQUE EL ARREGLO ES UNA REGLA QUE PISA A OTRA. Si alguien toca el bloque base
 * —o simplemente copia el bloque de una cáscara para estrenar otra— la opacidad vuelve sin que se
 * caiga nada más: no hay e2e que mida contraste y el pie se sigue viendo "bien". Es exactamente la
 * forma en que E estrenó con los dos botones en negro puro durante una fase entera.
 *
 * Se lee LA HOJA y no el DOM del fixture a propósito: el runner corre en jsdom, que no aplica la
 * cascada de las hojas de componente, así que un `getComputedStyle` acá saldría verde siempre — un
 * tripwire que no puede fallar es peor que no tenerlo. Misma técnica que
 * `shells/e-diurna/contraste.spec.ts`, que ya pinea la de E.
 */
describe('LandingFooterComponent · la opacidad de los dos botones del pie', () => {
  /**
   * La ruta va desde la raíz del proyecto y NO relativa a este spec: el builder bundlea los specs a
   * un temporal, así que `import.meta.url` apunta al bundle. Si el runner cambiara de cwd esto TIRA
   * (ENOENT) en vez de quedarse verde en silencio.
   *
   * Los comentarios de bloque se borran porque la prosa de estas dos hojas cita literalmente
   * `opacity: 0.85` y `opacity: 1` al explicar el problema, y un docblock no puede poder cambiar lo
   * que el test mide.
   */
  const leerHoja = (ruta: string) =>
    readFileSync(resolve(process.cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  const HOJA_PIE = leerHoja('src/app/features/landing/club/landing-footer.scss');
  const HOJA_LANDING = leerHoja('src/app/features/landing/landing.scss');

  /**
   * La `opacity` con la que un selector TERMINA en la hoja: la ÚLTIMA que se declara, o `null` si
   * ninguna de sus reglas la declara.
   *
   * **La última y no la primera, y eso no es un detalle de parser.** En CSS, entre reglas de la
   * MISMA especificidad gana la que está más abajo. Una versión anterior de esta función hacía
   * `selector.exec(hoja)?.[1]` —la PRIMERA coincidencia—, así que este pin se podía vencer sin tocar
   * una sola línea existente: alcanzaba con agregar al final de `landing-footer.scss`
   *
   *     :host(.c-foot) .arrep-link { opacity: 0.85; }
   *
   * —literalmente el defecto de 4,13:1 que este pin existe para matar— y la suite entera se quedaba
   * en verde. Lo probó la review de rama, no es un supuesto.
   *
   * Se recorren TODOS los bloques que casan y TODAS las `opacity` de cada uno, en orden de
   * aparición, y se devuelve la última: es la que pinta. Mismo criterio que la `declaracion()` de
   * `src/styles.spec.ts`, que ya se defendía de este mismísimo patrón —con un test dedicado— y era
   * la única de las tres puertas de esta tanda que lo hacía.
   *
   * El `g` se agrega acá y no se le pide a quien llama: un `RegExp` global arrastra `lastIndex`
   * entre usos, y estas expresiones se reusan para las cuatro cáscaras.
   */
  function opacidadDe(hoja: string, selector: RegExp, comoSeLlama: string): number | null {
    const global = new RegExp(selector.source, selector.flags.replace('g', '') + 'g');
    const bloques = [...hoja.matchAll(global)].map((m) => m[1]);
    if (!bloques.length) throw new Error(`ya no existe la regla \`${comoSeLlama}\``);
    const valores = bloques.flatMap((bloque) =>
      [...bloque.matchAll(/(?:^|;)\s*opacity\s*:\s*([\d.]+)/g)].map((m) => m[1]));
    return valores.length ? Number(valores[valores.length - 1]) : null;
  }

  /** La opacidad con la que TERMINA un botón en una cáscara: la de su bloque si la declara, y si no
   *  la que le llega de la regla base. Escrito así —y no como "el bloque declara 1"— para que el
   *  test siga siendo correcto si alguna vez el arreglo es sacar la opacidad de la regla base. */
  const efectiva = (propia: number | null, base: number | null) => propia ?? base ?? 1;

  const BASE_ARREP = opacidadDe(HOJA_PIE, /(?:^|\n)\.arrep-link\s*\{([^}]*)\}/, '.arrep-link');
  const BASE_POLITICA = opacidadDe(
    HOJA_LANDING, /:host\s+::ng-deep\s+\.politica-link\s*\{([^}]*)\}/, ':host ::ng-deep .politica-link');

  const enCascara = (cascara: string, boton: string) =>
    efectiva(
      opacidadDe(HOJA_PIE, new RegExp(`:host\\(\\.${cascara}\\)\\s+\\.${boton}\\s*\\{([^}]*)\\}`),
        `:host(.${cascara}) .${boton}`),
      boton === 'arrep-link' ? BASE_ARREP : BASE_POLITICA,
    );

  /**
   * TODA cáscara, derivada de `DIR_SHELL`, y no una lista escrita a mano: mientras fuera una lista,
   * el que viniera después iba a preguntarse por qué tal cáscara estaba exenta, y una cáscara nueva
   * entraba sin que nadie le exigiera nada. El invariante es "ninguna cáscara deja esos dos botones
   * abajo de alfa 1", y así redactado también obliga a la que venga.
   *
   * Los números que lo motivaron: la C daba 4,13:1 con el 0,85 puesto y 5,73:1 apagado; la A lo
   * multiplicaba con su `color-mix(… 90%)` y terminaba en un alfa efectivo de 0,765; la B tenía su
   * celda de 1280 al filo de AA con un club casi blanco. La E nació con la opacidad apagada — fue
   * la primera en pagarlo.
   */
  /** La clase que la cáscara le pone al `<app-landing-footer>` en su `shell.html`. Copia deliberada
   *  de la de `pie-por-cascara.spec.ts` y no un import: importar de un `.spec.ts` vuelve a REGISTRAR
   *  sus tests, y esa suite pasaba a correr dos veces. Lo que importaba deduplicar era la lista de
   *  cáscaras —que sale de `DIR_SHELL`—, no estas seis líneas. */
  const claseDelPie = (dir: string) => {
    const html = readFileSync(
      resolve(process.cwd(), `src/app/features/landing/shells/${dir}/shell.html`), 'utf8');
    const m = /<app-landing-footer[^>]*\sclass="([^"]*)"/.exec(html);
    if (!m) throw new Error(`${dir}/shell.html no monta <app-landing-footer> con class`);
    return m[1].trim().split(/\s+/)[0];
  };

  for (const [codigo, dir] of Object.entries(DIR_SHELL)) {
    for (const boton of ['arrep-link', 'politica-link']) {
      it(`la plantilla ${codigo} no deja a su .${boton} del pie abajo de alfa 1`, () => {
        expect(enCascara(claseDelPie(dir), boton)).toBe(1);
      });
    }
  }
});
