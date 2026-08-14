import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DIR_SHELL } from '../../../core/landing/plantillas';

/**
 * La Task 4 de la fase E convirtió el pie en una OBLIGACIÓN POR CÁSCARA: sacó el tratamiento
 * compartido y dejó que cada una declare el suyo en un bloque `:host(.X-foot)` de
 * `landing-footer.scss`. El commit inmediatamente siguiente creó la cáscara E sin cumplirla, y sus
 * dos botones salieron NEGRO PURO durante toda la fase con la suite entera en verde. `.arrep-link` y
 * `.politica-link` son `<button>`: la UA les pone `color: buttontext` SOBRE EL ELEMENTO, que le gana
 * al color que el pie les pasa por herencia. La ausencia de la regla no rompe nada — sólo se ve mal,
 * y encima justo en el control legalmente obligatorio (Res. 424/2020).
 *
 * Esta es esa obligación hecha puerta, con el mismo patrón que `booking/contrato-flow.spec.ts`: la
 * lista de cáscaras sale del registry (`DIR_SHELL`) y no de acá, así que dar de alta una cáscara la
 * mete sola. Una lista escrita a mano en el propio spec es exactamente el modo de falla que esto
 * viene a matar, escondido un nivel más abajo.
 *
 * La CLASE del pie tampoco está hardcodeada: cada cáscara se la pone al `<app-landing-footer>` en su
 * `shell.html` y se deriva de ahí. Alta de cáscara = nada que sincronizar en este archivo.
 *
 * LO QUE ESTA PUERTA NO MIDE: si el color elegido CONTRASTA. Eso es cuenta de cada cáscara y vive en
 * su `contraste.spec.ts` (B y E lo tienen; el de E, además, pinea `opacity: 1` y el hover de su
 * bloque). Acá se exige lo que ninguna cuenta puede recuperar después: que el bloque EXISTA y le dé
 * un color al estado en reposo de los dos botones.
 *
 * Las rutas van desde la raíz del proyecto y NO relativas a este spec: el builder bundlea los specs
 * a un temporal antes de correrlos, así que `import.meta.url` apuntaría al bundle y no al árbol de
 * fuentes. Si algún día el runner cambia de cwd, esto TIRA (ENOENT) en vez de quedarse verde.
 */
const leer = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

/** Sin comentarios: la prosa de `landing-footer.scss` CITA los selectores y los bloques que este
 *  parser busca (`:host(.b-foot) .arrep-link` aparece escrito en el comentario de la B), y un
 *  docblock no puede satisfacer una obligación. */
const HOJA_PIE = leer('src/app/features/landing/club/landing-footer.scss').replace(/\/\*[\s\S]*?\*\//g, '');

/** Los dos `<button>` del pie. El `<a>` del panel y el `<span>` del © heredan de verdad y se salvan
 *  solos; estos dos no, y son el defecto concreto que esta puerta existe para matar. */
const BOTONES = ['.arrep-link', '.politica-link'];

/** La clase que la cáscara le pone al `<app-landing-footer>` de su plantilla. */
function claseDelPie(dir: string): string {
  const html = leer(`src/app/features/landing/shells/${dir}/shell.html`);
  const m = /<app-landing-footer[^>]*\sclass="([^"]*)"/.exec(html);
  if (!m) throw new Error(`${dir}/shell.html no monta <app-landing-footer> con class`);
  const clase = m[1].trim().split(/\s+/)[0];
  if (!clase) throw new Error(`${dir}/shell.html monta <app-landing-footer> con class vacía`);
  return clase;
}

/**
 * El `color` que la hoja del pie le deja al selector para esa clase de cáscara y EN REPOSO, o
 * `null` si no le deja ninguno.
 *
 * Tres cosas que hace a propósito:
 *
 * 1. **No acepta pseudo-clases.** Un `:host(.X) .arrep-link:hover { color: … }` no cuenta: el botón
 *    negro lo era en reposo, y un color que sólo aparece con el mouse encima no arregla nada (ni
 *    existe en teclado táctil). El `\\s*\\{` pegado al selector es lo que lo excluye.
 * 2. **Exige `color` y no cualquier declaración.** Un bloque con sólo `font-family` deja los dos
 *    botones igual de negros. Y el `color` tiene que abrir declaración (principio del bloque o
 *    después de un `;`): sin eso, un `background-color:` alcanzaría para dar el verde.
 * 3. **Devuelve la ÚLTIMA, no la primera.** Antes esto era un `.test()` —"¿existe en algún lado?"—
 *    y eso se podía vencer sin tocar una línea existente: entre reglas de la misma especificidad
 *    gana la de más abajo, así que un bloque agregado al final con un valor que DESVISTE al botón
 *    lo devolvía a negro puro con la puerta en verde. **Probado, no supuesto**: con
 *    `:host(.c-foot) .arrep-link { color: revert; }` agregado al final, la suite daba 177 passed y
 *    el botón de la C medía `rgb(0, 0, 0)` en el navegador — exactamente el defecto que este
 *    archivo existe para matar. Es el mismo agujero que la review de rama encontró en el pin de
 *    opacidad, un archivo más allá.
 *
 * El `\\${selector}` no es un typo: los selectores de `BOTONES` empiezan con `.`, y ese backslash es
 * el que la escapa para el regex.
 */
