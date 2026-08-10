/**
 * Costura para la tipografía por plantilla del **Plan 2**. Escrita en el Plan 1 y deliberadamente
 * dejada sin llamar: no cambiaba nada mientras ninguna hoja del repo referenciara las familias que
 * el registry le asigna a B y a C — las tres plantillas vivían de `--display`/`--body`/`--mono`, que
 * `styles.scss` declara con el trío de plataforma. Inyectar por cáscara entonces sólo agregaba una
 * hoja render-blocking cuyos `@font-face` no matcheaban nada, 1.7 kB al bundle inicial, y en las
 * rutas client-render (el panel) un pedido de fuentes que ya no arrancaba en el parseo del HTML sino
 * recién después de bajar y ejecutar el bundle.
 *
 * **Desde el Plan 2 sí la llama alguien**: la cáscara de B (`shells/b-nocturna/shell.ts`) declara su
 * propio par tipográfico (Anton / Inter Tight / JetBrains Mono) en `:host` y pide su hoja desde el
 * constructor — `cargarFuentes(inject(DOCUMENT), urlFuentes(PLANTILLAS.B.fuentes))`. Las cáscaras
 * que declaren sus fuentes hacen lo mismo.
 *
 * Mientras `styles.scss` siga declarando el trío de plataforma globalmente (lo necesitan el panel y
 * marketing), la landing de un tenant en B pide DOS hojas: la de plataforma que carga `index.html`
 * y la de B. Eso se cierra recién cuando las cinco cáscaras tengan la suya.
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
