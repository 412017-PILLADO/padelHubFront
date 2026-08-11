import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * El contrato `--flow-*` en prosa no lo hacía cumplir nada: `booking-flow.scss` y los `_tokens.scss`
 * decían "toda cáscara nueva tiene que declarar los catorce" y el numeral estaba mantenido a mano en
 * cuatro archivos. Peor: los fallbacks apuntan a los valores de la plantilla A, así que una cáscara
 * que se olvida un token se ve COMO LA A en ese aspecto en vez de romperse — el modo de falla que un
 * fallback está diseñado para esconder.
 *
 * Este spec convierte la frase en una puerta. Lee las hojas como texto (mismo patrón que
 * `plantillas.spec.ts` y `contraste.spec.ts`) en vez de duplicar la lista, así no puede
 * desincronizarse: la lista de tokens sale del propio flujo, no de una constante de acá.
 *
 * Las rutas van desde la raíz del proyecto y NO relativas a este spec: el builder bundlea los specs
 * a un temporal antes de correrlos, así que `import.meta.url` apuntaría al bundle y no al árbol de
 * fuentes. Si algún día el runner cambia de cwd, esto TIRA (ENOENT) en vez de quedarse verde.
 */
const leer = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

/** Saca comentarios de bloque y líneas `//`: el encabezado del contrato NOMBRA los tokens en prosa. */
const sinComentarios = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Los tokens que el flujo consume, leídos de su propia hoja: `var(--flow-x, fallback)`. */
function tokensQueElFlujoConsume(): string[] {
  const css = sinComentarios(leer('src/app/features/landing/booking/booking-flow.scss'));
  const encontrados = new Set<string>();
  for (const m of css.matchAll(/var\(\s*(--flow-[a-z0-9-]+)/g)) encontrados.add(m[1]);
  return [...encontrados].sort();
}

/**
 * El cuerpo de un `@mixin`, acotado por llaves balanceadas. Acotar importa: si se tomara "todo lo que
 * viene después del `@mixin`" se contarían también los tokens de mixins que la cáscara NO incluye, y
 * eso es un falso verde — justo lo que este spec existe para evitar.
 */
function cuerpoDelMixin(partial: string, nombre: string, donde: string): string {
  const abre = partial.search(new RegExp(`@mixin\\s+${nombre}\\s*[({]`));
  if (abre === -1) throw new Error(`No encontré el mixin ${nombre} en ${donde}`);
  const inicio = partial.indexOf('{', abre);
  if (inicio === -1) throw new Error(`El mixin ${nombre} de ${donde} no abre llave`);
  let nivel = 0;
  for (let i = inicio; i < partial.length; i++) {
    if (partial[i] === '{') nivel++;
    else if (partial[i] === '}' && --nivel === 0) return partial.slice(inicio + 1, i);
  }
  throw new Error(`El mixin ${nombre} de ${donde} no cierra llave`);
}

/**
 * Los tokens que una cáscara declara. Sigue los `@include <ns>.<mixin>(...)` hasta el partial que los
 * define: la B emite cinco de sus tokens desde `_vidrio.scss`, así que buscar sólo texto plano acá
 * daría un falso rojo.
 *
 * Si el partial `_<ns>.scss` no está en la carpeta de la cáscara, esto TIRA con nombre y archivo en
 * vez de saltear el `@include`: saltearlo dejaría tokens sin contar y el test mentiría en silencio.
 * El día que una cáscara incluya un mixin de afuera de su carpeta, hay que extender esta función.
 */
function tokensQueDeclara(dirShell: string): string[] {
  let css = sinComentarios(leer(`${dirShell}/_tokens.scss`));
  for (const inc of css.matchAll(/@include\s+([a-z0-9_-]+)\.([a-z0-9_-]+)\s*[({]/gi)) {
    const rutaPartial = `${dirShell}/_${inc[1]}.scss`;
    if (!existsSync(resolve(process.cwd(), rutaPartial))) {
      throw new Error(
        `${dirShell}/_tokens.scss incluye ${inc[1]}.${inc[2]}() pero no existe ${rutaPartial}: ` +
          `el parser del contrato sólo sigue mixins de la propia cáscara y hay que extenderlo.`
      );
    }
    css += cuerpoDelMixin(sinComentarios(leer(rutaPartial)), inc[2], rutaPartial);
  }
  const encontrados = new Set<string>();
  for (const m of css.matchAll(/(--flow-[a-z0-9-]+)\s*:/g)) encontrados.add(m[1]);
  return [...encontrados].sort();
}

const SHELLS = ['a-afiche', 'b-nocturna', 'c-tarjeta'];

describe('contrato --flow-*', () => {
  it('el flujo consume al menos un token (si esto falla, el parser se rompió)', () => {
    expect(tokensQueElFlujoConsume().length).toBeGreaterThan(5);
  });

  it.each(SHELLS)('la cáscara %s declara TODOS los tokens que el flujo consume', (shell) => {
    const consume = tokensQueElFlujoConsume();
    const declara = tokensQueDeclara(`src/app/features/landing/shells/${shell}`);
    expect(declara).toEqual(expect.arrayContaining(consume));
  });

  /* Un token que ninguna hoja consume es tan malo como uno que falta: el contrato se convierte en un
     desván y la cáscara siguiente lo copia sin saber para qué es. */
  it.each(SHELLS)('la cáscara %s no declara tokens que nadie consuma', (shell) => {
    const consume = tokensQueElFlujoConsume();
    const declara = tokensQueDeclara(`src/app/features/landing/shells/${shell}`);
    expect(consume).toEqual(expect.arrayContaining(declara));
  });
});