function colorEnReposo(clase: string, selector: string): string | null {
  const bloques = [...HOJA_PIE.matchAll(
    new RegExp(`:host\\(\\.${clase}\\)\\s+\\${selector}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
  const valores = bloques.flatMap((b) =>
    [...b.matchAll(/(?:^|;)\s*color\s*:\s*([^;]+)/g)].map((m) => m[1].trim()));
  return valores.length ? valores[valores.length - 1] : null;
}

/**
 * Las palabras clave que DESVISTEN al botón, o sea las que declaran `color` y aun así lo devuelven
 * al `buttontext` de la UA. Son las únicas tres, y la lista corta importa:
 *
 *   · `initial` → el valor inicial de `color` es negro, no el heredado. Vuelve el defecto.
 *   · `revert` / `revert-layer` → devuelven a la hoja del USER AGENT, que para un `<button>` es
 *     `color: buttontext`. Vuelve el defecto.
 *
 * `inherit` y `unset` NO están y no es un olvido: `color` es una propiedad heredada, así que en las
 * dos el botón toma el color que `.X-foot` le pasa desde la hoja de la cáscara — que es justamente
 * lo que la UA le estaba robando. Son un arreglo válido de este bug, sólo que menos explícito.
 *
 * Esta puerta sigue sin juzgar SI EL COLOR CONTRASTA (eso es cuenta de cada cáscara, en su
 * `contraste.spec.ts`): lo que exige es que la hoja lo vista, y estas tres son la manera de escribir
 * una declaración de `color` que no viste nada.
 */
const DESVISTEN = /^(initial|revert|revert-layer)$/i;

function declaraColor(clase: string, selector: string): boolean {
  const valor = colorEnReposo(clase, selector);
  return valor != null && !DESVISTEN.test(valor);
}

describe('el pie tiene un bloque por cáscara', () => {
  for (const [codigo, dir] of Object.entries(DIR_SHELL)) {
    for (const selector of BOTONES) {
      it(`la plantilla ${codigo} (${dir}) le declara color a ${selector}`, () => {
        const clase = claseDelPie(dir);
        const valor = colorEnReposo(clase, selector);
        expect(
          declaraColor(clase, selector),
          (valor == null
            ? `landing-footer.scss no tiene \`:host(.${clase}) ${selector} { color: … }\`. `
            : `la ÚLTIMA declaración de \`:host(.${clase}) ${selector}\` es \`color: ${valor}\`, que ` +
              `no viste nada: devuelve el botón al color de la hoja del user agent. `) +
            `La cáscara ${dir} monta el pie con la clase "${clase}" pero no lo viste: ` +
            `${selector} es un <button>, la UA le pone \`color: buttontext\` sobre el elemento y le ` +
            `gana a lo que el pie hereda, así que va a salir NEGRO PURO sobre la superficie de la ` +
            `plantilla. Agregá el bloque en landing-footer.scss (un hover no alcanza: hace falta el ` +
            `color en reposo). El valor lo elige la cáscara midiéndolo contra SU superficie.`,
        ).toBe(true);
      });
    }
  }

  it('no quedan bloques de pie de cáscaras que ya no existen', () => {
    // El otro lado de la obligación, mismo criterio que "la cáscara no declara tokens que nadie
    // consuma" en `contrato-flow.spec.ts`: un bloque cuya clase ya no la monta ninguna cáscara es
    // CSS muerto que igual se lee como ejemplo, y la cáscara siguiente lo copia sin saber de dónde
    // salió. Si esto se pone rojo por una clase que sí existe, es que el pie se está vistiendo desde
    // un `shell.html` que este spec no está leyendo — y entonces la puerta tiene un agujero.
    const declaradas = new Set(Object.values(DIR_SHELL).map(claseDelPie));
    const huerfanas = [...HOJA_PIE.matchAll(/:host\(\.([a-z0-9-]+)\)/gi)]
      .map((m) => m[1])
      .filter((clase) => !declaradas.has(clase));
    expect([...new Set(huerfanas)]).toEqual([]);
  });
});
