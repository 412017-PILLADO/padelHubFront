/**
 * Costura para la tipografía por plantilla del **Plan 2**. Hoy NO la llama nadie, y es a propósito:
 * no quedó muerta por olvido.
 *
 * Esta task iba a sacar el `<link>` de fuentes de `index.html` y hacer que cada cáscara pidiera la
 * suya. Se descartó porque todavía no cambia nada: ninguna hoja del repo referencia las familias
 * que el registry le asigna a B y a C — las tres plantillas siguen viviendo de
 * `--display`/`--body`/`--mono`, que `styles.scss` declara con el trío de plataforma. Inyectar por
 * cáscara hoy sólo agregaba una hoja render-blocking cuyos `@font-face` no matchean nada, 1.7 kB al
 * bundle inicial, y en las rutas client-render (el panel) un pedido de fuentes que ya no arrancaba
 * en el parseo del HTML sino recién después de bajar y ejecutar el bundle.
 *
 * Cuando cada shell del Plan 2 declare sus propios tokens de fuente, esto se enchufa en su
 * constructor: `cargarFuentes(inject(DOCUMENT), urlFuentes(PLANTILLAS.B.fuentes))`.
 *
 * Qué hace: agrega el `<link>` al `<head>`. Corre también en SSR (el DOCUMENT inyectado se
 * serializa), así el HTML que sale del server ya pide la tipografía correcta y la plantilla no
 * parpadea con la fuente del sistema hasta que hidrata. Idempotente por URL — el link que puso el
 * server ya está en el head parseado por el cliente, así que al hidratar no se duplica.
 *
 * Recibe el `Document` por parámetro (nunca el global): en el server el global no existe, y quien
 * llama tiene que haberlo tomado del injector con `inject(DOCUMENT)`.
 */
export function cargarFuentes(doc: Document, url: string): void {
  if (!url || doc.head.querySelector(`link[href="${url}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  doc.head.appendChild(link);
}
