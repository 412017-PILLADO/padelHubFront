/**
 * Agrega el <link> de fuentes al <head>. Corre también en SSR (el DOCUMENT inyectado se serializa),
 * así que el HTML que sale del server ya pide la tipografía correcta: sin esto, la plantilla
 * parpadea con la fuente del sistema hasta que hidrata. Idempotente por URL — el link que puso el
 * server ya está en el head parseado por el cliente, así que al hidratar no se duplica.
 *
 * Recibe el `Document` por parámetro (nunca el global): en el server el global no existe, y quien
 * llama tiene que haberlo tomado del injector con `inject(DOCUMENT)`.
 */
export function cargarFuentes(doc: Document, url: string): void {
  if (doc.head.querySelector(`link[href="${url}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  doc.head.appendChild(link);
}
