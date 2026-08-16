import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PreviewPlantillaComponent } from './preview-plantilla';

/**
 * La otra mitad de la spec §7: la landing REAL adentro de un iframe, con la plantilla y el color que
 * el dueño está eligiendo ahora aunque no haya guardado. Las miniaturas contestan "cuál elijo"; esto
 * contesta "cómo queda de verdad".
 */
function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PreviewPlantillaComponent],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(PreviewPlantillaComponent);
  fixture.componentRef.setInput('plantilla', 'B');
  fixture.componentRef.setInput('color', '#ff2d95');
  fixture.detectChanges();
  return fixture;
}

describe('el preview vivo de la plantilla', () => {
  it('arranca en marco de TELÉFONO, no de escritorio', () => {
    // La spec §7 lo fija y el motivo está medido en la fase D: una plantilla puede leerse bien a
    // 1280 y NO leerse a 390. Si arrancara en escritorio, el dueño elegiría mirando el ancho que
    // sus jugadores casi no usan.
    const fixture = montar();
    expect(fixture.componentInstance.marco()).toBe('telefono');
    const marco = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.marco')!;
    expect(marco.classList.contains('marco--telefono')).toBe(true);
  });

  it('se puede pasar a escritorio', () => {
    const fixture = montar();
    fixture.componentInstance.setMarco('escritorio');
    fixture.detectChanges();
    const marco = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.marco')!;
    expect(marco.classList.contains('marco--escritorio')).toBe(true);
    expect(marco.classList.contains('marco--telefono')).toBe(false);
  });

  it('hay UN solo iframe, y lleva los params de la plantilla elegida', () => {
    // Uno solo: cuatro iframes serían cuatro landings enteras cargando atrás de un formulario de
    // configuración. Las otras tres se muestran con las miniaturas, que no cargan nada.
    const host = montar().nativeElement as HTMLElement;
    const iframes = host.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);

    const src = new URL(iframes[0].getAttribute('src')!);
    expect(src.searchParams.get('plantilla')).toBe('B');
    expect(src.searchParams.get('color')).toBe('#ff2d95');
    // Sin esto, adentro del iframe aparece el selector flotante de venta.
    expect(src.searchParams.get('panel')).toBe('1');
  });

  it('el iframe tiene título: es contenido, no decoración', () => {
    const host = montar().nativeElement as HTMLElement;
    expect(host.querySelector('iframe')!.getAttribute('title')).toBeTruthy();
  });

  it('cambiar de plantilla mueve el src', () => {
    const fixture = montar();
    fixture.componentRef.setInput('plantilla', 'E');
    fixture.detectChanges();
    const src = new URL(
      (fixture.nativeElement as HTMLElement).querySelector('iframe')!.getAttribute('src')!,
    );
    expect(src.searchParams.get('plantilla')).toBe('E');
  });
});
